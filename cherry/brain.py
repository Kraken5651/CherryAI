from __future__ import annotations

import json
import re
import threading
from typing import Callable

from google import genai
from google.genai import types

from cherry import config
from cherry.tools import TOOL_DECLARATIONS, TOOL_HANDLERS
from cherry.tools.images import IMAGE_MARKER

SYSTEM_INSTRUCTION = """You are Cherry, a helpful personal Jarvis-like AI assistant on Windows.
Use the provided tools to open websites, apps, folders, play music, generate images, read/write code files, and run safe commands.
Never guess file paths or URLs—call tools instead.
For voice interactions, keep replies concise (1-3 sentences) unless the user asks for detail.
Refuse destructive actions; do not help with harmful commands.
When the user asks to draw, create, or generate art, use generate_image.
When coding, use read_file, write_file, list_dir, and run_command as needed.
"""

MAX_TOOL_ROUNDS = 8
_IMAGE_RE = re.compile(rf"{re.escape(IMAGE_MARKER)}([^|]+)\|(.+)")


class AllModelsExhausted(Exception):
    def __init__(
        self, tried: list[str], last: Exception, *, keys_used: int = 1
    ) -> None:
        self.tried = tried
        self.last = last
        self.keys_used = keys_used
        super().__init__(str(last))


def _friendly_api_error(exc: Exception, model: str) -> str:
    if isinstance(exc, AllModelsExhausted):
        tried = ", ".join(exc.tried)
        key_hint = (
            f" ({exc.keys_used} API key(s) tried)"
            if exc.keys_used > 1
            else ""
        )
        return (
            f"Cherry tried every model ({tried}){key_hint} — all out of free quota.\n\n"
            "Fix options:\n"
            "1) Add more keys in .env: GOOGLE_API_KEYS=key2,key3 (different Google accounts)\n"
            "2) Wait 1–24 hours for quota reset\n"
            "3) Create new keys at https://aistudio.google.com/apikey → restart Cherry"
        )
    text = str(exc)
    if "API_KEY_INVALID" in text or "API key not valid" in text:
        return (
            "Your Gemini API key is invalid. Put a key from "
            "https://aistudio.google.com/apikey in the .env file "
            "(not .env.example). Remove any old GEMINI_API_KEY from Windows "
            "environment variables, then restart Cherry."
        )
    if "429" in text or "RESOURCE_EXHAUSTED" in text or "quota" in text.lower():
        return (
            f"Free quota exceeded for {model}. Cherry already tries other models; "
            "if you still see this, create a new API key or wait for reset."
        )
    return f"Gemini API error: {exc}"


def _try_next_model(exc: Exception) -> bool:
    t = str(exc)
    return (
        "429" in t
        or "RESOURCE_EXHAUSTED" in t
        or "quota" in t.lower()
        or "404" in t
        or "NOT_FOUND" in t
    )


