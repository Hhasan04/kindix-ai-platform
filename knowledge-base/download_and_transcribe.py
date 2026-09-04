#!/usr/bin/env python3
"""
KINDIX KB — Local Whisper Fallback for Blocked Videos
========================================================

WHY THIS EXISTS:
extract_transcripts.py (which scrapes YouTube's caption/timedtext endpoint)
got permanently stuck: the exact same videos failed with "IpBlocked" for
2.5+ hours straight with zero variation, across the growing backoff delay.
That's not a transient rate limit clearing over time -- it's a hard block
on that specific request pattern. More waiting won't fix it.

This script goes around the problem entirely: instead of scraping captions,
it downloads each video's AUDIO with yt-dlp (core YouTube functionality,
not an unofficial scraping target) and transcribes it locally with Whisper
(via faster-whisper, no API key, no cloud calls, runs on your CPU).

It only touches videos that are NOT already marked "ok" in
transcript_cache.json -- your 61 successful caption-based transcripts are
left alone. This is additive, not a redo.

SETUP (one-time):
    pip install yt-dlp faster-whisper
    Install ffmpeg and make sure it's on your PATH:
      Windows:  winget install ffmpeg   (or choco install ffmpeg)
      Mac:      brew install ffmpeg
      Linux:    sudo apt install ffmpeg

USAGE:
    python download_and_transcribe.py --limit 3     # test on 3 videos first
    python download_and_transcribe.py                # then run the rest

    After it finishes, rerun your normal command to regenerate the merged file:
    python extract_transcripts.py

NOTES:
- Model size defaults to "small" -- decent Arabic accuracy, reasonable CPU
  speed. Use --model-size base for faster/rougher, or medium for slower/better
  (medium is noticeably heavier on CPU-only machines; try small first).
- First run downloads the Whisper model weights (one-time, a few hundred MB
  depending on size) -- that's expected, not a hang.
- This WILL take real wall-clock time on CPU (each video's audio roughly
  takes its own duration x a multiplier depending on model size/hardware).
  Let it run in the background while you keep working on the backend --
  same idea as --watch mode, just a different bottleneck (your CPU, not
  YouTube's block).
- Downloaded audio files are deleted right after each transcription to
  avoid filling your disk with 143 mp3s.

v2 CHANGES (after a first batch came back with fluent-sounding but
MEANINGLESS Arabic sentences -- worse than YouTube's own captions):
That symptom is Whisper's classic failure mode: it hallucinates plausible
words during silent stretches (these are screen-recorded tutorials with
mouse clicks and pauses -- lots of silence). Two fixes, both on by default:
  1. VAD (voice-activity detection) filtering -- skips silent stretches
     instead of transcribing them into invented text. This is usually the
     bigger fix.
  2. An initial_prompt priming the model with Kindix/school-software
     vocabulary, and language forced to "ar" (skip auto-detect, which
     wastes time and can misfire on short clips) since you've confirmed
     virtually everything is Arabic. Override with --language if a
     specific video is actually Hebrew/English.
Also: beam_size raised from 1 (fastest, worst quality) to 5 (slower,
meaningfully more accurate) -- worth the extra CPU time given the
complaint was about correctness, not speed.
Use --redo-whisper to force re-transcription of anything already marked
"ok_whisper" from the earlier bad run -- otherwise those are (wrongly)
treated as already resolved and skipped.
"""

import argparse
import json
import os
import re
import shutil
import sys
import tempfile

try:
    import yt_dlp
except ImportError:
    print("Missing dependency. Run: pip install yt-dlp", file=sys.stderr)
    sys.exit(1)

try:
    from faster_whisper import WhisperModel
except ImportError:
    print("Missing dependency. Run: pip install faster-whisper", file=sys.stderr)
    sys.exit(1)

if not shutil.which("ffmpeg"):
    print("ffmpeg not found on PATH. Install it first (see the docstring at the top of this file).",
          file=sys.stderr)
    sys.exit(1)

VIDEO_ID_PATTERN = re.compile(r"(?:embed/|v=|youtu\.be/)([A-Za-z0-9_-]{11})")
OK_STATUSES_PREFIX = "ok"  # anything starting with "ok" (ok, ok_fallback_lang:*, ok_whisper) counts as resolved

DEFAULT_PROMPT = (
    "هذا شرح فيديو تعليمي لبرنامج كيندكس لإدارة المدارس. "
    "يتضمن مواضيع مثل الحضور والغياب، العلامات والتقييم، الجدول والحصص، "
    "التسجيل، التقارير، وتطبيق الأهل."
)


