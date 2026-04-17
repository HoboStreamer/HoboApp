# HoboAudio

Free online audio converter and processing tools. Part of the [Hobo Network](https://hobo.tools).

## Subdomains

One backend serves 40+ branded subdomains:

### Format Converters
`mp3.hobo.tools` `wav.hobo.tools` `flac.hobo.tools` `ogg.hobo.tools` `m4a.hobo.tools` `aac.hobo.tools` `opus.hobo.tools` `wma.hobo.tools` `aiff.hobo.tools` `ac3.hobo.tools`

### Audio Tools
`trim.hobo.tools` `merge.hobo.tools` `pitch.hobo.tools` `speed.hobo.tools` `reverse.hobo.tools` `normalize.hobo.tools` `fade.hobo.tools` `loop.hobo.tools` `bass.hobo.tools` `equalizer.hobo.tools` `vocal.hobo.tools` `karaoke.hobo.tools` `extract.hobo.tools` `waveform.hobo.tools` `ringtone.hobo.tools` `podcast.hobo.tools` `voice.hobo.tools` `noise.hobo.tools`

### Effects
`echo.hobo.tools` `reverb.hobo.tools` `chorus.hobo.tools` `distortion.hobo.tools` `compressor.hobo.tools` `bitcrusher.hobo.tools` `stereo.hobo.tools` `silence.hobo.tools` `metadata.hobo.tools`

### Hub
`audio.hobo.tools` — Main hub with all tools

## Architecture

Same pattern as HoboImg: domain → context → SPA adapts.

- `server/domain-map.js` — 40+ hostname → tool config mappings
- `server/tools/` — 25 tool handlers, each using FFmpeg via fluent-ffmpeg
- `server/retention/` — Temp file storage with auto-cleanup (1h anon / 24h authed)
- `public/` — Vanilla JS SPA with drag & drop, audio player preview

## Stack

- Node.js + Express
- FFmpeg via fluent-ffmpeg
- hobo-shared (navbar, themes, auth JWT)
- No frameworks, no build step

## Deploy

```bash
# On production server (SSH)
sudo cp deploy/systemd/hobo-audio.service /etc/systemd/system/
sudo cp deploy/nginx/audio.hobo.tools.conf /etc/nginx/sites-enabled/
sudo systemctl daemon-reload
sudo systemctl enable --now hobo-audio
sudo nginx -t && sudo systemctl reload nginx
```

## Requirements

- Node.js 20+
- FFmpeg installed system-wide (`apt install ffmpeg`)
- hobo-shared package (workspace link)

## Port

`3500` (configured in `server/config.js`)
