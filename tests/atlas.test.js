import assert from "node:assert/strict";
import test from "node:test";
import { buildAtlas, mergeAtlas } from "../js/atlas.js";

test("atlas is schematic and stable", () => {
  const a = buildAtlas(1);
  const b = buildAtlas(1);
  assert.equal(a.source, "schematic");
  assert.ok(a.neurons.DNp01);
  assert.ok(a.neurons.DNp09);
  assert.ok(a.neurons.MN9);
  assert.ok(a.neurons.LPLC2_L);
  assert.deepEqual(a.neurons.DNp01.xyz, b.neurons.DNp01.xyz);
  assert.equal(Object.keys(a.neurons).length, Object.keys(b.neurons).length);
});

test("mergeAtlas overlays imported xyz", () => {
  const base = buildAtlas(1);
  const merged = mergeAtlas(base, {
    source: "import",
    neurons: { DNp01: { id: "DNp01", xyz: [1, 2, 3], type: "DNp01" } },
  });
  assert.deepEqual(merged.neurons.DNp01.xyz, [1, 2, 3]);
  assert.ok(merged.neurons.DNp09);
  assert.equal(merged.source, "import");
});
