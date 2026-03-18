# HoboImg — Image Conversion Hub

Multi-subdomain image processing service: convert, compress, resize, and crop.

## Subdomains

18 hostnames served by a single Express backend:

| Domain | Tool |
|--------|------|
| `img.hobo.tools` | Hub — all tools |
| `png/jpg/webp/avif/heic/svg/gif/ico/tiff/bmp.hobo.tools` | Auto-convert to format |
| `compress/resize/crop.hobo.tools` | Direct tool access |
| `convert.hobo.tools` | Format conversion |
| `favicon.hobo.tools` | ICO generation |

## Stack

- **Express** + **Sharp** for image processing
- **multer** for uploads (50MB max, memory storage)
- **to-ico** for ICO/favicon generation
- RS256 JWT verification (hobo.tools auth, optional)
- Ephemeral storage: 1hr (anon), 24hr (authed)

## Development

```bash
npm install
npm run dev   # PORT=3400
```

## Deploy

```bash
# Systemd + Nginx configs in deploy/
sudo cp deploy/systemd/hobo-img.service /etc/systemd/system/
sudo cp deploy/nginx/img.hobo.tools.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/img.hobo.tools.conf /etc/nginx/sites-enabled/
sudo systemctl enable --now hobo-img
sudo nginx -t && sudo systemctl reload nginx
```
