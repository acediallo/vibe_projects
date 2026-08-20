import sys
import shutil
from pathlib import Path
from typing import Optional, Callable

from .config import Config


class DownloaderError(RuntimeError):
    pass


def _ensure_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        raise DownloaderError(
            "ffmpeg is required for format conversion and merging.\n"
            "Install it with: apt install ffmpeg  |  brew install ffmpeg  |  choco install ffmpeg"
        )


def _video_format_selector(quality: str, container: str) -> str:
    """Build a yt-dlp -f selector for video downloads."""
    if quality == "best":
        height = None
    else:
        try:
            height = int(quality)
        except ValueError:
            height = 1080

    if container == "mp4":
        base_v = "bestvideo[ext=mp4]"
        base_a = "bestaudio[ext=m4a]"
    elif container == "webm":
        base_v = "bestvideo[ext=webm]"
        base_a = "bestaudio[ext=webm]"
    else:
        base_v = "bestvideo"
        base_a = "bestaudio"

    if height is None:
        return f"{base_v}+{base_a}/best"
    return (
        f"{base_v}[height<={height}]+{base_a}/"
        f"bestvideo[height<={height}]+bestaudio/"
        f"best[height<={height}]/best"
    )


def _make_ydl_opts(
    cfg: Config,
    mode: str,
    progress_hook: Optional[Callable] = None,
) -> dict:
    outtmpl = str(Path(cfg.output_dir) / "%(title).200B [%(id)s].%(ext)s")

    opts: dict = {
        "outtmpl": outtmpl,
        "restrictfilenames": False,
        "windowsfilenames": True,
        "ignoreerrors": True,       # skip failed items in playlists
        "noplaylist": False,
        "concurrent_fragment_downloads": max(1, cfg.concurrent_downloads),
        "retries": 5,
        "fragment_retries": 5,
        "consoletitle": False,
        "quiet": False,
        "no_warnings": False,
    }

    if cfg.archive_file:
        opts["download_archive"] = cfg.archive_file
    if cfg.cookies_from_browser:
        opts["cookiesfrombrowser"] = (cfg.cookies_from_browser,)
    if cfg.proxy:
        opts["proxy"] = cfg.proxy
    if progress_hook:
        opts["progress_hooks"] = [progress_hook]

    postprocessors: list[dict] = []

    if mode == "audio":
        opts["format"] = "bestaudio/best"
        postprocessors.append({
            "key": "FFmpegExtractAudio",
            "preferredcodec": cfg.audio_format,
            "preferredquality": cfg.audio_bitrate,
        })
        if cfg.embed_thumbnail:
            opts["writethumbnail"] = True
            postprocessors.append({"key": "EmbedThumbnail"})
        if cfg.embed_metadata:
            postprocessors.append({"key": "FFmpegMetadata", "add_metadata": True})
    else:  # video
        opts["format"] = _video_format_selector(cfg.video_quality, cfg.video_format)
        opts["merge_output_format"] = cfg.video_format
        if cfg.embed_metadata:
            postprocessors.append({"key": "FFmpegMetadata", "add_metadata": True})
        if cfg.embed_thumbnail and cfg.video_format in ("mp4", "mkv"):
            opts["writethumbnail"] = True
            postprocessors.append({"key": "EmbedThumbnail"})
        if cfg.subtitles:
            opts["writesubtitles"] = True
            opts["writeautomaticsub"] = True
            opts["subtitleslangs"] = cfg.subtitle_langs
            postprocessors.append({"key": "FFmpegEmbedSubtitle"})

    opts["postprocessors"] = postprocessors
    return opts


def _default_progress_hook(d: dict) -> None:
    status = d.get("status")
    if status == "downloading":
        pct = d.get("_percent_str", "  ?%").strip()
        speed = d.get("_speed_str", "?").strip()
        eta = d.get("_eta_str", "?").strip()
        title = d.get("info_dict", {}).get("title", "")[:60]
        sys.stdout.write(f"\r  {pct:>6} @ {speed:>10}  eta {eta:<6}  {title}")
        sys.stdout.flush()
    elif status == "finished":
        sys.stdout.write("\n  postprocessing…\n")
        sys.stdout.flush()
    elif status == "error":
        sys.stdout.write("\n  error on this item, continuing\n")
        sys.stdout.flush()


def download(
    urls: list[str],
    cfg: Config,
    mode: str = "video",
    progress_hook: Optional[Callable] = _default_progress_hook,
) -> int:
    """Download URLs. Returns yt-dlp exit code (0 = all good)."""
    if mode not in ("video", "audio"):
        raise ValueError(f"mode must be 'video' or 'audio', got {mode!r}")

    _ensure_ffmpeg()

    try:
        from yt_dlp import YoutubeDL
    except ImportError as e:
        raise DownloaderError(
            "yt-dlp is not installed. Run: pip install -r requirements.txt"
        ) from e

    Path(cfg.output_dir).mkdir(parents=True, exist_ok=True)
    opts = _make_ydl_opts(cfg, mode, progress_hook)

    with YoutubeDL(opts) as ydl:
        return ydl.download(urls)


def probe(url: str) -> dict:
    """Return metadata for a URL without downloading."""
    try:
        from yt_dlp import YoutubeDL
    except ImportError as e:
        raise DownloaderError("yt-dlp is not installed.") from e

    with YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True}) as ydl:
        return ydl.extract_info(url, download=False)
