import os
from dotenv import load_dotenv
load_dotenv()

from google import genai
from google.genai import types

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

# Test chat
print("Testing chat...")
r = client.models.generate_content(model="gemini-2.5-flash", contents="Say hello in 5 words")
print(f"  Chat OK: {r.text.strip()}")

# Test STT with a real tiny WAV
import struct, io
sample_rate = 16000
num_samples = int(sample_rate * 0.1)
wav_buf = io.BytesIO()
wav_buf.write(b'RIFF')
data_size = num_samples * 2
wav_buf.write(struct.pack('<I', 36 + data_size))
wav_buf.write(b'WAVEfmt ')
wav_buf.write(struct.pack('<IHHIIHH', 16, 1, 1, sample_rate, sample_rate * 2, 2, 16))
wav_buf.write(b'data')
wav_buf.write(struct.pack('<I', data_size))
wav_buf.write(b'\x00' * data_size)
wav_bytes = wav_buf.getvalue()

for m in ["gemini-2.0-flash-lite", "gemini-2.5-flash"]:
    try:
        print(f"Testing STT with {m}...")
        r = client.models.generate_content(
            model=m,
            contents=[
                types.Content(role="user", parts=[
                    types.Part.from_text(text="Transcribe this audio. Return ONLY the text. If silent return empty."),
                    types.Part.from_bytes(data=wav_bytes, mime_type="audio/wav"),
                ])
            ]
        )
        print(f"  STT OK ({m}): '{r.text.strip() if r.text else ''}'")
        break
    except Exception as e:
        print(f"  STT FAIL ({m}): {str(e)[:150]}")
