import argparse
import sys
from pathlib import Path

from . import __version__
from .config import Config, DEFAULT_CONFIG_FILE
from .downloader import download, probe, DownloaderError


def _read_batch_file(path: str) -> list[str]:
    urls: list[str] = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                urls.append(line)
    return urls


def _apply_overrides(cfg: Config, args: argparse.Namespace) -> Config:
    if args.output:
        cfg.output_dir = str(Path(args.output).expanduser().resolve())
    if getattr(args, "quality", None):
        cfg.video_quality = args.quality
    if getattr(args, "video_format", None):
        cfg.video_format = args.video_format
    if getattr(args, "audio_format", None):
        cfg.audio_format = args.audio_format
    if getattr(args, "bitrate", None):
        cfg.audio_bitrate = args.bitrate
    if getattr(args, "no_thumbnail", False):
        cfg.embed_thumbnail = False
    if getattr(args, "no_metadata", False):
        cfg.embed_metadata = False
    if getattr(args, "concurrent", None):
        cfg.concurrent_downloads = args.concurrent
    if getattr(args, "subs", False):
        cfg.subtitles = True
    if getattr(args, "sub_langs", None):
        cfg.subtitle_langs = [s.strip() for s in args.sub_langs.split(",") if s.strip()]
    if getattr(args, "cookies_browser", None):
        cfg.cookies_from_browser = args.cookies_browser
    if getattr(args, "proxy", None):
        cfg.proxy = args.proxy
    if getattr(args, "archive", None):
        cfg.archive_file = args.archive
    return cfg


def _collect_urls(args: argparse.Namespace) -> list[str]:
    urls = list(args.urls or [])
    if args.batch_file:
        urls.extend(_read_batch_file(args.batch_file))
    return urls


def cmd_video(args: argparse.Namespace) -> int:
    cfg = _apply_overrides(Config.load(), args)
    urls = _collect_urls(args)
    if not urls:
        print("error: no URLs provided (pass URLs or use --batch-file)", file=sys.stderr)
        return 2
    print(f"downloading {len(urls)} item(s) → {cfg.output_dir}")
    return download(urls, cfg, mode="video")


def cmd_audio(args: argparse.Namespace) -> int:
    cfg = _apply_overrides(Config.load(), args)
    urls = _collect_urls(args)
    if not urls:
        print("error: no URLs provided (pass URLs or use --batch-file)", file=sys.stderr)
        return 2
    print(f"downloading audio for {len(urls)} item(s) → {cfg.output_dir}")
    return download(urls, cfg, mode="audio")


def cmd_info(args: argparse.Namespace) -> int:
    info = probe(args.url)
    if info.get("_type") == "playlist":
        print(f"playlist: {info.get('title')}")
        print(f"  items: {len(info.get('entries') or [])}")
        for i, entry in enumerate(info.get("entries") or [], 1):
            if entry:
                dur = entry.get("duration") or 0
                mins, secs = divmod(int(dur), 60)
                print(f"  {i:>3}. {mins:>3}:{secs:02d}  {entry.get('title')}")
    else:
        dur = info.get("duration") or 0
        mins, secs = divmod(int(dur), 60)
        print(f"title:    {info.get('title')}")
        print(f"uploader: {info.get('uploader')}")
        print(f"duration: {mins}:{secs:02d}")
        print(f"views:    {info.get('view_count')}")
        print(f"url:      {info.get('webpage_url')}")
    return 0


def cmd_config(args: argparse.Namespace) -> int:
    cfg = Config.load()
    if args.show:
        import json, dataclasses
        print(json.dumps(dataclasses.asdict(cfg), indent=2))
        print(f"\n(loaded from: {DEFAULT_CONFIG_FILE})")
        return 0
    if args.reset:
        Config().save()
        print(f"reset config to defaults → {DEFAULT_CONFIG_FILE}")
        return 0
    cfg = _apply_overrides(cfg, args)
    path = cfg.save()
    print(f"saved config → {path}")
    return 0


def _add_common_download_args(p: argparse.ArgumentParser) -> None:
    p.add_argument("urls", nargs="*", help="YouTube URLs (video, playlist, or channel)")
    p.add_argument("-o", "--output", help="Output directory")
    p.add_argument("-b", "--batch-file", help="File with one URL per line (# for comments)")
    p.add_argument("-c", "--concurrent", type=int, help="Concurrent fragment downloads")
    p.add_argument("--cookies-browser", choices=["chrome", "firefox", "safari", "edge", "brave", "chromium", "opera", "vivaldi"],
                   help="Load cookies from an installed browser (for age-restricted/private content)")
    p.add_argument("--proxy", help="HTTP/SOCKS proxy URL")
    p.add_argument("--archive", help="Path to download archive (skip previously downloaded ids)")
    p.add_argument("--no-thumbnail", action="store_true", help="Do not embed thumbnail")
    p.add_argument("--no-metadata", action="store_true", help="Do not embed metadata")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ytdl",
        description="Personal YouTube video / audio downloader (MediaHuman-style CLI).",
    )
    parser.add_argument("-V", "--version", action="version", version=f"ytdl {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    # video
    pv = sub.add_parser("video", help="Download videos")
    _add_common_download_args(pv)
    pv.add_argument("-q", "--quality", default=None,
                    help="Max video height: 144/240/360/480/720/1080/1440/2160/best (default 1080)")
    pv.add_argument("-f", "--video-format", choices=["mp4", "mkv", "webm"], help="Container (default mp4)")
    pv.add_argument("--subs", action="store_true", help="Download and embed subtitles")
    pv.add_argument("--sub-langs", help="Comma-separated subtitle languages (default en)")
    pv.set_defaults(func=cmd_video)

    # audio
    pa = sub.add_parser("audio", help="Extract audio (like MediaHuman YouTube-to-MP3)")
    _add_common_download_args(pa)
    pa.add_argument("-f", "--audio-format", choices=["mp3", "m4a", "opus", "flac", "wav", "aac", "vorbis"],
                    help="Audio format (default mp3)")
    pa.add_argument("--bitrate", help="Audio bitrate in kbps (e.g. 128, 192, 256, 320)")
    pa.set_defaults(func=cmd_audio)

    # info
    pi = sub.add_parser("info", help="Show metadata for a URL without downloading")
    pi.add_argument("url")
    pi.set_defaults(func=cmd_info)

    # config
    pc = sub.add_parser("config", help="View or update defaults")
    pc.add_argument("--show", action="store_true", help="Print current config as JSON")
    pc.add_argument("--reset", action="store_true", help="Reset config to defaults")
    pc.add_argument("-o", "--output", help="Default output directory")
    pc.add_argument("-q", "--quality", help="Default video quality")
    pc.add_argument("--video-format", choices=["mp4", "mkv", "webm"])
    pc.add_argument("--audio-format", choices=["mp3", "m4a", "opus", "flac", "wav", "aac", "vorbis"])
    pc.add_argument("--bitrate", help="Default audio bitrate")
    pc.add_argument("-c", "--concurrent", type=int)
    pc.add_argument("--cookies-browser")
    pc.add_argument("--proxy")
    pc.add_argument("--archive")
    pc.add_argument("--no-thumbnail", action="store_true")
    pc.add_argument("--no-metadata", action="store_true")
    pc.add_argument("--subs", action="store_true")
    pc.add_argument("--sub-langs")
    pc.set_defaults(func=cmd_config)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args) or 0
    except DownloaderError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\naborted", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
