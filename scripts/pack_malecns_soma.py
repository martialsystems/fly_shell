#!/usr/bin/env python3
"""Pack MaleCNS somaLocation into one GPU-friendly binary.

Reads the local annotations feather (default: fly_chess malecns_v1) and writes
data/malecns_soma.bin. Positions are translated into the shell view frame:
+x right, +y up, +z anterior (brain), VNC toward -z.
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
    args = parser.parse_args()
    if not args.feather.is_file():
        print("missing feather: {0}".format(args.feather), file=sys.stderr)
        return 2
    xyz, types, cls = load_rows(args.feather)
    view = to_view(xyz)
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
