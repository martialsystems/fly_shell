#!/usr/bin/env python3
"""Pack MaleCNS somaLocation into one GPU-friendly binary.

Reads the local annotations feather (default: fly_chess malecns_v1) and writes
data/malecns_soma.bin. Positions are translated into the shell view frame:
+x right, +y up, +z anterior (brain), VNC toward -z.

Default is a 1,500-soma sample: keep named motor/sensory types, then fill
with a voxel subsample so the CNS shape still reads. Pass --n 0 for every
recorded soma (too heavy for the live page).
"""

from __future__ import annotations

import argparse
import struct
import sys
from pathlib import Path

import numpy as np
import pyarrow.feather as feather

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FEATHER = Path.home() / "fly_chess/data/malecns/malecns_v1/annotations.feather"
OUT = ROOT / "data" / "malecns_soma.bin"
MAGIC = b"FSMP"
VERSION = 1

CLASS = {
    "ol_intrinsic": 1,
    "cb_intrinsic": 2,
    "vnc_intrinsic": 3,
    "visual_projection": 4,
    "descending_neuron": 5,
    "ascending_neuron": 6,
    "vnc_motor": 7,
    "visual_centrifugal": 8,
    "cb_motor": 9,
}

DISPLAY_N = 1500
KEEP_CAP = {
    "DNp01": 4,
    "DNp02": 4,
    "DNp09": 4,
    "DNa01": 4,
    "DNa02": 4,
    "DNb01": 4,
    "DNg13": 4,
    "MDN": 4,
    "MN9": 4,
    "MN8": 4,
    "TTM": 4,
    "DLM": 8,
    "DVM": 8,
    "EPG": 8,
    "PFNd": 8,
    "PFNv": 8,
    "PEN": 8,
    "FC2": 4,
    "KC": 4,
    "LPLC2": 16,
    "LC4": 12,
    "LC6": 12,
    "LC11": 12,
    "LC16": 12,
    "L1": 16,
    "L2": 16,
    "T4c": 20,
    "T4d": 20,
    "T5c": 20,
    "T5d": 20,
}


def load_rows(path: Path):
    table = feather.read_table(path, columns=["bodyId", "type", "superclass", "somaLocation"])
    xyz = []
    types = []
    cls = []
    n = table.num_rows
    soma = table.column("somaLocation")
    typ_col = table.column("type")
    sc_col = table.column("superclass")
    for i in range(n):
        loc = soma[i].as_py()
        if not loc or len(loc) < 3 or loc[0] is None:
            continue
        xyz.append((float(loc[0]), float(loc[1]), float(loc[2])))
        types.append(typ_col[i].as_py() or "")
        cls.append(CLASS.get(sc_col[i].as_py() or "", 0))
    return np.asarray(xyz, dtype=np.float64), types, np.asarray(cls, dtype=np.uint8)


def to_view(xyz: np.ndarray) -> np.ndarray:
    """MaleCNS raw: +x left, +z posterior/VNC, +y toward VNC. Flip into the shell frame."""
    center = np.median(xyz, axis=0)
    view = np.empty_like(xyz, dtype=np.float64)
    view[:, 0] = -(xyz[:, 0] - center[0])
    view[:, 1] = -(xyz[:, 1] - center[1])
    view[:, 2] = -(xyz[:, 2] - center[2])
    radius = np.max(np.linalg.norm(view, axis=1))
    view /= radius / 2.35
    return view.astype(np.float32)


