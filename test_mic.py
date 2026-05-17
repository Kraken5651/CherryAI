import speech_recognition as sr
import sounddevice as sd

class SoundDeviceSource(sr.AudioSource):
    def __init__(self, device=None, sample_rate=16000, chunk_size=1024):
        self.device = device
        self.SAMPLE_RATE = sample_rate
        self.CHUNK = chunk_size
        self.SAMPLE_WIDTH = 2
        self._stream = None

    def __enter__(self):
        self._stream = sd.InputStream(
            device=self.device,
            samplerate=self.SAMPLE_RATE,
            channels=1,
            dtype='int16',
            blocksize=self.CHUNK
        )
        self._stream.start()
        self.stream = self
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if self._stream:
            self._stream.stop()
            self._stream.close()
            self._stream = None

    def read(self, size):
        if self._stream is None:
            return b""
        # size is in bytes. We have 16-bit audio (2 bytes per frame).
        frames_to_read = size // 2
        frames, overflowed = self._stream.read(frames_to_read)
        return frames.tobytes()

r = sr.Recognizer()
mic = SoundDeviceSource()

print("Testing mic init...")
with mic as source:
    print("Adjusting...")
    r.adjust_for_ambient_noise(source, duration=0.5)
    print("Listening (say something for 2 seconds)...")
    try:
        audio = r.listen(source, timeout=2, phrase_time_limit=2)
        print("Got audio!", len(audio.get_raw_data()), "bytes")
    except sr.WaitTimeoutError:
        print("Timeout.")
