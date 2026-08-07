#!/usr/bin/env python3
"""Regenerate the CERTA& Advisory logo assets (marketing site + portal) from
the master artwork supplied by the client. Re-run this whenever the logo
changes; re-measure FULL_BBOX/MARK_BBOX against the new source first (see
docs/superpowers/specs/2026-08-08-brand-refresh-and-uk-time-design.md).
"""
from pathlib import Path

from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # source is a legitimate large export, not a decompression bomb

SRC = Path(r"C:\Users\HP\Downloads\Certa& Advisory.Logo.png")

# Measured on the 18750x8466px source: (left, top, right, bottom)
FULL_BBOX = (194, 307, 18528, 8058)   # ring + dash + full wordmark
MARK_BBOX = (194, 307, 8163, 8058)    # ring + dash only, wordmark excluded

REPO_ROOT = Path(__file__).resolve().parent.parent  # repo root, wherever this checkout/worktree lives
MARKETING_DIR = REPO_ROOT / "assets"
PORTAL_BRAND_DIR = REPO_ROOT / "portal" / "public" / "brand"
PORTAL_APP_DIR = REPO_ROOT / "portal" / "app"


def make_lockup(src: Image.Image, bbox: tuple[int, int, int, int], out_height: int, pad: int) -> Image.Image:
    """Crop to bbox, then fit to a transparent canvas out_height tall with
    pad px of margin on every side (matches the existing lockup assets'
    ~11px-at-220px-tall margin convention)."""
    cropped = src.crop(bbox)
    content_h = out_height - 2 * pad
    scale = content_h / cropped.height
    content_w = round(cropped.width * scale)
    resized = cropped.resize((content_w, content_h), Image.LANCZOS)
    canvas = Image.new("RGBA", (content_w + 2 * pad, out_height), (0, 0, 0, 0))
    canvas.paste(resized, (pad, pad), resized)
    return canvas


def make_mark(src: Image.Image, bbox: tuple[int, int, int, int], out_size: int, pad: int) -> Image.Image:
    """Crop to bbox, then center it on a square transparent canvas
    out_size x out_size with pad px of margin (matches the existing
    216x216-with-~9px-margin mark asset convention)."""
    cropped = src.crop(bbox)
    content = out_size - 2 * pad
    scale = content / max(cropped.width, cropped.height)
    resized = cropped.resize((round(cropped.width * scale), round(cropped.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (out_size, out_size), (0, 0, 0, 0))
    x = (out_size - resized.width) // 2
    y = (out_size - resized.height) // 2
    canvas.paste(resized, (x, y), resized)
    return canvas


def to_white(im: Image.Image) -> Image.Image:
    """Force every non-transparent pixel to solid white, alpha untouched —
    matches the existing *-white.png assets' convention (the whole mark goes
    white on dark backgrounds, not just the wordmark)."""
    alpha = im.getchannel("A")
    white = Image.new("RGBA", im.size, (255, 255, 255, 0))
    white.putalpha(alpha)
    return white


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    white_src = to_white(src)

    lockup = make_lockup(src, FULL_BBOX, out_height=220, pad=11)
    lockup_white = make_lockup(white_src, FULL_BBOX, out_height=220, pad=11)
    mark = make_mark(src, MARK_BBOX, out_size=216, pad=9)
    mark_white = make_mark(white_src, MARK_BBOX, out_size=216, pad=9)
    favicon_src = make_mark(src, MARK_BBOX, out_size=256, pad=10)

    MARKETING_DIR.mkdir(parents=True, exist_ok=True)
    PORTAL_BRAND_DIR.mkdir(parents=True, exist_ok=True)

    lockup.save(MARKETING_DIR / "certa-lockup.png")
    lockup_white.save(MARKETING_DIR / "certa-lockup-white.png")
    mark.save(MARKETING_DIR / "certa-mark.png")
    mark_white.save(MARKETING_DIR / "certa-mark-white.png")
    favicon_src.save(MARKETING_DIR / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

    lockup.save(PORTAL_BRAND_DIR / "certa-lockup.png")
    mark.save(PORTAL_BRAND_DIR / "certa-mark.png")
    favicon_src.save(PORTAL_APP_DIR / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

    print("Logo assets regenerated:")
    for p in [
        MARKETING_DIR / "certa-lockup.png",
        MARKETING_DIR / "certa-lockup-white.png",
        MARKETING_DIR / "certa-mark.png",
        MARKETING_DIR / "certa-mark-white.png",
        MARKETING_DIR / "favicon.ico",
        PORTAL_BRAND_DIR / "certa-lockup.png",
        PORTAL_BRAND_DIR / "certa-mark.png",
        PORTAL_APP_DIR / "favicon.ico",
    ]:
        print(" -", p)


if __name__ == "__main__":
    main()
