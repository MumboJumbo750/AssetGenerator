import argparse
from pathlib import Path

from PIL import Image, ImageFilter
from rembg import remove


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="inp", required=True)
    parser.add_argument("--out", dest="out", required=True)
    parser.add_argument("--threshold", type=int, default=None)
    parser.add_argument("--feather", type=int, default=0)
    parser.add_argument("--erode", type=int, default=0)
    args = parser.parse_args()

    inp = Path(args.inp)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(inp) as image:
        result = remove(image)
        if result.mode != "RGBA":
          result = result.convert("RGBA")
        if args.threshold is not None or args.feather or args.erode:
            alpha = result.split()[-1]
            if args.threshold is not None:
                threshold = max(0, min(255, args.threshold))
                alpha = alpha.point(lambda a: 255 if a >= threshold else 0)
            if args.feather and args.feather > 0:
                alpha = alpha.filter(ImageFilter.GaussianBlur(radius=args.feather))
            if args.erode and args.erode > 0:
                size = max(1, args.erode * 2 + 1)
                alpha = alpha.filter(ImageFilter.MinFilter(size=size))
            result.putalpha(alpha)
        # Always write PNG to preserve alpha.
        result.save(out, format="PNG")


if __name__ == "__main__":
    main()
