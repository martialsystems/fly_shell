# fly_shell

Empty box for the adult fly CNS. Same named cells as FlyWire and MaleCNS. You plug the stream.

Left: a 3D fly on a grid. Drop a pose, a gait, or a `fly_shell.v1` timeline and the body plays it. If you send rates instead of joints, the default map turns firing cells into walk, steer, jump, halt, feed, and flight.

Right: the full MaleCNS soma map, 141,781 cell bodies as one GPU point cloud. Gold is rate. Click a soma (or a named overlay cell) and bind it to a control.

The map is the product. The demos are plugs.

## What this is

A browser chassis with three slots:

1. Body viewport: grid plus Drosophila rig. Import joints, or let mapped channels drive a tripod gait.
2. Neuron map: 141,781 MaleCNS v1 `somaLocation` points in one `THREE.Points` draw. Named cells without a recorded soma stay on the schematic overlay. Gold is rate. Click binds.
3. Mapping table: neuron id, type, or prefix → named control, reduced with max / mean / sum / any.

`window.FlyShell` is the plug API.

## How to plug

A plug is JSON (one frame, a `{ frames }` pack, or NDJSON) or a JS adapter with `tick(dt, ctx)`.

Frame shape (`fly_shell.v1`):

```json
{
  "schema": "fly_shell.v1",
  "t": 0.0,
  "neurons": { "DNp09": 0.8, "DNp01": { "hz": 40 } },
  "body": { "gait": "walk", "yaw": 0.2 },
  "controls": {},
  "payload": { "hud": "walk", "markers": [{ "x": 1, "z": 0, "label": "cue" }] }
}
```

`neurons` may be an object or an array of `{ id, rate }` / `{ id, hz }`. Rates are 0 to 1. `hz` is compressed with `1 - exp(-hz / 80)`.

If `body.joints` is present (`L1.coxa`, `wing_L`, `proboscis`, …), the rig uses those angles. Otherwise the shell synthesizes pose from mapped controls.

Built-in adapters: Idle, Walk, Walk + steer, Loom → jump, Sugar → feed, Demo cycle. They write named-cell rates. The mapping, not the adapter, moves the body.

Examples on disk:

- `data/examples/walk.json`
- `data/examples/walk.ndjson`
- `data/examples/jump.json`
- `data/examples/plug_fire.json` (replaces the mapping: `fire` from DNp01)

From the console:

```js
FlyShell.plug({
  id: "my-game",
  title: "my game",
  tick(dt, ctx) {
    return { t: ctx.t, neurons: { DNp01: 0.9 }, payload: { hud: "fire" } };
  },
});
FlyShell.bind("DNp01", "jump");
```

Drop a file on the grid, or Paste JSON.

## Default map

Copied from `data/mapping.default.json`:

| Control | Cells | Reduce |
|---------|-------|--------|
| walk_fwd | DNp09, BDN2 | max |
| walk_back | MDN | max |
| steer_l / steer_r | DNa02, DNg13 by side | mean |
| jump | DNp01 | max, threshold 0.4 |
| halt | BB, FG | max |
| feed | MN9 | max |
| loom | LPLC2 prefix | max |
| sugar | Gr5a, LB3b, PhG1a | max |
| flight | DLM, DVM prefix | mean |

The dense cloud is MaleCNS v1 soma positions (CC BY 4.0), axis-flipped into the shell frame. Named overlay source is `schematic` when a type has no soma. Overlay extra xyz with an `atlas` object in the pack (`mergeAtlas`).

## How to run

```bash
cd fly_shell
python3.12 -m http.server 8000
```

Open http://127.0.0.1:8000/

```bash
node --test tests/*.test.js
python3.12 -m unittest discover -s tests -p 'test_*.py'
python3.12 scripts/viewport_sanity.py
```

Three.js r160 is vendored at `vendor/three.module.js`. No CDN on the page.

## File table

| Path | Role |
|------|------|
| `index.html` | The box |
| `js/schema.js` | Frame and mapping contract |
| `js/mapping.js` | Bind / reduce |
| `js/atlas.js` | Named-cell schematic |
| `js/soma.js` | FSMP soma pack parser |
| `data/malecns_soma.bin` | 141,781 MaleCNS soma positions |
| `js/fly.js` | Body viewport |
| `js/brain.js` | Neuron map |
| `js/import.js` | JSON / NDJSON pack |
| `js/adapters.js` | Built-in plugs |
| `js/shell.js` | Clock and `window.FlyShell` |
| `data/mapping.default.json` | Default channels |
| `data/examples/` | Drop-in packs |
| `AGENTS.md` | Agent notes and claim bans |

MaleCNS data remains CC BY 4.0 with its authors. Original code here is MIT.
