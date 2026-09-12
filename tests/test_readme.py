#!/usr/bin/env python3
"""README and page copy gates."""

from __future__ import annotations

import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
README = (ROOT / "README.md").read_text(encoding="utf-8")
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
AGENTS = (ROOT / "AGENTS.md").read_text(encoding="utf-8")


class ReadmeTests(unittest.TestCase):
    def test_h1(self) -> None:
        self.assertTrue(README.startswith("# fly_shell\n"))

    def test_contract_strings(self) -> None:
        for needle in (
            "fly_shell.v1",
            "FlyShell",
            "DNp01",
            "DNp09",
            "MaleCNS",
            "FlyWire",
            "schematic",
        ):
            self.assertIn(needle, README, needle)

    def test_page_is_the_box(self) -> None:
        self.assertIn("body-canvas", INDEX)
        self.assertIn("brain-canvas", INDEX)
        self.assertIn("map-table", INDEX)
        self.assertIn("drop JSON on the grid", INDEX)

    def test_no_em_dash(self) -> None:
        for path, text in (("README.md", README), ("index.html", INDEX), ("AGENTS.md", AGENTS)):
            self.assertNotIn("\u2014", text, path)
            self.assertNotIn("\u2013", text, path)

    def test_no_what_it_is_not(self) -> None:
        self.assertIsNone(re.search(r"^#+\s*What it is not", README, re.I | re.M))

    def test_run_command(self) -> None:
        self.assertIn("python3.12 -m http.server", README)
        self.assertIn("node --test", README)


if __name__ == "__main__":
    unittest.main()
