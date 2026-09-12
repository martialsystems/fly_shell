import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  indexByType,
  litTypesFromNeurons,
  parseSomaPack,
  stripSide,
} from "../js/soma.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("committed soma pack is one FSMP cloud", () => {
  const buf = readFileSync(join(ROOT, "data/malecns_soma.bin"));
  const pack = parseSomaPack(buf);
  assert.equal(pack.count, 1500);
  assert.ok(pack.types.includes("DNp01"));
  assert.ok(pack.types.includes("LPLC2"));
  assert.ok(pack.types.includes("MN9"));
  assert.equal(pack.positions.length, pack.count * 3);
  const idx = indexByType(pack);
  assert.ok(idx.get("DNp01").length >= 2);
  assert.ok(idx.get("LPLC2").length >= 8);
  assert.ok(idx.get("T4c").length >= 8);
});

test("lighting walks types not the full cloud", () => {
  const lit = litTypesFromNeurons({
    LPLC2_L: { id: "LPLC2_L", type: "LPLC2_L", rate: 0.8 },
    DNp01: { id: "DNp01", type: "DNp01", rate: 0.2 },
  });
  assert.equal(lit.get("LPLC2"), 0.8);
  assert.equal(lit.get("LPLC2_L"), 0.8);
  assert.equal(lit.get("DNp01"), 0.2);
  assert.equal(stripSide("LPLC2_R"), "LPLC2");
});
