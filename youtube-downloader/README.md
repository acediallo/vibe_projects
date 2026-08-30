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

---

## Quick Start

Get your first download working in about a minute.

### 1. Install ffmpeg

`ffmpeg` is needed for merging video+audio and MP3 conversion. Pick whichever line fits your OS:

```bash
# macOS
brew install ffmpeg

# Debian / Ubuntu
sudo apt install ffmpeg

# Windows (PowerShell, as admin)
choco install ffmpeg
```

Check it's on your PATH:

```bash
ffmpeg -version
```

### 2. Install ytdl

```bash
cd youtube-downloader
python -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Your first download

```bash
# Grab a video (defaults: MP4, up to 1080p, saved to ~/Downloads/ytdl/)
python -m ytdl video https://www.youtube.com/watch?v=dQw4w9WgXcQ

# Or grab just the audio as an MP3 with cover art
python -m ytdl audio https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

That's it. Files land in `~/Downloads/ytdl/` by default. To change that once and for all:

```bash
python -m ytdl config -o ~/Videos/YouTube
```

> **Tip:** if you'd rather type `ytdl` instead of `python -m ytdl`, run `pip install -e .` from the `youtube-downloader/` folder — it installs a `ytdl` command on your PATH.

---

## CLI Reference

The tool has four subcommands:

| Command | What it does |
| --- | --- |
| `ytdl video`  | Download video(s) with picture + sound |
| `ytdl audio`  | Extract audio only (MediaHuman YouTube-to-MP3 equivalent) |
| `ytdl info`   | Print metadata for a URL without downloading anything |
| `ytdl config` | View or change persistent defaults |

Get help for any subcommand with `-h`:

```bash
python -m ytdl video -h
python -m ytdl audio -h
```

### `ytdl video` — download videos

```
ytdl video [options] URL [URL ...]
```

**Common options (shared with `audio`):**

| Flag | Meaning |
| --- | --- |
| `-o, --output DIR` | Where to save files |
| `-b, --batch-file FILE` | Read URLs from a file (one per line, `#` for comments) |
| `-c, --concurrent N` | Parallel fragment downloads (default 3) |
| `--archive FILE` | Skip URLs previously logged here — great for subscriptions |
| `--cookies-browser NAME` | Load cookies from `chrome`, `firefox`, `safari`, `edge`, `brave`, `chromium`, `opera`, or `vivaldi` |
| `--proxy URL` | HTTP or SOCKS proxy (e.g. `socks5://127.0.0.1:1080`) |
| `--no-thumbnail` | Don't embed thumbnail |
| `--no-metadata` | Don't embed metadata tags |

**Video-only options:**

| Flag | Meaning |
| --- | --- |
| `-q, --quality Q` | Max height: `144` / `240` / `360` / `480` / `720` / `1080` / `1440` / `2160` / `best` (default `1080`) |
| `-f, --video-format FMT` | Container: `mp4` (default), `mkv`, or `webm` |
| `--subs` | Also download subtitles and embed them |
| `--sub-langs LANGS` | Comma-separated list, e.g. `en,es,fr` (default `en`) |

**Examples:**

```bash
# One video at 4K, into a specific folder, as MKV
python -m ytdl video -q 2160 -f mkv -o ~/Videos/yt <url>

# A whole playlist with English + Spanish subtitles embedded
python -m ytdl video --subs --sub-langs en,es <playlist-url>

# A YouTube channel: everything uploaded, 720p max, skip anything already grabbed
python -m ytdl video -q 720 --archive ~/.cache/channel.txt https://www.youtube.com/@SomeChannel/videos

# Age-restricted / members-only content: use your logged-in Chrome cookies
python -m ytdl video --cookies-browser chrome <url>
```

### `ytdl audio` — extract audio (MP3 and friends)

```
ytdl audio [options] URL [URL ...]
```

**Audio-only options** (plus all the common ones above):

| Flag | Meaning |
| --- | --- |
| `-f, --audio-format FMT` | `mp3` (default), `m4a`, `opus`, `flac`, `wav`, `aac`, `vorbis` |
| `--bitrate KBPS` | e.g. `128`, `192` (default), `256`, `320` |

**Examples:**

```bash
# MP3 at 320 kbps, cover art + metadata embedded, into your music folder
python -m ytdl audio --bitrate 320 -o ~/Music/yt <url>

# Lossless FLAC of an album playlist
python -m ytdl audio -f flac <album-playlist-url>

# Rip a whole playlist to MP3, remember what we already have
python -m ytdl audio -b my-music-queue.txt --archive ~/.cache/ytdl-music.txt

# Strip metadata / cover art (rare, but sometimes wanted)
python -m ytdl audio --no-thumbnail --no-metadata <url>
```

