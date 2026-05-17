"""Cherry AI — Audio Diagnostics"""
import sys
import io
import wave
import time

print("=" * 50)
print("Cherry AI Audio Diagnostics")
print("=" * 50)

# 1. Check sounddevice
print("\n[1] Checking sounddevice...")
try:
    import sounddevice as sd
    import numpy as np
    print(f"    sounddevice version: {sd.__version__}")
    print(f"    Default input device: {sd.default.device[0]}")
    print(f"    Default output device: {sd.default.device[1]}")
    devices = sd.query_devices()
    print(f"    Available devices:")
    for i, d in enumerate(devices):
        direction = ""
        if d['max_input_channels'] > 0:
            direction += " [INPUT]"
        if d['max_output_channels'] > 0:
            direction += " [OUTPUT]"
        print(f"      {i}: {d['name']}{direction}")
except Exception as e:
    print(f"    FAILED: {e}")
    sys.exit(1)

# 2. Test recording
print("\n[2] Recording 3 seconds of audio...")
print("    >>> SPEAK NOW! <<<")
try:
    sample_rate = 16000
    audio = sd.rec(int(3 * sample_rate), samplerate=sample_rate, channels=1, dtype='int16')
    sd.wait()
    rms = np.sqrt(np.mean(audio.astype(np.float32) ** 2))
    peak = np.max(np.abs(audio))
    print(f"    Recorded {len(audio)} frames")
    print(f"    RMS level: {rms:.1f}")
    print(f"    Peak level: {peak}")
    if rms < 50:
        print("    WARNING: Audio is extremely quiet. Mic may be muted or wrong device.")
    elif rms < 200:
        print("    Audio is quiet but detectable.")
    else:
        print("    Audio level looks good!")
except Exception as e:
    print(f"    RECORDING FAILED: {e}")
    sys.exit(1)

# 3. Test Google STT
print("\n[3] Sending audio to Google Speech-to-Text...")
try:
    import speech_recognition as sr
    
    # Convert numpy to WAV bytes
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(audio.tobytes())
    wav_bytes = buf.getvalue()
    
    recognizer = sr.Recognizer()
    audio_data = sr.AudioData(wav_bytes[44:], sample_rate, 2)
    
    text = recognizer.recognize_google(audio_data)
    print(f"    Recognized: '{text}'")
    print("    STT is working!")
except sr.UnknownValueError:
    print("    Google could not understand the audio (too quiet or no speech)")
except sr.RequestError as e:
    print(f"    STT NETWORK ERROR: {e}")
except Exception as e:
    print(f"    STT FAILED: {e}")

# 4. Test TTS playback
print("\n[4] Testing TTS playback...")
try:
    import asyncio
    import edge_tts
    import pygame
    import tempfile
    from pathlib import Path
    
    pygame.mixer.init()
    tmp = Path(tempfile.gettempdir()) / "cherry_test_tts.mp3"
    
    async def test_tts():
        communicate = edge_tts.Communicate("Hello! Cherry AI audio is working perfectly.", "en-US-JennyNeural")
        await communicate.save(str(tmp))
    
    asyncio.run(test_tts())
    
    if tmp.exists():
        print(f"    TTS file created: {tmp.stat().st_size} bytes")
        pygame.mixer.music.load(str(tmp))
        pygame.mixer.music.play()
        print("    Playing audio... (wait 3 seconds)")
        time.sleep(3)
        pygame.mixer.music.stop()
        tmp.unlink(missing_ok=True)
        print("    TTS playback complete!")
    else:
        print("    TTS file was not created!")
except Exception as e:
    print(f"    TTS FAILED: {e}")

print("\n" + "=" * 50)
print("Diagnostics complete.")
print("=" * 50)
