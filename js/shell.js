/** Chassis: clock, plug slot, mapping, two views. */

import { emptyFrame, normalizeFrame, normalizeMapping } from "./schema.js";
import { applyMapping, mergeControls, bindSource, unbindSource, ensureChannel, firingIds, sourcesForNeuron } from "./mapping.js";
import { buildAtlas, mergeAtlas, DEFAULT_MAPPING } from "./atlas.js";
import { parsePlugText, sampleTimeline, timelineDuration } from "./import.js";
import { adapterById, ADAPTERS } from "./adapters.js";
import { FlyView } from "./fly.js";
import { BrainView } from "./brain.js";

function $(id) {
  return document.getElementById(id);
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export class FlyShell {
  constructor() {
    this.atlas = buildAtlas(1);
    this.mapping = normalizeMapping(DEFAULT_MAPPING);
    this.adapter = adapterById("idle");
    this.timeline = null;
    this.t = 0;
    this.paused = false;
    this.firingOnly = false;
    this.frame = emptyFrame(0);
    this.controls = {};
    this.bindTarget = this.mapping.channels[0] ? this.mapping.channels[0].id : "walk_fwd";
    this.selectedId = null;
    this.running = false;

    this.fly = new FlyView($("body-canvas"));
    this.brain = new BrainView($("brain-canvas"));
    this.brain.setAtlas(this.atlas);
    this.brain.onPick = (id) => this.selectNeuron(id);
    this.brain.loadCloud("data/malecns_soma.bin").then(() => {
      $("app").dataset.somas = String(this.brain.somaCount);
    }).catch((err) => {
      $("import-status").textContent = String(err.message || err);
    });

    this._wireUi();
    this._renderMap();
    this._fillAdapters();
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  _wireUi() {
    $("adapter").addEventListener("change", (e) => {
      this.plug(adapterById(e.target.value));
    });
    $("btn-pause").addEventListener("click", () => this.togglePause());
    $("btn-reset").addEventListener("click", () => this.resetClock());
    $("firing-only").addEventListener("change", (e) => {
      this.firingOnly = e.target.checked;
    });
    $("file").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) this.importFile(f);
      e.target.value = "";
    });
    $("btn-paste").addEventListener("click", () => this.pasteJson());
    const drop = $("drop");
    const bodyPane = $("pane-body");
    const onDrag = (ev) => {
      ev.preventDefault();
      drop.classList.add("hot");
    };
    const onLeave = (ev) => {
      ev.preventDefault();
      drop.classList.remove("hot");
    };
    bodyPane.addEventListener("dragover", onDrag);
    bodyPane.addEventListener("dragleave", onLeave);
    bodyPane.addEventListener("drop", (ev) => {
      ev.preventDefault();
      drop.classList.remove("hot");
      const f = ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (f) this.importFile(f);
      else {
        const text = ev.dataTransfer.getData("text/plain");
        if (text) this.importText(text, "drop");
      }
    });
    $("bind-add").addEventListener("click", () => this.bindSelected());
    $("new-channel").addEventListener("submit", (e) => {
      e.preventDefault();
      const id = $("new-channel-id").value.trim();
      if (!id) return;
      this.mapping = ensureChannel(this.mapping, id);
      this.bindTarget = id;
      $("new-channel-id").value = "";
      this._renderMap();
    });
    document.querySelectorAll("[data-pane-btn]").forEach((btn) => {
      btn.addEventListener("click", () => this.showPane(btn.getAttribute("data-pane-btn")));
    });
    document.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT")) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        this.togglePause();
      }
    });
  }

  _fillAdapters() {
    const sel = $("adapter");
    sel.innerHTML = "";
    for (const a of ADAPTERS) {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.title;
      sel.appendChild(opt);
    }
    const imported = document.createElement("option");
    imported.value = "imported";
    imported.textContent = "Imported timeline";
    sel.appendChild(imported);
    sel.value = this.adapter.id;
  }

  showPane(name) {
    document.querySelectorAll("[data-pane]").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-pane") === name);
    });
    document.querySelectorAll("[data-pane-btn]").forEach((el) => {
      el.classList.toggle("on", el.getAttribute("data-pane-btn") === name);
    });
    this.resize();
  }

  plug(adapter) {
    if (this.adapter && this.adapter.stop) this.adapter.stop();
    this.adapter = adapter;
    this.timeline = null;
    this.t = 0;
    $("adapter").value = adapter.id;
    if (adapter.start) adapter.start(this._api());
    $("plug-label").textContent = adapter.title;
  }

  plugTimeline(frames, label) {
    if (this.adapter && this.adapter.stop) this.adapter.stop();
    this.adapter = { id: "imported", title: label || "Imported timeline" };
    this.timeline = frames;
    this.t = frames[0] ? frames[0].t : 0;
    $("adapter").value = "imported";
    $("plug-label").textContent = this.adapter.title;
  }

  _api() {
    return {
      t: this.t,
      atlas: this.atlas,
      mapping: this.mapping,
      emit: (frame) => {
        this.frame = normalizeFrame(frame, this.t);
      },
    };
  }

  importFile(file) {
    const reader = new FileReader();
    reader.onload = () => this.importText(String(reader.result || ""), file.name);
    reader.readAsText(file);
  }

  pasteJson() {
    const box = $("paste-box");
    box.hidden = false;
    $("paste-text").focus();
    $("paste-go").onclick = () => {
      this.importText($("paste-text").value, "paste");
      box.hidden = true;
    };
    $("paste-cancel").onclick = () => {
      box.hidden = true;
    };
  }

  importText(text, label) {
    const pack = parsePlugText(text);
    $("import-status").textContent = pack.error
      ? pack.error
      : "loaded " + pack.kind + (label ? " · " + label : "");
    if (pack.error) return;
    if (pack.atlas) this.setAtlas(mergeAtlas(this.atlas, pack.atlas));
    if (pack.mapping) {
      this.mapping = pack.mapping;
      this._renderMap();
    }
    if (pack.kind === "frame" && pack.frames.length === 1) {
      this.plugTimeline(pack.frames, label || "frame");
      this.paused = true;
      this._applyFrame(pack.frames[0]);
      this.togglePause(true);
      return;
    }
    if (pack.frames.length) this.plugTimeline(pack.frames, label || "timeline");
  }

  setAtlas(atlas) {
    this.atlas = atlas;
    this.brain.setAtlas(atlas);
  }

  setMapping(mapping) {
    this.mapping = normalizeMapping(mapping);
    this._renderMap();
  }

  selectNeuron(id) {
    this.selectedId = id;
    this.brain.selectedId = id;
    const info = $("neuron-info");
    if (!id) {
      info.textContent = "click a cell";
      return;
    }
    const meta = this.atlas.neurons[id] || { id, type: id };
    const rec = this.frame.neurons[id] || { rate: 0 };
    const bound = sourcesForNeuron(this.mapping, id, meta.type);
    info.innerHTML =
      "<strong>" +
      esc(id) +
      "</strong> · " +
      esc(meta.type || "") +
      "<br>region " +
      esc(meta.region || "none") +
      " · rate " +
      rec.rate.toFixed(2) +
      (bound.length ? "<br>mapped → " + bound.map(esc).join(", ") : "<br>unmapped");
  }

  bindSelected() {
    if (!this.selectedId) return;
    this.mapping = bindSource(this.mapping, this.bindTarget, this.selectedId, "id");
    this._renderMap();
    this.selectNeuron(this.selectedId);
  }

  unbind(channelId, source) {
    this.mapping = unbindSource(this.mapping, channelId, source);
    this._renderMap();
  }

  _renderMap() {
    const table = $("map-table");
    const rows = this.mapping.channels
      .map((ch) => {
        const chips = ch.from
          .map(
            (src) =>
              '<button type="button" class="chip" data-unbind="' +
              esc(ch.id) +
              '" data-src="' +
              esc(src) +
              '">' +
              esc(src) +
              " ×</button>",
          )
          .join("");
        const on = ch.id === this.bindTarget ? " on" : "";
        return (
          '<tr class="ch' +
          on +
          '" data-ch="' +
          esc(ch.id) +
          '">' +
          "<td><button type=\"button\" class=\"ch-pick\" data-pick=\"" +
          esc(ch.id) +
          '">' +
          esc(ch.label) +
          "</button></td>" +
          "<td class=\"from\">" +
          (chips || '<span class="empty">empty</span>') +
          "</td>" +
          "<td class=\"meta\">" +
          esc(ch.match) +
          " · " +
          esc(ch.reduce) +
          "</td>" +
          "<td class=\"val\" data-val=\"" +
          esc(ch.id) +
          "\">0.00</td>" +
          "</tr>"
        );
      })
      .join("");
    table.innerHTML =
      "<thead><tr><th>control</th><th>neurons</th><th>reduce</th><th>now</th></tr></thead><tbody>" +
      rows +
      "</tbody>";
    table.querySelectorAll("[data-pick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.bindTarget = btn.getAttribute("data-pick");
        this._renderMap();
      });
    });
    table.querySelectorAll("[data-unbind]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.unbind(btn.getAttribute("data-unbind"), btn.getAttribute("data-src"));
      });
    });
    $("bind-target").textContent = this.bindTarget;
  }

  _applyFrame(raw) {
    const frame = normalizeFrame(raw, this.t);
    const mapped = frame.skip_map ? {} : applyMapping(frame.neurons, this.mapping);
    const controls = mergeControls(mapped, frame.controls, frame.skip_map);
    this.frame = frame;
    this.controls = controls;
    this.fly.apply(frame, controls, 0);
    const mappedIds = new Set();
    for (const ch of this.mapping.channels) {
      for (const src of ch.from) mappedIds.add(src);
    }
    this.brain.apply(frame.neurons, mappedIds, this.firingOnly);
    this._paintStatus(frame, controls);
    if (this.selectedId) this.selectNeuron(this.selectedId);
  }

  _paintStatus(frame, controls) {
    const nFire = firingIds(frame.neurons).length;
    const somas = this.brain.somaCount
      ? " · " + this.brain.somaCount.toLocaleString("en-US") + " somas"
      : "";
    $("clock").textContent =
      "t " + frame.t.toFixed(2) + " s · " + nFire + " firing" + somas;
    $("hud").textContent = (frame.payload && frame.payload.hud) || "";
    for (const ch of this.mapping.channels) {
      const cell = document.querySelector('[data-val="' + ch.id + '"]');
      if (cell) cell.textContent = (controls[ch.id] || 0).toFixed(2);
    }
  }

  togglePause(forcePaused) {
    if (forcePaused === true) this.paused = true;
    else if (forcePaused === false) this.paused = false;
    else this.paused = !this.paused;
    $("btn-pause").textContent = this.paused ? "Play" : "Pause";
  }

  resetClock() {
    this.t = this.timeline && this.timeline[0] ? this.timeline[0].t : 0;
    this.fly.clock.x = 0;
    this.fly.clock.z = 0;
    this.fly.clock.y = 0;
    this.fly.clock.yaw = 0;
    this.fly.clock.airborne = false;
  }

  tick(dt) {
    if (!this.paused) this.t += dt;
    let raw;
    if (this.timeline && this.timeline.length) {
      const dur = timelineDuration(this.timeline);
      let t = this.t;
      if (dur > 0) t = this.timeline[0].t + (((this.t - this.timeline[0].t) % dur) + dur) % dur;
      raw = sampleTimeline(this.timeline, t);
    } else {
      const api = this._api();
      api.t = this.t;
      raw = this.adapter.tick ? this.adapter.tick(dt, api) : emptyFrame(this.t);
    }
    const frame = normalizeFrame(raw, this.t);
    const mapped = frame.skip_map ? {} : applyMapping(frame.neurons, this.mapping);
    const controls = mergeControls(mapped, frame.controls, frame.skip_map);
    this.frame = frame;
    this.controls = controls;
    this.fly.apply(frame, controls, this.paused ? 0 : dt);
    const mappedIds = new Set();
    for (const ch of this.mapping.channels) for (const src of ch.from) mappedIds.add(src);
    this.brain.apply(frame.neurons, mappedIds, this.firingOnly);
    this._paintStatus(frame, controls);
  }

  resize() {
    this.fly.resize();
    this.brain.resize();
  }

  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      this.tick(dt);
      this.fly.render();
      this.brain.render();
      document.getElementById("app").dataset.ready = "1";
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

export function installGlobal(shell) {
  window.FlyShell = {
    plug: (adapter) => shell.plug(adapter),
    unplug: () => shell.plug(adapterById("idle")),
    importText: (text, label) => shell.importText(text, label),
    importFrame: (obj) => shell.importText(JSON.stringify(obj), "api"),
    setMapping: (m) => shell.setMapping(m),
    getMapping: () => shell.mapping,
    getFrame: () => shell.frame,
    getControls: () => shell.controls,
    bind: (neuronId, channelId) => {
      shell.mapping = bindSource(shell.mapping, channelId || shell.bindTarget, neuronId, "id");
      shell._renderMap();
    },
    unbind: (neuronId, channelId) => shell.unbind(channelId, neuronId),
    atlas: () => shell.atlas,
    somaCount: () => shell.brain.somaCount,
    cameraDist: () => shell.brain.dist,
    wingScales: () => ({
      L: shell.fly.joints.wing_L.scale.x,
      R: shell.fly.joints.wing_R.scale.x,
    }),
  };
}
