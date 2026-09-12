#!/usr/bin/env python3
"""Public copy may name the same cells. It may not claim a 166k live LIF."""

from __future__ import annotations

import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SURFACES = [
    ROOT / "README.md",
    ROOT / "index.html",
    ROOT / "description.txt",
]


class ClaimTests(unittest.TestCase):
    def test_no_full_brain_sim_claim(self) -> None:
        banned = re.compile(
            r"(166,?000|139,?255).{0,80}(simulat|LIF|in the browser|live)",
            re.I | re.S,
        )
        for path in SURFACES:
            text = path.read_text(encoding="utf-8")
            self.assertIsNone(banned.search(text), path.name)

    def test_schematic_is_labeled(self) -> None:
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("schematic", readme)
        atlas = (ROOT / "js" / "atlas.js").read_text(encoding="utf-8")
        self.assertIn('source: "schematic"', atlas)


if __name__ == "__main__":
    unittest.main()
