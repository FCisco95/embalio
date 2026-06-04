import sys, json, numpy as np, sounddevice as sd
from faster_whisper import WhisperModel

# Reads default mic, transcribes ~2s windows on the GPU, prints JSON lines.
model = WhisperModel("small.en", device="cuda", compute_type="float16")
SR = 16000
WINDOW = int(SR * 2.0)
buf = np.zeros(0, dtype=np.float32)

def emit(text):
    if text.strip():
        sys.stdout.write(json.dumps({"words": text.strip()}) + "\n")
        sys.stdout.flush()

with sd.InputStream(samplerate=SR, channels=1, dtype="float32") as stream:
    while True:
        chunk, _ = stream.read(int(SR * 0.5))
        buf = np.concatenate([buf, chunk[:, 0]])
        if len(buf) >= WINDOW:
            segments, _ = model.transcribe(buf, language="en", beam_size=1)
            emit(" ".join(s.text for s in segments))
            buf = buf[int(SR * 0.5):]  # slide the window, keep recent context
