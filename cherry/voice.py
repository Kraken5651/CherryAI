from __future__ import annotations

import asyncio
import io
import tempfile
import threading
import time
import wave
from pathlib import Path
from typing import TYPE_CHECKING, Callable

import edge_tts
import numpy as np
import pygame
import sounddevice as sd

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
        self._pygame_ready = False

        # Audio settings for sounddevice
        self._sample_rate = 16000
        self._channels = 1
        self._input_device = self._find_working_mic()

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

    # ── Microphone capture (sounddevice) ─────────────────────────

    def _find_working_mic(self) -> int | None:
        """Find a microphone that actually captures audio."""
        import sounddevice as sd
        import numpy as np

        # Try the system default first, then scan all input devices
        candidates = [None]  # None = system default
        try:
            devices = sd.query_devices()
            for i, d in enumerate(devices):
                if d['max_input_channels'] > 0:
                    candidates.append(i)
        except Exception:
            pass

        for dev in candidates:
            try:
                test = sd.rec(
                    int(0.3 * self._sample_rate),
                    samplerate=self._sample_rate,
                    channels=1,
                    dtype='int16',
                    device=dev,
                )
                sd.wait()
                rms = np.sqrt(np.mean(test.astype(np.float32) ** 2))
                # If we get any signal at all, use this device
                if rms > 5:
                    return dev
            except Exception:
                continue
        # Fallback: return None (system default)
        return None

    def _record_chunk(self, duration: float) -> np.ndarray | None:
        """Record a chunk of audio. Returns numpy array or None on error."""
        try:
            audio = sd.rec(
                int(duration * self._sample_rate),
                samplerate=self._sample_rate,
                channels=self._channels,
                dtype="int16",
                device=self._input_device,
            )
            sd.wait()
            return audio
        except Exception:
            return None

    def _numpy_to_wav_bytes(self, audio: np.ndarray) -> bytes:
        """Convert a numpy int16 array into WAV bytes for SpeechRecognition."""
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(self._channels)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(self._sample_rate)
            wf.writeframes(audio.tobytes())
        return buf.getvalue()

    def _recognize(self, audio_np: np.ndarray) -> str | None:
        """Send captured audio to Google STT via SpeechRecognition."""
        import speech_recognition as sr

        wav_data = self._numpy_to_wav_bytes(audio_np)
        recognizer = sr.Recognizer()
        audio = sr.AudioData(wav_data[44:], self._sample_rate, 2)  # skip WAV header
        try:
            text = recognizer.recognize_google(audio)
            return text.strip() if text else None
        except sr.UnknownValueError:
            return None
        except sr.RequestError as e:
            if self.on_status:
                self.on_status(f"STT network error: {e}")
            return None

    # ── Single listen (for the Mic button) ───────────────────────

    def listen_once(self) -> str | None:
        try:
            audio = self._record_chunk(6.0)
            if audio is None:
                return None
            return self._recognize(audio)
        except Exception as e:
            if self.on_status:
                self.on_status(f"Listen error: {e}")
            return None

    # ── TTS (edge-tts + pygame) ──────────────────────────────────

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
            # Unload before deleting to avoid file lock
            pygame.mixer.music.unload()
        finally:
            try:
                tmp.unlink(missing_ok=True)
            except OSError:
                pass  # file still locked, will be cleaned up later

    # ── Background voice loop ────────────────────────────────────

    def _loop(self) -> None:
        if self.on_status:
            self.on_status("Voice ready.")

        while self._running:
            if not self.enabled or self._speaking.is_set():
                time.sleep(0.3)
                continue

            # Record a short chunk to check for speech
            if self.on_status:
                self.on_status("Listening...")

            audio = self._record_chunk(4.0)
            if audio is None:
                time.sleep(0.5)
                continue

            # Check if audio is mostly silence (skip STT call if so)
            rms = np.sqrt(np.mean(audio.astype(np.float32) ** 2))
            if rms < 50:  # silence threshold (very conservative)
                continue

            # Try to transcribe
            transcript = self._recognize(audio)
            if not transcript:
                continue

            low = transcript.lower()
            if not self.always_listen:
                # Wake word mode: require "cherry" or "start cherry"
                wake_trigger = config.WAKE_WORD.lower()
                if wake_trigger not in low and f"start {wake_trigger}" not in low:
                    continue

                if self.on_status:
                    self.on_status(f"Wake word heard! Listening for command...")

                # Now record the actual command
                cmd_audio = self._record_chunk(8.0)
                if cmd_audio is None:
                    continue
                transcript = self._recognize(cmd_audio)
                if not transcript:
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
