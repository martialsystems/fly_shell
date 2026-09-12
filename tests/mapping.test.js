import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  applyMapping,
  bindSource,
  ensureChannel,
  firingIds,
  mergeControls,
  reduceValues,
  unbindSource,
} from "../js/mapping.js";
import { DEFAULT_MAPPING } from "../js/atlas.js";
import { mappingErrors, normalizeMapping } from "../js/schema.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("default mapping schema is clean", () => {
  const m = normalizeMapping(DEFAULT_MAPPING);
  assert.deepEqual(mappingErrors(m), []);
  const disk = JSON.parse(readFileSync(join(ROOT, "data/mapping.default.json"), "utf8"));
  assert.equal(disk.channels.length, m.channels.length);
  assert.equal(disk.channels[0].id, "walk_fwd");
});

test("DNp09 maps to walk_fwd", () => {
  const controls = applyMapping({ DNp09: { id: "DNp09", type: "DNp09", rate: 0.8 } }, DEFAULT_MAPPING);
  assert.ok(controls.walk_fwd > 0.7);
  assert.equal(controls.jump, 0);
});

test("jump is silent under threshold", () => {
  const low = applyMapping({ DNp01: { id: "DNp01", type: "DNp01", rate: 0.2 } }, DEFAULT_MAPPING);
  assert.equal(low.jump, 0);
  const high = applyMapping({ DNp01: { id: "DNp01", type: "DNp01", rate: 0.9 } }, DEFAULT_MAPPING);
  assert.ok(high.jump > 0.8);
});

test("id match on a type name still sees LPLC2_L", () => {
  const mapping = {
    schema: "fly_shell.mapping.v1",
    channels: [
      {
        id: "loom",
        from: ["LPLC2"],
        match: "id",
        reduce: "max",
        threshold: 0,
        drive: "control",
      },
    ],
  };
  const controls = applyMapping(
    { LPLC2_L: { id: "LPLC2_L", type: "LPLC2_L", rate: 0.77 } },
    mapping,
  );
  assert.equal(controls.loom, 0.77);
});

test("LPLC2 prefix collects both lobes", () => {
  const controls = applyMapping(
    {
      LPLC2_L: { id: "LPLC2_L", type: "LPLC2", rate: 0.4 },
      LPLC2_R: { id: "LPLC2_R", type: "LPLC2", rate: 0.9 },
    },
    DEFAULT_MAPPING,
  );
  assert.equal(controls.loom, 0.9);
});

test("bind onto a filled prefix channel keeps prefix match", () => {
  const m = bindSource(DEFAULT_MAPPING, "loom", "LC4_L", "id");
  const ch = m.channels.find((c) => c.id === "loom");
  assert.equal(ch.match, "prefix");
  assert.ok(ch.from.includes("LC4_L"));
});

test("bind and unbind a firing cell onto a new control", () => {
  let m = ensureChannel(DEFAULT_MAPPING, "fire");
  m = bindSource(m, "fire", "DNp01");
  const ch = m.channels.find((c) => c.id === "fire");
  assert.ok(ch.from.includes("DNp01"));
  const controls = applyMapping({ DNp01: { id: "DNp01", type: "DNp01", rate: 1 } }, m);
  assert.equal(controls.fire, 1);
  m = unbindSource(m, "fire", "DNp01");
  assert.ok(!m.channels.find((c) => c.id === "fire").from.includes("DNp01"));
});

test("adapter overlay wins on the same key; skip_map drops mapped values", () => {
  const mapped = { walk_fwd: 0.9, jump: 0 };
  const overlay = { jump: 0.5 };
  const merged = mergeControls(mapped, overlay, false);
  assert.equal(merged.walk_fwd, 0.9);
  assert.equal(merged.jump, 0.5);
  const skipped = mergeControls(mapped, overlay, true);
  assert.equal(skipped.walk_fwd, undefined);
  assert.equal(skipped.jump, 0.5);
});

test("reducers", () => {
  assert.equal(reduceValues([0.2, 0.8, 0.5], "max"), 0.8);
  assert.equal(reduceValues([0.2, 0.8], "mean"), 0.5);
  assert.equal(reduceValues([0.2, 0.3], "sum"), 0.5);
  assert.equal(reduceValues([0, 0.1], "any"), 1);
  assert.equal(reduceValues([], "max"), 0);
});

test("firing ids", () => {
  assert.deepEqual(
    firingIds({ a: { id: "a", rate: 0.2 }, b: { id: "b", rate: 0.05 } }),
    ["a"],
  );
});
