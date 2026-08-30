import json
import os
from pathlib import Path
from dataclasses import dataclass, asdict, field
from typing import Optional

DEFAULT_CONFIG_DIR = Path(os.path.expanduser("~/.config/ytdl"))
DEFAULT_CONFIG_FILE = DEFAULT_CONFIG_DIR / "config.json"
DEFAULT_DOWNLOAD_DIR = Path(os.path.expanduser("~/Downloads/ytdl"))


@dataclass
class Config:
    output_dir: str = str(DEFAULT_DOWNLOAD_DIR)
    video_quality: str = "1080"        # 144, 240, 360, 480, 720, 1080, 1440, 2160, best
    video_format: str = "mp4"          # mp4, mkv, webm
    audio_format: str = "mp3"          # mp3, m4a, opus, flac, wav
    audio_bitrate: str = "192"         # kbps
    embed_thumbnail: bool = True
    embed_metadata: bool = True
    concurrent_downloads: int = 3
    subtitles: bool = False
    subtitle_langs: list = field(default_factory=lambda: ["en"])
    cookies_from_browser: Optional[str] = None  # chrome, firefox, safari, edge
    proxy: Optional[str] = None
    archive_file: Optional[str] = None  # if set, skips previously downloaded ids

    @classmethod
    def load(cls, path: Optional[Path] = None) -> "Config":
        path = path or DEFAULT_CONFIG_FILE
        if not path.exists():
            return cls()
        try:
            with open(path) as f:
                data = json.load(f)
            return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
        except (json.JSONDecodeError, TypeError):
            return cls()

    def save(self, path: Optional[Path] = None) -> Path:
        path = path or DEFAULT_CONFIG_FILE
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            json.dump(asdict(self), f, indent=2)
        return path
