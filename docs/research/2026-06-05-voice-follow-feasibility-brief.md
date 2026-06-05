# Voice-follow feasibility — deep-research brief (NOT YET RUN)

**Status:** KNOWN ISSUE — voice-follow shipped but does not work well enough to use.
**Registered:** 2026-06-05, during owner smoke test on `feat/recording-cockpit`.
**When to run:** next time we pick up voice-follow. Paste the prompt below into
`/deep-research` (or hand to a research agent) before writing any code.

## What's broken (owner-observed)

- First chunk advanced, later chunks stalled or advanced erratically.
- Even after resync + manual-anchor fixes (`7761d4d`), tracking is not reliable
  enough to trust on camera.
- Inherent ~1–2 s lag (whisper transcribes 2 s sliding windows).

## Current architecture (works mechanically, fails on accuracy/latency)

```
mic → sounddevice (0.5 s reads) → faster-whisper small.en CUDA float16
    → 2 s sliding window, re-transcribed every 0.5 s → JSON words over WS :8765
    → renderer follower (advance-only fuzzy matcher, dice ≥ 0.6, look-ahead 6,
      2-word resync horizon 40, beat-level only) → setActive(beat)
```

Pipeline verified end-to-end on the RTX 3080 (CUDA DLL PATH fix `3750499`).
Suspected core problems: sliding-window re-transcription emits unstable,
overlapping, sometimes-hallucinated fragments ("Thank you." on silence); the
follower consumes a *stream of repeats* rather than stable incremental text;
matching is beat-level only (ignores sentence pages).

## Deep-research prompt (run later, verbatim)

> Research how to build reliable low-latency voice-following for a local
> teleprompter on Windows (RTX 3080, Python sidecar + Electron/React renderer).
> The system must track a speaker reading a known script and advance the
> display chunk-by-chunk within <1 s of the speaker, tolerating ad-libs,
> skipped sentences, numbers read differently ("34" vs "thirty-four"), and
> proper nouns ("Embalio"). Investigate:
> 1. **Streaming ASR engines** purpose-built for incremental output with
>    stable partials: whisper-streaming / WhisperLive / faster-whisper VAD
>    chunking, NVIDIA Riva/Parakeet/Canary, Vosk, sherpa-onnx, Moonshine,
>    Windows native Speech SDK. Compare latency, partial-result stability,
>    local-GPU support, Python/Node integration effort.
> 2. **Forced alignment instead of free transcription**: since the script is
>    KNOWN in advance, evaluate aligner approaches (CTC forced alignment,
>    wav2vec2 alignment, Whisper with constrained decoding / prompt biasing,
>    keyword-spotting on the next expected phrase). Is aligning audio to known
>    text fundamentally more robust than fuzzy-matching free transcription?
> 3. **Matcher design** used by commercial voice-follow teleprompters
>    (PromptSmart, Teleprompter Premium, SPEAKFLOW): published techniques,
>    patents, reverse-engineering write-ups. How do they handle ad-libs,
>    skips, repeats, restarts?
> 4. **Recommendation**: pick ONE architecture (engine + alignment/matcher)
>    with a concrete integration sketch for our stack (Python sidecar → WS →
>    React follower seam in `src/lib/studio/voicefollow.ts` +
>    `desktop/sidecar/whisper_stream.py`), estimated effort, and a fallback if
>    GPU alignment proves too heavy.
> Deliver: comparison table, recommended architecture, integration plan,
> known-risk list. Cite sources.

## Decision gate after research

- If a credible <1 s, ad-lib-tolerant architecture exists → plan + implement.
- If not → declare voice-follow out of scope; manual paging (Ctrl+→, foot
  pedal) is the supported flow. Remove the 🎙 affordances or mark experimental.

## Workaround until then

Manual paging works well: chunks via Enter in the manual-script box,
`Ctrl+→/←` or a USB foot pedal mapped to those keys.