class Brain:
    def __init__(self) -> None:
        if not config.GOOGLE_API_KEYS:
            raise ValueError(
                "No API keys set. Add GOOGLE_API_KEY in .env (see .env.example)."
            )
        self._clients = [
            genai.Client(api_key=k) for k in config.GOOGLE_API_KEYS
        ]
        self._key_index = 0
        self.client = self._clients[0]
        self.model = config.GEMINI_MODEL
        self._contents: list[types.Content] = []
        self._cancel = threading.Event()
        self._tools = types.Tool(
            function_declarations=[
                types.FunctionDeclaration(
                    name=d["name"],
                    description=d["description"],
                    parameters=d["parameters"],
                )
                for d in TOOL_DECLARATIONS
            ]
        )

    def request_cancel(self) -> None:
        self._cancel.set()

    def clear_cancel(self) -> None:
        self._cancel.clear()

    @property
    def is_cancelled(self) -> bool:
        return self._cancel.is_set()

    def clear_history(self) -> None:
        self._contents = []

    def _trim_history(self) -> None:
        max_items = config.MAX_HISTORY_ITEMS
        if len(self._contents) > max_items:
            self._contents = self._contents[-max_items:]

    def _config(self, voice: bool) -> types.GenerateContentConfig:
        extra = (
            " The user is speaking via voice—be brief and conversational."
            if voice
            else ""
        )
        return types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION + extra,
            tools=[self._tools],
            temperature=0.7,
        )

    def _generate(
        self,
        voice: bool,
        on_model_try: Callable[[str], None] | None = None,
    ) -> types.GenerateContentResponse:
        last_err: Exception | None = None
        tried: list[str] = []
        models = list(dict.fromkeys(config.GEMINI_MODEL_FALLBACKS))

        for key_i, client in enumerate(self._clients):
            self._key_index = key_i
            self.client = client

            for model in models:
                if self._cancel.is_set():
                    raise InterruptedError("Stopped by user.")
                label = (
                    model
                    if len(self._clients) == 1
                    else f"{model} [key {key_i + 1}]"
                )
                if label not in tried:
                    tried.append(label)
                if on_model_try:
                    on_model_try(label)
                try:
                    self.model = model
                    return client.models.generate_content(
                        model=model,
                        contents=self._contents,
                        config=self._config(voice),
                    )
                except Exception as e:
                    last_err = e
                    if _try_next_model(e):
                        continue
                    raise

        assert last_err is not None
        raise AllModelsExhausted(
            tried, last_err, keys_used=len(self._clients)
        )

    def _run_tool(
        self,
        name: str,
        args: dict,
        *,
        on_image: Callable[[str], None] | None = None,
    ) -> str:
        handler = TOOL_HANDLERS.get(name)
        if not handler:
            return f"Unknown tool: {name}"
        try:
            result = str(handler(**args))
        except TypeError as e:
            return f"Tool argument error: {e}"
        except Exception as e:
            return f"Tool failed: {e}"

        m = _IMAGE_RE.match(result)
        if m and on_image:
            on_image(m.group(1).strip())
            result = m.group(2)
        return result

    def chat(
        self,
        user_message: str,
        *,
        from_voice: bool = False,
        on_tool_status: Callable[[str], None] | None = None,
        on_image: Callable[[str], None] | None = None,
        on_model_try: Callable[[str], None] | None = None,
        cancel_event: threading.Event | None = None,
    ) -> str:
        stop = cancel_event or self._cancel

        if stop.is_set():
            return "Stopped."

        self._contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=user_message)],
            )
        )
        self._trim_history()

        for _ in range(MAX_TOOL_ROUNDS):
            if stop.is_set():
                self._rollback_last_user()
                return "Stopped."

            try:
                response = self._generate(from_voice, on_model_try=on_model_try)
            except InterruptedError:
                self._rollback_last_user()
                return "Stopped."
            except Exception as e:
                return _friendly_api_error(e, self.model)

            if not response.candidates:
                msg = "No response from model."
                self._append_model_text(msg)
                return msg

            candidate = response.candidates[0]
            if not candidate.content or not candidate.content.parts:
                msg = response.text or "Empty response."
                self._contents.append(
                    types.Content(role="model", parts=[types.Part.from_text(text=msg)])
                )
                return msg

            self._contents.append(candidate.content)
            self._trim_history()

            function_calls = [
                p.function_call
                for p in candidate.content.parts
                if p.function_call
            ]
            if not function_calls:
                return response.text or ""

            tool_parts: list[types.Part] = []
            for fc in function_calls:
                if stop.is_set():
                    self._rollback_last_user()
                    return "Stopped."

                name = fc.name or ""
                args = dict(fc.args) if fc.args else {}
                status = f"Tool: {name}({json.dumps(args, default=str)[:200]})"
                if on_tool_status:
                    on_tool_status(status)
                result = self._run_tool(name, args, on_image=on_image)
                if on_tool_status:
                    on_tool_status(f"→ {result[:300]}")
                tool_parts.append(
                    types.Part.from_function_response(
                        name=name,
                        response={"result": result},
                    )
                )

            self._contents.append(types.Content(role="user", parts=tool_parts))
            self._trim_history()

        return "I hit the tool limit for this request. Please try again with a simpler ask."

    def _rollback_last_user(self) -> None:
        if self._contents and self._contents[-1].role == "user":
            self._contents.pop()

    def _append_model_text(self, text: str) -> None:
        self._contents.append(
            types.Content(role="model", parts=[types.Part.from_text(text=text)])
        )