def extract_video_id(url: str) -> str | None:
    m = VIDEO_ID_PATTERN.search(url)
    return m.group(1) if m else None


def get_video_ids(articles: list) -> list:
    ids = []
    for article in articles:
        for url in article.get("video_urls", []):
            vid = extract_video_id(url)
            if vid and vid not in ids:
                ids.append(vid)
    return ids


def load_cache(path: str) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def save_cache(path: str, cache: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def download_audio(video_id: str, out_dir: str) -> str | None:
    url = f"https://www.youtube.com/watch?v={video_id}"
    outtmpl = os.path.join(out_dir, f"{video_id}.%(ext)s")
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "128",
        }],
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
    except Exception as e:
        print(f"    download failed: {type(e).__name__}: {str(e)[:150]}")
        return None
    path = os.path.join(out_dir, f"{video_id}.mp3")
    return path if os.path.exists(path) else None


def main():
    parser = argparse.ArgumentParser(description="Whisper fallback transcription for videos blocked from caption scraping")
    parser.add_argument("--in", dest="infile", default="articles.json")
    parser.add_argument("--cache", dest="cache_file", default="transcript_cache.json")
    parser.add_argument("--model-size", default="small", choices=["tiny", "base", "small", "medium", "large-v3"])
    parser.add_argument("--limit", type=int, default=None, help="Only process this many videos (for testing)")
    parser.add_argument("--language", default="ar",
                         help="Force this language code (default 'ar'). Pass 'auto' to let Whisper detect it.")
    parser.add_argument("--no-vad", action="store_true", help="Disable voice-activity-detection filtering (not recommended)")
    parser.add_argument("--beam-size", type=int, default=5)
    parser.add_argument("--initial-prompt", default=DEFAULT_PROMPT,
                         help="Domain-priming text passed to Whisper. Pass '' to disable.")
    parser.add_argument("--redo-whisper", action="store_true",
                         help="Also re-attempt videos already marked ok_whisper (use after tuning quality settings)")
    args = parser.parse_args()

    with open(args.infile, "r", encoding="utf-8") as f:
        articles = json.load(f)

    cache = load_cache(args.cache_file)
    all_ids = get_video_ids(articles)

    def needs_fetch(vid: str) -> bool:
        if vid not in cache:
            return True
        status = str(cache[vid][1])
        if args.redo_whisper and status == "ok_whisper":
            return True
        return not status.startswith(OK_STATUSES_PREFIX)

    todo = [v for v in all_ids if needs_fetch(v)]

    if args.limit:
        todo = todo[: args.limit]

    print(f"{len(all_ids)} unique videos total, {len(todo)} still need real content (not caption-blocked-skip)")
    if not todo:
        print("Nothing to do -- everything is already resolved in the cache.")
        return

    print(f"Loading Whisper model '{args.model_size}' (first run downloads weights, be patient)...")
    model = WhisperModel(args.model_size, device="cpu", compute_type="int8")
    print("Model loaded.\n")

    tmp_dir = tempfile.mkdtemp(prefix="kindix_audio_")
    try:
        for i, vid in enumerate(todo, 1):
            print(f"[{i}/{len(todo)}] {vid}: downloading audio...")
            audio_path = download_audio(vid, tmp_dir)
            if not audio_path:
                cache[vid] = [None, "download_failed"]
                save_cache(args.cache_file, cache)
                print(f"    -> download_failed")
                continue

            print(f"    transcribing...")
            try:
                lang = None if args.language == "auto" else args.language
                segments, info = model.transcribe(
                    audio_path,
                    beam_size=args.beam_size,
                    language=lang,
                    vad_filter=not args.no_vad,
                    vad_parameters={"min_silence_duration_ms": 500},
                    initial_prompt=args.initial_prompt or None,
                )
                text = " ".join(seg.text.strip() for seg in segments).strip()
            except Exception as e:
                text = None
                print(f"    transcribe error: {type(e).__name__}: {str(e)[:150]}")
            finally:
                try:
                    os.remove(audio_path)
                except OSError:
                    pass

            if text:
                cache[vid] = [text, "ok_whisper"]
                print(f"    -> ok_whisper ({len(text)} chars, detected lang: {getattr(info, 'language', '?')})")
            else:
                cache[vid] = [None, "whisper_empty"]
                print(f"    -> whisper_empty")

            save_cache(args.cache_file, cache)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    print(f"\nDone with this batch. Cache updated: {args.cache_file}")
    print("Now run: python extract_transcripts.py   (plain, no --watch needed if this covered everything)")
    print("to regenerate articles_enriched.json with these transcripts merged in.")


if __name__ == "__main__":
    main()
