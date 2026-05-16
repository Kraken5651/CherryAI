from __future__ import annotations

import asyncio
import tempfile
import threading
import time
from pathlib import Path
from typing import TYPE_CHECKING, Callable

import edge_tts
import pygame
import speech_recognition as sr

from cherry import config

if TYPE_CHECKING:
    from cherry.brain import Brain


class VoiceController:
    def __init__(
        self,
        brain: Brain,
        *,
        on_status: Callable[[str], None] | None = None,
        on_reply: Callable[[str, str], None] | None = None,
        on_image: Callable[[str], None] | None = None,
    ) -> None:
        self.brain = brain
        self.on_status = on_status
        self.on_reply = on_reply
        self.on_image = on_image
        self.enabled = config.VOICE_ENABLED
        self.always_listen = config.ALWAYS_LISTEN
        self._running = False
        self._thread: threading.Thread | None = None
        self._speaking = threading.Event()
        self._halt_speech = threading.Event()
        self._recognizer = sr.Recognizer()
        self._mic = sr.Microphone()
        self._pygame_ready = False

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False

    def interrupt(self) -> None:
        """Stop TTS and cancel in-flight brain work."""
        self.brain.request_cancel()
        self.stop_speaking()

    def stop_speaking(self) -> None:
        self._halt_speech.set()
        try:
            pygame.mixer.music.stop()
        except pygame.error:
            pass
        self._speaking.clear()

    def toggle_enabled(self) -> bool:
        self.enabled = not self.enabled
        return self.enabled

    def toggle_always_listen(self) -> bool:
        self.always_listen = not self.always_listen
        return self.always_listen

    def listen_once(self) -> str | None:
        try:
            with self._mic as source:
                self._recognizer.adjust_for_ambient_noise(source, duration=0.3)
                audio = self._recognizer.listen(source, timeout=6, phrase_time_limit=12)
            return self._recognizer.recognize_google(audio)
        except sr.WaitTimeoutError:
            return None
        except sr.UnknownValueError:
            return None
        except Exception as e:
            if self.on_status:
                self.on_status(f"Listen error: {e}")
            return None

    def _ensure_audio(self) -> None:
        if not self._pygame_ready:
            pygame.mixer.init()
            self._pygame_ready = True

    def speak(self, text: str) -> None:
        if not text.strip():
            return
        self._ensure_audio()
        self._halt_speech.clear()
        self._speaking.set()
        try:
            asyncio.run(self._speak_async(text))
        finally:
            self._speaking.clear()

    async def _speak_async(self, text: str) -> None:
        short = text if len(text) <= 500 else text[:497] + "..."
        tmp = Path(tempfile.gettempdir()) / f"cherry_tts_{int(time.time() * 1000)}.mp3"
        try:
            communicate = edge_tts.Communicate(short, config.VOICE_NAME)
            await communicate.save(str(tmp))
            if self._halt_speech.is_set():
                return
            pygame.mixer.music.load(str(tmp))
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                if self._halt_speech.is_set():
                    pygame.mixer.music.stop()
                    break
                pygame.time.Clock().tick(10)
        finally:
            try:
                tmp.unlink(missing_ok=True)
            except OSError:
                pass

    def _loop(self) -> None:
        with self._mic as source:
            self._recognizer.adjust_for_ambient_noise(source, duration=0.8)
        if self.on_status:
            self.on_status("Voice ready.")

        while self._running:
            if not self.enabled or self._speaking.is_set():
                time.sleep(0.3)
                continue
            try:
                with self._mic as source:
                    if self.on_status:
                        self.on_status("Listening...")
                    audio = self._recognizer.listen(
                        source, timeout=4, phrase_time_limit=8
                    )
                transcript = self._recognizer.recognize_google(audio).strip()
            except sr.WaitTimeoutError:
                continue
            except sr.UnknownValueError:
                continue
            except Exception as e:
                if self.on_status:
                    self.on_status(f"STT error: {e}")
                continue

            if not transcript:
                continue

            low = transcript.lower()
            if not self.always_listen:
                if config.WAKE_WORD not in low:
                    continue
                if self.on_status:
                    self.on_status("Wake word heard.")
                try:
                    with self._mic as source:
                        audio = self._recognizer.listen(
                            source, timeout=5, phrase_time_limit=10
                        )
                    transcript = self._recognizer.recognize_google(audio).strip()
                except (sr.WaitTimeoutError, sr.UnknownValueError):
                    continue

            if self.on_status:
                self.on_status(f"You: {transcript}")
            self._handle_utterance(transcript)

    def _handle_utterance(self, transcript: str) -> None:
        self.brain.clear_cancel()
        try:
            reply = self.brain.chat(
                transcript,
                from_voice=True,
                on_tool_status=self.on_status,
                on_image=self.on_image,
            )
        except Exception as e:
            reply = f"Sorry, I ran into an error: {e}"
        if self.brain.is_cancelled:
            reply = "Stopped."
        if self.on_reply:
            self.on_reply(transcript, reply)
        if reply != "Stopped.":
            self.speak(reply)
