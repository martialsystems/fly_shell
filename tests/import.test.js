import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parsePlugText, sampleTimeline, timelineDuration } from "../js/import.js";
import { applyMapping } from "../js/mapping.js";
import { DEFAULT_MAPPING } from "../js/atlas.js";
import { asNeuronRecord, hzToRate, normalizeFrame } from "../js/schema.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("walk.json is a timeline that drives walk_fwd", () => {
  const text = readFileSync(join(ROOT, "data/examples/walk.json"), "utf8");
  const pack = parsePlugText(text);
  assert.equal(pack.error, null);
  assert.equal(pack.kind, "timeline");
  assert.ok(pack.frames.length >= 2);
  const mid = sampleTimeline(pack.frames, 1.2);
  const controls = applyMapping(mid.neurons, DEFAULT_MAPPING);
  assert.ok(controls.walk_fwd > 0.5, "walk_fwd=" + controls.walk_fwd);
});

test("jump.json peaks DNp01 through the jump channel", () => {
  const text = readFileSync(join(ROOT, "data/examples/jump.json"), "utf8");
  const pack = parsePlugText(text);
  const peak = sampleTimeline(pack.frames, 1.15);
  const controls = applyMapping(peak.neurons, DEFAULT_MAPPING);
  assert.ok(controls.jump > 0.5, "jump=" + controls.jump);
  const pre = sampleTimeline(pack.frames, 0.4);
  const loom = applyMapping(pre.neurons, DEFAULT_MAPPING);
  assert.ok(loom.loom > 0.4);
  assert.equal(loom.jump, 0);
});

test("plug_fire.json replaces the mapping", () => {
  const text = readFileSync(join(ROOT, "data/examples/plug_fire.json"), "utf8");
  const pack = parsePlugText(text);
  assert.ok(pack.mapping);
  const fireCh = pack.mapping.channels.find((c) => c.id === "fire");
  assert.ok(fireCh);
  const peak = sampleTimeline(pack.frames, 0.8);
  const controls = applyMapping(peak.neurons, pack.mapping);
  assert.ok(controls.fire > 0.5);
});

test("NDJSON frames parse", () => {
  const text = [
    '{"t":0,"neurons":{"DNp09":0.2}}',
    '{"t":1,"neurons":{"DNp09":0.9}}',
  ].join("\n");
  const pack = parsePlugText(text);
  assert.equal(pack.kind, "timeline");
  assert.equal(pack.frames.length, 2);
  assert.equal(timelineDuration(pack.frames), 1);
  const disk = parsePlugText(
    readFileSync(join(ROOT, "data/examples/walk.ndjson"), "utf8"),
  );
  assert.equal(disk.error, null);
  assert.equal(disk.frames.length, 2);
});

test("bare rate and hz both normalize", () => {
  const a = asNeuronRecord("DNp01", 0.4);
  assert.equal(a.rate, 0.4);
  const b = asNeuronRecord("DNp01", { hz: 80 });
  assert.ok(Math.abs(b.rate - hzToRate(80)) < 1e-9);
  const f = normalizeFrame({ neurons: { DNp09: 1 } });
  assert.equal(f.neurons.DNp09.rate, 1);
});

test("bad json is an error pack, not a throw", () => {
  const pack = parsePlugText("{not json");
  assert.equal(pack.kind, "error");
  assert.ok(pack.error);
});
