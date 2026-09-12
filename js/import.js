/** Parse a dropped/pasted plug: one frame, a timeline, NDJSON, or a pack. */

import {
  FRAME_SCHEMA,
  frameLooksLike,
  lerpFrame,
  normalizeFrame,
  normalizeMapping,
  emptyFrame,
} from "./schema.js";

export function parsePlugText(text) {
  const src = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!src) {
    return { kind: "empty", frames: [], mapping: null, atlas: null, error: "empty" };
  }
  if (src[0] === "{" || src[0] === "[") {
    try {
      return parsePlugObject(JSON.parse(src));
    } catch (err) {
      if (/\r?\n/.test(src)) {
        const nd = parseNdjson(src);
        if (nd.kind !== "error") return nd;
      }
      return {
        kind: "error",
        frames: [],
        mapping: null,
        atlas: null,
        error: "json: " + err.message,
      };
    }
  }
  return parseNdjson(src);
}

function parseNdjson(src) {
  const frames = [];
  const lines = src.split(/\r?\n/);
  let mapping = null;
  let atlas = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line[0] === "#") continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (err) {
      return {
        kind: "error",
        frames: [],
        mapping: null,
        atlas: null,
        error: "ndjson line " + (i + 1) + ": " + err.message,
      };
    }
    if (obj.schema === "fly_shell.mapping.v1") mapping = normalizeMapping(obj);
    else if (obj.schema === "fly_shell.atlas.v1") atlas = obj;
    else frames.push(normalizeFrame(obj, frames.length));
  }
  return { kind: "timeline", frames, mapping, atlas, error: null };
}

export function parsePlugObject(obj) {
  if (obj == null) {
    return { kind: "empty", frames: [], mapping: null, atlas: null, error: "null" };
  }
  if (Array.isArray(obj)) {
    return {
      kind: "timeline",
      frames: obj.map((f, i) => normalizeFrame(f, i)),
      mapping: null,
      atlas: null,
      error: null,
    };
  }
  const mapping = obj.mapping ? normalizeMapping(obj.mapping) : null;
  const atlas = obj.atlas || null;
  if (Array.isArray(obj.frames)) {
    return {
      kind: "timeline",
      frames: obj.frames.map((f, i) => normalizeFrame(f, i)),
      mapping,
      atlas,
      error: null,
    };
  }
  if (frameLooksLike(obj) || obj.schema === FRAME_SCHEMA) {
    return {
      kind: "frame",
      frames: [normalizeFrame(obj, 0)],
      mapping,
      atlas,
      error: null,
    };
  }
  if (obj.schema === "fly_shell.mapping.v1") {
    return {
      kind: "mapping",
      frames: [],
      mapping: normalizeMapping(obj),
      atlas,
      error: null,
    };
  }
  if (obj.neurons && !obj.t && !obj.body && !obj.controls) {
    return {
      kind: "atlas",
      frames: [],
      mapping,
      atlas: obj,
      error: null,
    };
  }
  return {
    kind: "frame",
    frames: [normalizeFrame(obj, 0)],
    mapping,
    atlas,
    error: null,
  };
}

export function sampleTimeline(frames, t) {
  if (!frames.length) return emptyFrame(t);
  if (frames.length === 1) return { ...frames[0], t };
  const t0 = frames[0].t;
  const t1 = frames[frames.length - 1].t;
  if (t1 <= t0) return { ...frames[frames.length - 1], t };
  let lo = 0;
  let hi = frames.length - 1;
  if (t <= t0) return { ...frames[0], t };
  if (t >= t1) return { ...frames[hi], t };
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = frames[lo];
  const b = frames[hi];
  const span = b.t - a.t;
  const u = span > 0 ? (t - a.t) / span : 1;
  const mixed = lerpFrame(a, b, u);
  mixed.t = t;
  return mixed;
}

export function timelineDuration(frames) {
  if (!frames.length) return 0;
  return Math.max(0, frames[frames.length - 1].t - frames[0].t);
}
