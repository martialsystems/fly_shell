/** MaleCNS soma cloud pack (FSMP v1). DOM-free so node tests hit this file. */

export const SOMA_MAGIC = "FSMP";
export const SOMA_VERSION = 1;
export const SOMA_RECORD = 16;

export const CLASS_COLORS = {
  0: [0.22, 0.32, 0.40],
  1: [0.24, 0.78, 1.00],
  2: [0.83, 0.63, 1.00],
  3: [0.49, 0.88, 1.00],
  4: [0.40, 0.90, 0.70],
  5: [1.00, 0.84, 0.42],
  6: [1.00, 0.54, 0.83],
  7: [0.95, 0.55, 0.25],
  8: [0.45, 0.75, 0.95],
  9: [0.90, 0.70, 0.40],
};

export function stripSide(id) {
  const s = String(id || "");
  return s.replace(/_[LR]$/, "");
}

export function parseSomaPack(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  if (bytes.byteLength < 24) throw new Error("soma pack too small");
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== SOMA_MAGIC) throw new Error("soma magic " + magic);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(4, true);
  if (version !== SOMA_VERSION) throw new Error("soma version " + version);
  const count = view.getUint32(8, true);
  const ntypes = view.getUint32(12, true);
  let off = 24;
  const types = [];
  const decoder = new TextDecoder("utf-8");
  for (let i = 0; i < ntypes; i++) {
    if (off + 2 > bytes.byteLength) throw new Error("type table truncated");
    const n = view.getUint16(off, true);
    off += 2;
    types.push(decoder.decode(bytes.subarray(off, off + n)));
    off += n;
  }
  const need = off + count * SOMA_RECORD;
  if (bytes.byteLength < need) throw new Error("soma records truncated");
  const positions = new Float32Array(count * 3);
  const classes = new Uint8Array(count);
  const typeIds = new Uint16Array(count);
  for (let i = 0; i < count; i++) {
    const rec = off + i * SOMA_RECORD;
    positions[i * 3] = view.getFloat32(rec, true);
    positions[i * 3 + 1] = view.getFloat32(rec + 4, true);
    positions[i * 3 + 2] = view.getFloat32(rec + 8, true);
    classes[i] = view.getUint8(rec + 12);
    typeIds[i] = view.getUint16(rec + 14, true);
  }
  return { count, types, positions, classes, typeIds };
}

export function indexByType(pack) {
  const buckets = new Map();
  for (let i = 0; i < pack.count; i++) {
    const name = pack.types[pack.typeIds[i]] || "";
    let list = buckets.get(name);
    if (!list) {
      list = [];
      buckets.set(name, list);
    }
    list.push(i);
  }
  const out = new Map();
  for (const [name, list] of buckets) out.set(name, Uint32Array.from(list));
  return out;
}

export function fillBaseColors(pack, rgb) {
  const n = pack.count;
  for (let i = 0; i < n; i++) {
    const c = CLASS_COLORS[pack.classes[i]] || CLASS_COLORS[0];
    rgb[i * 3] = c[0];
    rgb[i * 3 + 1] = c[1];
    rgb[i * 3 + 2] = c[2];
  }
  return rgb;
}

export function litTypesFromNeurons(neurons) {
  const lit = new Map();
  for (const rec of Object.values(neurons || {})) {
    const rate = rec.rate || 0;
    if (rate < 0.05) continue;
    const keys = [rec.id, rec.type, stripSide(rec.id), stripSide(rec.type)];
    for (const k of keys) {
      if (!k) continue;
      const prev = lit.get(k) || 0;
      if (rate > prev) lit.set(k, rate);
    }
  }
  return lit;
}