### `ytdl info` — preview a URL

Prints title, uploader, duration, view count, and (for playlists) every item's title and length — without downloading anything. Handy for confirming you're about to grab the right thing.

```bash
python -m ytdl info https://www.youtube.com/watch?v=dQw4w9WgXcQ
python -m ytdl info <playlist-url>
```

### `ytdl config` — change the defaults

Persists to `~/.config/ytdl/config.json`. Any option you set here is applied to every future `video` / `audio` run unless you override it on the command line.

```bash
# See what's currently saved
python -m ytdl config --show

# Set new defaults
python -m ytdl config -o ~/Videos/yt -q 1080 --audio-format mp3 --bitrate 256

# Wipe and start over
python -m ytdl config --reset
```

---

## Advanced Usage

### Batch downloads from a file

Create `urls.txt`:

```
# my Saturday-morning queue

https://www.youtube.com/watch?v=abc123
https://www.youtube.com/watch?v=def456
# skip this one for now
# https://www.youtube.com/watch?v=zzz999
https://www.youtube.com/playlist?list=PLxxxxxxxxxxxx
```

Then:

```bash
python -m ytdl video -b urls.txt
python -m ytdl audio -b urls.txt --bitrate 320
```

### Subscription-style: only grab new uploads

Point `--archive` at the same file each time; `yt-dlp` logs every video ID it downloads and refuses to touch them again. Combine with a channel URL and you get a "subscribe" behaviour:

```bash
python -m ytdl video \
  -q 1080 \
  -o ~/Videos/mkbhd \
  --archive ~/.cache/ytdl-mkbhd.txt \
  https://www.youtube.com/@mkbhd/videos
```

Schedule that in `cron` / Task Scheduler / a `launchd` plist to run daily and you have a personal auto-downloader.

### Age-restricted, members-only, or private videos

`yt-dlp` can borrow cookies from an installed browser session, so anything you can see logged in, `ytdl` can grab:

```bash
python -m ytdl video --cookies-browser firefox <url>
```

Log in to YouTube in that browser first. Supported: `chrome`, `firefox`, `safari`, `edge`, `brave`, `chromium`, `opera`, `vivaldi`.

### Through a proxy

```bash
python -m ytdl video --proxy socks5://127.0.0.1:1080 <url>
python -m ytdl audio --proxy http://user:pass@proxy.example.com:8080 <url>
```

### Faster downloads

Bump concurrent fragment fetching (default 3):

```bash
python -m ytdl video -c 8 <url>
```

Real-world speed is usually capped by YouTube's per-connection throttling, not your bandwidth — 4–8 is a sweet spot.

### Non-YouTube sites

Under the hood this is `yt-dlp`, which supports [1000+ sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md) — Vimeo, Twitch VODs, SoundCloud, TikTok, Twitter/X, and many more. Just pass the URL; the same options apply.

```bash
python -m ytdl audio https://soundcloud.com/artist/track
python -m ytdl video https://vimeo.com/1234567
```

### Using it as a Python library

If you want to script it or build a UI later, `ytdl.downloader.download()` is the single entry point:

```python
from ytdl.config import Config
from ytdl.downloader import download

cfg = Config.load()             # or Config(output_dir=..., video_quality="720", ...)
download(
    ["https://youtu.be/abc", "https://youtu.be/def"],
    cfg,
    mode="audio",               # "video" or "audio"
)
```

Pass your own `progress_hook=callable` to feed a UI progress bar.

---

## Troubleshooting

- **`ffmpeg is required for format conversion`** → install ffmpeg and make sure `ffmpeg -version` works from your shell.
- **`Sign in to confirm your age`** / private video → use `--cookies-browser <name>` while logged in to that browser.
- **`HTTP Error 403`** or throttled speed → bump `-c 6` or `-c 8`, or retry after a minute (YouTube rate-limits aggressive traffic).
- **A playlist item fails** → the rest still download; failing items are skipped with a warning.
- **Want to re-download something already grabbed** → remove that URL/ID from your `--archive` file, or run without `--archive`.

---

## Roadmap

- [ ] Simple web/desktop UI on top of the same `ytdl.downloader` module
- [ ] Per-URL format overrides from the batch file
- [ ] Recurring subscription mode (poll a channel, grab new uploads)

---

## Notes

Only download content you have the right to save. Respect creators, YouTube's Terms of Service, and any applicable copyright.