def _take_type(view: np.ndarray, idxs: list[int], cap: int, rng: np.random.Generator) -> list[int]:
    if len(idxs) <= cap:
        return list(idxs)
    left = [i for i in idxs if view[i, 0] < 0]
    right = [i for i in idxs if view[i, 0] >= 0]
    take_l = min(len(left), cap // 2 + cap % 2)
    take_r = min(len(right), cap // 2)
    picked = []
    if take_l:
        picked.extend(rng.choice(left, size=take_l, replace=False).tolist())
    if take_r:
        picked.extend(rng.choice(right, size=take_r, replace=False).tolist())
    if len(picked) < cap:
        rest = [i for i in idxs if i not in picked]
        need = min(len(rest), cap - len(picked))
        if need:
            picked.extend(rng.choice(rest, size=need, replace=False).tolist())
    return picked


def subsample(view: np.ndarray, types: list[str], n: int, seed: int = 1) -> np.ndarray:
    """Keep named types, then one soma per voxel until n."""
    if n <= 0 or view.shape[0] <= n:
        return np.arange(view.shape[0], dtype=np.int64)
    rng = np.random.default_rng(seed)
    by_type: dict[str, list[int]] = {}
    for i, name in enumerate(types):
        by_type.setdefault(name, []).append(i)
    chosen: set[int] = set()
    for name, cap in KEEP_CAP.items():
        chosen.update(_take_type(view, by_type.get(name, []), cap, rng))
    if len(chosen) >= n:
        picked = np.fromiter(chosen, dtype=np.int64)
        rng.shuffle(picked)
        return np.sort(picked[:n])
    lo = view.min(axis=0)
    hi = view.max(axis=0)
    span = np.maximum(hi - lo, 1e-6)
    # Elongated VNC: more bins on z.
    bins = np.array([12, 10, 22], dtype=np.float64)
    grid = np.floor((view - lo) / span * bins).astype(np.int32)
    grid = np.clip(grid, 0, (bins - 1).astype(np.int32))
    keys = grid[:, 0] * 10000 + grid[:, 1] * 100 + grid[:, 2]
    buckets: dict[int, list[int]] = {}
    for i, key in enumerate(keys.tolist()):
        if i in chosen:
            continue
        buckets.setdefault(key, []).append(i)
    voxel_hits = []
    for members in buckets.values():
        voxel_hits.append(int(members[int(rng.integers(0, len(members)))]))
    rng.shuffle(voxel_hits)
    need = n - len(chosen)
    for i in voxel_hits:
        if len(chosen) >= n:
            break
        chosen.add(i)
        need -= 1
    if len(chosen) < n:
        rest = [i for i in range(view.shape[0]) if i not in chosen]
        extra = n - len(chosen)
        if rest:
            take = rng.choice(rest, size=min(extra, len(rest)), replace=False)
            chosen.update(int(x) for x in np.atleast_1d(take))
    picked = np.fromiter(chosen, dtype=np.int64)
    if picked.size > n:
        rng.shuffle(picked)
        picked = picked[:n]
    return np.sort(picked)


def write_bin(path: Path, view: np.ndarray, types: list[str], cls: np.ndarray) -> None:
    uniq = sorted(set(types))
    type_id = {name: i for i, name in enumerate(uniq)}
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as fh:
        fh.write(MAGIC)
        fh.write(struct.pack("<III", VERSION, view.shape[0], len(uniq)))
        fh.write(struct.pack("<fI", 1.0, 0))
        for name in uniq:
            raw = name.encode("utf-8")
            if len(raw) > 65535:
                raw = raw[:65535]
            fh.write(struct.pack("<H", len(raw)))
            fh.write(raw)
        rec = struct.Struct("<fffBBH")
        for i in range(view.shape[0]):
            fh.write(
                rec.pack(
                    float(view[i, 0]),
                    float(view[i, 1]),
                    float(view[i, 2]),
                    int(cls[i]),
                    0,
                    type_id[types[i]],
                )
            )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--feather", type=Path, default=DEFAULT_FEATHER)
    parser.add_argument("--out", type=Path, default=OUT)
    parser.add_argument("--n", type=int, default=DISPLAY_N, help="0 keeps every recorded soma")
    parser.add_argument("--seed", type=int, default=1)
    args = parser.parse_args()
    if not args.feather.is_file():
        print("missing feather: {0}".format(args.feather), file=sys.stderr)
        return 2
    xyz, types, cls = load_rows(args.feather)
    view = to_view(xyz)
    keep = subsample(view, types, args.n, seed=args.seed)
    view = view[keep]
    cls = cls[keep]
    types = [types[int(i)] for i in keep]
    write_bin(args.out, view, types, cls)
    print(
        "wrote {0}  n={1}  types={2}  bytes={3}".format(
            args.out, view.shape[0], len(set(types)), args.out.stat().st_size
        )
    )
    print("view min", view.min(0), "max", view.max(0))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
