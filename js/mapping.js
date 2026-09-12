/** Bind firing neurons to named control channels. */

import { clamp01, normalizeMapping } from "./schema.js";

function collect(neurons, channel) {
  const vals = [];
  const from = channel.from || [];
  const match = channel.match || "id";
  if (from.length === 0) return vals;
  const list = Object.values(neurons);
  for (const src of from) {
    if (match === "id") {
      const n = neurons[src];
      if (n) vals.push(n.rate);
      continue;
    }
    for (const n of list) {
      if (match === "type") {
        if (n.type === src || n.id === src) vals.push(n.rate);
      } else if (match === "prefix") {
        if (n.id.startsWith(src) || (n.type && n.type.startsWith(src))) {
          vals.push(n.rate);
        }
      }
    }
  }
  return vals;
}

export function reduceValues(vals, how) {
  if (!vals.length) return 0;
  if (how === "mean") {
    let s = 0;
    for (const v of vals) s += v;
    return s / vals.length;
  }
  if (how === "sum") {
    let s = 0;
    for (const v of vals) s += v;
    return s;
  }
  if (how === "any") {
    return vals.some((v) => v > 0) ? 1 : 0;
  }
  let m = vals[0];
  for (let i = 1; i < vals.length; i++) if (vals[i] > m) m = vals[i];
  return m;
}

export function applyMapping(neurons, mapping) {
  const m = mapping && mapping.channels ? mapping : normalizeMapping(mapping);
  const out = {};
  for (const ch of m.channels) {
    const vals = collect(neurons, ch);
    let v = reduceValues(vals, ch.reduce);
    if (ch.threshold > 0 && v < ch.threshold) v = 0;
    out[ch.id] = clamp01(v);
  }
  return out;
}

export function mergeControls(mapped, overlay, skipMap) {
  if (skipMap) return { ...overlay };
  const out = { ...mapped };
  for (const [k, v] of Object.entries(overlay || {})) out[k] = v;
  return out;
}

export function ensureChannel(mapping, channelId) {
  const m = normalizeMapping(mapping);
  if (!m.channels.find((c) => c.id === channelId)) {
    m.channels.push({
      id: channelId,
      label: channelId,
      from: [],
      match: "id",
      reduce: "max",
      threshold: 0,
      drive: "control",
    });
  }
  return m;
}

export function bindSource(mapping, channelId, source, match = "id") {
  const m = ensureChannel(mapping, channelId);
  const ch = m.channels.find((c) => c.id === channelId);
  const src = String(source || "");
  const empty = ch.from.length === 0;
  if (src && !ch.from.includes(src)) ch.from = [...ch.from, src];
  if (empty) ch.match = match;
  return m;
}

export function unbindSource(mapping, channelId, source) {
  const m = normalizeMapping(mapping);
  const ch = m.channels.find((c) => c.id === channelId);
  if (!ch) return m;
  ch.from = ch.from.filter((s) => s !== source);
  return m;
}

export function firingIds(neurons, minRate = 0.15) {
  const ids = [];
  for (const n of Object.values(neurons)) {
    if (n.rate >= minRate) ids.push(n.id);
  }
  ids.sort();
  return ids;
}

export function sourcesForNeuron(mapping, neuronId, neuronType) {
  const hits = [];
  for (const ch of (mapping && mapping.channels) || []) {
    for (const src of ch.from) {
      const ok =
        (ch.match === "id" && src === neuronId) ||
        (ch.match === "type" && (src === neuronType || src === neuronId)) ||
        (ch.match === "prefix" &&
          (neuronId.startsWith(src) ||
            (neuronType && neuronType.startsWith(src))));
      if (ok) hits.push(ch.id);
    }
  }
  return hits;
}
