# ytdl — Personal YouTube Downloader

A small, MediaHuman-style CLI for grabbing videos and audio from YouTube (and everything else `yt-dlp` supports). Made to be simple day-to-day, easy to script, and ready to have a GUI bolted on later.

Feature parity with MediaHuman's YouTube Video Downloader / YouTube-to-MP3:

- Download single videos, playlists, or whole channels
- Pick max quality (`144`–`2160`, or `best`) and container (`mp4` / `mkv` / `webm`)
- Extract audio to `mp3` / `m4a` / `opus` / `flac` / `wav` at a chosen bitrate
- Embed thumbnail as cover art and full metadata tags (title, uploader, upload date, …)
- Optional subtitle download + embed (video mode)
- Batch mode: `-b urls.txt` (one URL per line, `#` for comments)
- Skips already-downloaded items via a persistent archive file
- Uses cookies from your browser for age-restricted / members-only content
- Persistent config in `~/.config/ytdl/config.json`

## Install

```bash
cd youtube-downloader
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

You also need **ffmpeg** on your PATH (used for merging video+audio and MP3 conversion):

```bash
# macOS
brew install ffmpeg
# Debian / Ubuntu
sudo apt install ffmpeg
# Windows
choco install ffmpeg
```

## Usage

Run it as a module (no install needed):

```bash
python -m ytdl <command> [options] <url> [<url> ...]
```

or, after `pip install -e .`, just:

```bash
ytdl <command> [options] <url> [<url> ...]
```

### Download videos

```bash
# One video, best quality up to 1080p, mp4 container (defaults)
python -m ytdl video https://www.youtube.com/watch?v=dQw4w9WgXcQ

# 4K, mkv, into a specific folder
python -m ytdl video -q 2160 -f mkv -o ~/Videos/yt <url>

# A playlist with subtitles
python -m ytdl video --subs --sub-langs en,es <playlist-url>

# Batch: read URLs from a file, skip already-downloaded items
python -m ytdl video -b urls.txt --archive ~/.cache/ytdl-archive.txt
```

### Download audio (like MediaHuman YouTube-to-MP3)

```bash
# MP3 at 192 kbps, thumbnail embedded as cover art
python -m ytdl audio <url>

# 320 kbps MP3, custom output
python -m ytdl audio --bitrate 320 -o ~/Music/yt <url>

# Lossless FLAC
python -m ytdl audio -f flac <url>

# Whole playlist to MP3, skip items already grabbed
python -m ytdl audio -b playlist.txt --archive ~/.cache/ytdl-music.txt
```

### Inspect before downloading

```bash
python -m ytdl info <url>
```

### Save defaults

```bash
# Set new defaults (saved to ~/.config/ytdl/config.json)
python -m ytdl config -o ~/Videos/yt -q 1080 --audio-format mp3 --bitrate 256

# Show current defaults
python -m ytdl config --show

# Reset
python -m ytdl config --reset
```

## Options reference

Common to `video` and `audio`:

| Flag | Meaning |
| --- | --- |
| `-o, --output DIR` | Output directory |
| `-b, --batch-file FILE` | Read URLs from a file (one per line, `#` for comments) |
| `-c, --concurrent N` | Concurrent fragment downloads |
| `--cookies-browser NAME` | Load cookies from `chrome`/`firefox`/`safari`/`edge`/… |
| `--proxy URL` | HTTP or SOCKS proxy |
| `--archive FILE` | Skip URLs previously logged in this file |
| `--no-thumbnail` | Don't embed thumbnail |
| `--no-metadata` | Don't embed metadata |

Video-only:

| Flag | Meaning |
| --- | --- |
| `-q, --quality Q` | Max height (`144`–`2160`) or `best` |
| `-f, --video-format FMT` | `mp4` \| `mkv` \| `webm` |
| `--subs` | Also download subtitles |
| `--sub-langs LANGS` | Comma-separated (`en,fr,es`) |

Audio-only:

| Flag | Meaning |
| --- | --- |
| `-f, --audio-format FMT` | `mp3` \| `m4a` \| `opus` \| `flac` \| `wav` \| `aac` \| `vorbis` |
| `--bitrate KBPS` | e.g. `128`, `192`, `256`, `320` |

## Roadmap

- [ ] Simple web/desktop UI on top of the same `ytdl.downloader` module
- [ ] Per-URL format overrides from the batch file
- [ ] Recurring subscription mode (poll a channel, grab new uploads)

## Notes

Only download content you have the right to save. Respect creators, YouTube's Terms of Service, and any applicable copyright.
