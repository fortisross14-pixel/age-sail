"""Cut the approved concept sheets in art/source/map into transparent sprites.

Usage: python3 tools/cut_sprites.py
Writes public/sprites/<sheet>/<name>.png and public/sprites/manifest.json.
Needs numpy, scipy and Pillow.
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art", "source", "map")
OUT = os.path.join(ROOT, "public", "sprites")

# names in reading order (rows top to bottom, left to right)
SHEETS = {
    "colonies": dict(
        file="colonies.png", merge=8, grid=(6, 3), scale=0.5, thr=(26, 70, 55), margin=40,
        names=[f"{t}-{s}" for t in ["fort", "trading-post", "mission", "plantation", "mine", "port"]
               for s in ["outpost", "town", "city"]],
    ),
    "units": dict(
        file="land-units.png", merge=18, scale=0.5,
        names=["conquistador", "musketeer", "pikeman", "cannon", "cavalry", "friar", "colonist", "scout"],
    ),
    "ships": dict(
        file="ships.png", merge=10, grid=(1, 7), scale=0.5,
        names=["caravel", "carrack", "galleon", "fluyt", "sloop", "frigate", "ship-of-the-line"],
    ),
    "terrain": dict(
        file="terrain-symbols.png", merge=9, scale=0.6, ink=True,
        names=[f"mountain-{i}" for i in range(6)] + [f"hill-{i}" for i in range(6)]
        + [f"tree-{i}" for i in range(8)] + [f"conifer-{i}" for i in range(8)]
        + [f"palm-{i}" for i in range(8)] + [f"marsh-{i}" for i in range(4)] + [f"rocks-{i}" for i in range(3)],
    ),
    "goods": dict(
        file="goods.png", merge=8, grid=(4, 4), scale=0.4,
        names=["silver", "gold", "sugar", "tobacco", "cacao", "dyes", "furs", "cod",
               "timber", "corn", "potato", "tomato", "spices", "silk", "wine", "tools"],
    ),
    "ornaments": dict(
        file="ornaments.png", merge=12, margin=12,
        boxes=[(30, 8, 538, 508), (540, 85, 772, 372), (782, 20, 1532, 468),
               (290, 440, 1175, 700), (40, 600, 790, 1000), (810, 600, 1520, 1000)], scale=0.6,
        names=["compass-large", "compass-small", "cartouche", "serpent", "whale", "wind-head"],
    ),
}


def background(img: np.ndarray) -> np.ndarray:
    """Estimate the paper colour under the drawings by normalized convolution."""
    lum = img.mean(axis=2)
    ref = np.median(img.reshape(-1, 3), axis=0)
    dist = np.sqrt(((img - ref) ** 2).sum(axis=2))
    obj = (dist > 28) | (lum < ref.mean() - 40)
    obj = ndimage.binary_dilation(obj, iterations=12)
    w = (~obj).astype(np.float32)
    bg = np.empty_like(img)
    wb = ndimage.gaussian_filter(w, 40) + 1e-4
    for c in range(3):
        bg[..., c] = ndimage.gaussian_filter(img[..., c] * w, 40) / wb
    # fall back to the global colour where the paper is fully hidden
    hole = wb < 0.02
    bg[hole] = ref
    return bg


def _cuts(profile: np.ndarray, n: int) -> list:
    """n-1 cut positions at the emptiest point near each expected boundary."""
    prof = ndimage.uniform_filter1d(profile.astype(np.float32), 9)
    nz = np.nonzero(prof > prof.max() * 0.02)[0]
    a, b = nz.min(), nz.max()
    span = (b - a) / n
    cuts = []
    for k in range(1, n):
        lo, hi = int(a + span * (k - 0.4)), int(a + span * (k + 0.4))
        cuts.append(lo + int(np.argmin(prof[lo:hi])))
    return cuts


def grid_cells(solid: np.ndarray, rows: int, cols: int) -> np.ndarray:
    """Mask that is False on the cut lines between grid cells."""
    keep = np.ones_like(solid)
    xcuts = _cuts(solid.sum(axis=0), cols)
    for x in xcuts:
        keep[:, x - 1:x + 2] = False
    bounds = [0] + xcuts + [solid.shape[1]]
    for c in range(cols):
        x0, x1 = bounds[c], bounds[c + 1]
        for y in _cuts(solid[:, x0:x1].sum(axis=1), rows):
            keep[y - 1:y + 2, x0:x1] = False
    return keep


def cut(key: str, cfg: dict) -> list:
    im = Image.open(os.path.join(SRC, cfg["file"])).convert("RGB")
    img = np.asarray(im).astype(np.float32)
    bg = background(img)
    diff = np.sqrt(((img - bg) ** 2).sum(axis=2))
    # darker-than-paper counts extra: ink is what matters
    dark = np.clip(bg.mean(axis=2) - img.mean(axis=2), 0, None)
    score = diff + 0.6 * dark
    lo, hi, solid_thr = cfg.get("thr", (10, 42, 18))
    alpha = np.clip((score - lo) / (hi - lo), 0, 1)
    m = cfg.get("margin", 0)
    if m:
        alpha[:m] = alpha[-m:] = 0
        alpha[:, :m] = alpha[:, -m:] = 0
        score = score.copy()
        score[:m] = score[-m:] = 0
        score[:, :m] = score[:, -m:] = 0

    solid = score > solid_thr
    solid = ndimage.binary_opening(solid, iterations=1)
    grouped = ndimage.binary_dilation(solid, iterations=cfg["merge"])
    if "boxes" in cfg:
        labels = np.zeros(solid.shape, dtype=np.int32)
        # earlier boxes win where boxes overlap
        for i, (x0, y0, x1, y1) in reversed(list(enumerate(cfg["boxes"]))):
            labels[y0:y1, x0:x1] = i + 1
        labels[~ndimage.binary_dilation(solid, iterations=4)] = 0
        n = len(cfg["boxes"])
        grouped = labels > 0
    elif "grid" in cfg:
        grouped = grouped & grid_cells(solid, *cfg["grid"])
    if "boxes" not in cfg:
        labels, n = ndimage.label(grouped)
    objs = ndimage.find_objects(labels)
    sizes = ndimage.sum(solid, labels, range(1, n + 1))
    comps = [(i + 1, objs[i]) for i in range(n) if sizes[i] > 150]
    names = cfg["names"]
    if len(comps) != len(names):
        print(f"[{key}] expected {len(names)} sprites, found {len(comps)}", file=sys.stderr)
        for i, s in comps:
            print("   ", s[1].start, s[0].start, s[1].stop - s[1].start, s[0].stop - s[0].start, file=sys.stderr)
        sys.exit(1)

    # reading order: group into rows by vertical overlap, then left to right
    comps.sort(key=lambda c: (c[1][0].start + c[1][0].stop) / 2)
    rows, cur = [], [comps[0]]
    for c in comps[1:]:
        prev_mid = np.mean([(p[1][0].start + p[1][0].stop) / 2 for p in cur])
        top, bot = c[1][0].start, c[1][0].stop
        if top < prev_mid < bot:
            cur.append(c)
        else:
            rows.append(cur)
            cur = [c]
    rows.append(cur)
    ordered = [c for r in rows for c in sorted(r, key=lambda c: c[1][1].start)]

    os.makedirs(os.path.join(OUT, key), exist_ok=True)
    out = []
    pad = 4
    for name, (lab, (sy, sx)) in zip(names, ordered):
        region = ndimage.binary_dilation(labels == lab, iterations=3)
        a = alpha * region
        y0, y1 = max(sy.start - pad, 0), min(sy.stop + pad, img.shape[0])
        x0, x1 = max(sx.start - pad, 0), min(sx.stop + pad, img.shape[1])
        # tighten to the visible pixels
        ys, xs = np.nonzero(a[y0:y1, x0:x1] > 0.04)
        y0, y1 = y0 + ys.min(), y0 + ys.max() + 1
        x0, x1 = x0 + xs.min(), x0 + xs.max() + 1
        rgb = img[y0:y1, x0:x1]
        # un-mix the paper colour from semi-transparent edge pixels
        aa = a[y0:y1, x0:x1][..., None]
        b = bg[y0:y1, x0:x1]
        if cfg.get("ink"):
            # ink-only symbols: keep what is darker than the paper, drop highlights
            d = np.clip(b.mean(axis=2) - rgb.mean(axis=2), 0, None)
            aa = (np.clip((d - 6) / 70, 0, 1) * region[y0:y1, x0:x1])[..., None]
            fg = np.broadcast_to(np.array([92, 60, 32], np.float32), rgb.shape)
        else:
            fg = np.where(aa > 0.05, (rgb - b * (1 - aa)) / np.maximum(aa, 0.05), rgb)
        rgba = np.dstack([np.clip(fg, 0, 255), aa[..., 0] * 255]).astype(np.uint8)
        sprite = Image.fromarray(rgba, "RGBA")
        s = cfg["scale"]
        sprite = sprite.resize((max(1, round(sprite.width * s)), max(1, round(sprite.height * s))), Image.LANCZOS)
        sprite.save(os.path.join(OUT, key, f"{name}.png"), optimize=True)
        out.append({"name": name, "w": sprite.width, "h": sprite.height})
    print(f"[{key}] {len(out)} sprites")
    return out


def main():
    manifest = {}
    only = sys.argv[1:]
    for key, cfg in SHEETS.items():
        if only and key not in only:
            continue
        manifest[key] = cut(key, cfg)
    # parchment: plain copy at tile size
    tile = Image.open(os.path.join(SRC, "parchment-tile.png")).convert("RGB").resize((512, 512), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    tile.save(os.path.join(OUT, "parchment.jpg"), quality=88)
    path = os.path.join(OUT, "manifest.json")
    if only and os.path.exists(path):
        old = json.load(open(path))
        old.update(manifest)
        manifest = old
    json.dump(manifest, open(path, "w"), indent=1)


if __name__ == "__main__":
    main()
