import sys, json, numpy as np, sounddevice as sd

# pip-installed CUDA runtimes (nvidia-cublas-cu12 / nvidia-cudnn-cu12) ship DLLs
# outside the default search path on Windows. ctranslate2 loads cublas/cudnn
# lazily via the LEGACY search path, so add_dll_directory alone is NOT enough —
# the dirs must also be prepended to PATH before the first transcribe call.
try:
    import os, site
    for sp in site.getsitepackages():
        for sub in (("nvidia", "cublas", "bin"), ("nvidia", "cudnn", "bin")):
            d = os.path.join(sp, *sub)
            if os.path.isdir(d):
                os.add_dll_directory(d)
                os.environ["PATH"] = d + os.pathsep + os.environ.get("PATH", "")
except Exception:
    pass

from faster_whisper import WhisperModel

# Reads default mic, transcribes ~2s windows, prints JSON lines.
# Prefer the GPU (float16); fall back to CPU int8 if CUDA isn't usable.
try:
    model = WhisperModel("small.en", device="cuda", compute_type="float16")
    sys.stderr.write("[whisper] using CUDA float16\n")
except Exception as e:
    sys.stderr.write(f"[whisper] CUDA unavailable ({e}); falling back to CPU int8\n")
    model = WhisperModel("small.en", device="cpu", compute_type="int8")

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
