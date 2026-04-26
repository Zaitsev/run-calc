#!/usr/bin/env python3
"""
Icon processing helper for this Wails app.

How to use:
1. From the app root, run:
   python process_icons.py frontend/src/assets/images/hare-calc.jpg
2. To use a different source image, pass its path as the first argument.
3. To keep the generated PNG set in a different folder, use:
   python process_icons.py path/to/image.jpg --icons-dir frontend/src/assets/images/icons
4. To change the output sizes, use:
   python process_icons.py path/to/image.jpg --sizes 1024 512 256 128 64 32

What it generates by default:
- build/appicon.png
- build/windows/icon.ico
- frontend/public/favicon.png
- frontend/src/assets/images/icons/hare-calc-<size>.png

Requirements:
- Python 3.9+
- ffmpeg available on PATH

Notes:
- The script scales the image to fill a square, then center-crops it.
- Existing output files are overwritten.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


DEFAULT_SIZES = [1024, 512, 256, 128, 64, 32]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate Wails app icon assets from a single source image."
    )
    parser.add_argument(
        "source",
        nargs="?",
        default="frontend/src/assets/images/hare-calc.jpg",
        help="Path to the source image. Defaults to the current hare-calc artwork.",
    )
    parser.add_argument(
        "--icons-dir",
        default="frontend/src/assets/images/icons",
        help="Directory where resized PNG icons are written.",
    )
    parser.add_argument(
        "--appicon",
        default="build/appicon.png",
        help="Path for the main Wails app icon PNG.",
    )
    parser.add_argument(
        "--favicon",
        default="frontend/public/favicon.png",
        help="Path for the frontend favicon PNG.",
    )
    parser.add_argument(
        "--ico",
        default="build/windows/icon.ico",
        help="Path for the Windows ICO file.",
    )
    parser.add_argument(
        "--sizes",
        nargs="+",
        type=int,
        default=DEFAULT_SIZES,
        help="Square PNG sizes to generate.",
    )
    parser.add_argument(
        "--store-assets",
        action="store_true",
        default=False,
        help=(
            "Also generate Windows Store icon assets into "
            "build/windows/store-assets/ (required for MSIX / Partner Center)."
        ),
    )
    parser.add_argument(
        "--store-assets-dir",
        default="build/windows/store-assets",
        help="Directory where Store icon assets are written.",
    )
    return parser.parse_args()


def ensure_ffmpeg() -> str:
    ffmpeg_path = shutil.which("ffmpeg")
    if ffmpeg_path:
        return ffmpeg_path

    raise SystemExit("ffmpeg was not found on PATH. Install ffmpeg and try again.")


def run_ffmpeg(ffmpeg_path: str, source: Path, output: Path, size: int) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    command = [
        ffmpeg_path,
        "-y",
        "-loglevel",
        "error",
        "-i",
        str(source),
        "-vf",
        f"scale={size}:{size}:force_original_aspect_ratio=increase,crop={size}:{size}",
        "-frames:v",
        "1",
        str(output),
    ]
    subprocess.run(command, check=True)


def generate_png_set(
    ffmpeg_path: str,
    source: Path,
    icons_dir: Path,
    source_stem: str,
    sizes: list[int],
) -> dict[int, Path]:
    outputs: dict[int, Path] = {}
    for size in sizes:
        output = icons_dir / f"{source_stem}-{size}.png"
        run_ffmpeg(ffmpeg_path, source, output, size)
        outputs[size] = output
    return outputs


def copy_file(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)


def create_windows_icon(ffmpeg_path: str, source_png: Path, ico_path: Path) -> None:
    ico_path.parent.mkdir(parents=True, exist_ok=True)
    command = [
        ffmpeg_path,
        "-y",
        "-loglevel",
        "error",
        "-i",
        str(source_png),
        str(ico_path),
    ]
    subprocess.run(command, check=True)


def pick_required_size(outputs: dict[int, Path], required_size: int) -> Path:
    if required_size in outputs:
        return outputs[required_size]

    available = ", ".join(str(size) for size in sorted(outputs))
    raise SystemExit(
        f"Required size {required_size}px was not generated. Available sizes: {available}"
    )


def run_ffmpeg_wide(
    ffmpeg_path: str, source: Path, output: Path, width: int, height: int
) -> None:
    """Generate a wide tile by centering the square logo on a white canvas."""
    output.parent.mkdir(parents=True, exist_ok=True)
    # Scale the source so its height matches the tile height, then pad width.
    command = [
        ffmpeg_path,
        "-y",
        "-loglevel",
        "error",
        "-i",
        str(source),
        "-vf",
        (
            f"scale=-1:{height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:0:white"
        ),
        "-frames:v",
        "1",
        str(output),
    ]
    subprocess.run(command, check=True)


# Windows Store scale suffixes and their multipliers relative to the base size.
# scale-100 = 1×, scale-125 = 1.25×, scale-150 = 1.5×, scale-200 = 2×, scale-400 = 4×
_STORE_SCALES: list[tuple[str, float]] = [
    ("scale-100", 1.0),
    ("scale-125", 1.25),
    ("scale-150", 1.5),
    ("scale-200", 2.0),
    ("scale-400", 4.0),
]

# (asset_folder, base_px, include_400_scale)
_STORE_SQUARE_ASSETS: list[tuple[str, int, bool]] = [
    ("Square44x44Logo", 44, False),
    ("Square150x150Logo", 150, False),
    ("Square310x310Logo", 310, False),
    ("StoreLogo", 50, False),
]

# (asset_folder, base_width, base_height)
_STORE_WIDE_ASSETS: list[tuple[str, int, int]] = [
    ("Wide310x150Logo", 310, 150),
]


def generate_store_assets(ffmpeg_path: str, source: Path, store_dir: Path) -> int:
    """Generate all Windows Store / MSIX icon assets under *store_dir*.

    Returns the count of files written.
    """
    count = 0

    # Square tiles
    for folder, base_px, include_400 in _STORE_SQUARE_ASSETS:
        scales = _STORE_SCALES if include_400 else _STORE_SCALES[:-1]
        for suffix, multiplier in scales:
            size = round(base_px * multiplier)
            out = store_dir / folder / f"{folder}.{suffix}.png"
            run_ffmpeg(ffmpeg_path, source, out, size)
            count += 1

    # Wide tiles
    for folder, base_w, base_h in _STORE_WIDE_ASSETS:
        for suffix, multiplier in _STORE_SCALES[:-1]:  # skip scale-400 for wide
            w = round(base_w * multiplier)
            h = round(base_h * multiplier)
            out = store_dir / folder / f"{folder}.{suffix}.png"
            run_ffmpeg_wide(ffmpeg_path, source, out, w, h)
            count += 1

    return count


def main() -> int:
    args = parse_args()
    source = Path(args.source)
    if not source.is_file():
        raise SystemExit(f"Source image not found: {source}")

    ffmpeg_path = ensure_ffmpeg()
    icons_dir = Path(args.icons_dir)
    appicon_path = Path(args.appicon)
    favicon_path = Path(args.favicon)
    ico_path = Path(args.ico)
    sizes = sorted(set(args.sizes), reverse=True)

    if any(size <= 0 for size in sizes):
        raise SystemExit("All sizes must be positive integers.")

    outputs = generate_png_set(ffmpeg_path, source, icons_dir, source.stem, sizes)

    copy_file(pick_required_size(outputs, 1024), appicon_path)
    copy_file(pick_required_size(outputs, 64), favicon_path)
    create_windows_icon(ffmpeg_path, pick_required_size(outputs, 256), ico_path)

    print(f"Source: {source}")
    print(f"Generated PNG sizes: {', '.join(str(size) for size in sorted(outputs))}")
    print(f"Wails app icon: {appicon_path}")
    print(f"Frontend favicon: {favicon_path}")
    print(f"Windows icon: {ico_path}")

    if args.store_assets:
        store_dir = Path(args.store_assets_dir)
        n = generate_store_assets(ffmpeg_path, source, store_dir)
        print(f"Store assets ({n} files): {store_dir}")

    return 0


if __name__ == "__main__":
    sys.exit(main())