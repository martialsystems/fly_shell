/** Soma map: one GPU Points draw, 1-pixel dots, no hull. */

import * as THREE from "../vendor/three.module.js";
import {
  parseSomaPack,
  indexByType,
  fillBaseColors,
  litTypesFromNeurons,
  stripSide,
} from "./soma.js";

const FIRE = new THREE.Color(0xffd76a);
const HOT = new THREE.Color(0xfff4c8);
const SEL = new THREE.Color(0x7ee0ff);
const IDLE = new THREE.Color(0x102030);

function fireColor(rate, out) {
  const u = Math.min(1, rate);
  out.copy(IDLE).lerp(FIRE, 0.35 + 0.65 * u);
  if (u > 0.75) out.lerp(HOT, (u - 0.75) / 0.25);
  return out;
}

export class BrainView {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.04, 40);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.sortObjects = false;

    this.yaw = 0.0;
    this.pitch = 0.12;
    this.dist = 1.85;
    this.look = new THREE.Vector3(0, 0.05, 0.38);
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.selectedId = null;
    this.onPick = null;
    this.ray = new THREE.Raycaster();
    this.ray.params.Points = { threshold: 0.012 };
    this.pointer = new THREE.Vector2();
    this._tmp = new THREE.Color();
    this.pack = null;
    this.typeIndex = new Map();
    this.baseColors = null;
    this.liveColors = null;
    this._hot = [];
    this.somaCount = 0;
    this.cloud = null;
    this.atlas = null;
    this.nodes = {};
    this._firingOnly = false;

    this._bind();
    this.resize();
    this._orbit();
  }

  setAtlas(atlas) {
    this.atlas = atlas;
    this.nodes = atlas && atlas.neurons ? atlas.neurons : {};
  }

  async loadCloud(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("soma pack HTTP " + res.status);
    const buf = await res.arrayBuffer();
    this.setCloud(parseSomaPack(buf));
  }

  setCloud(pack) {
    if (this.cloud) {
      this.scene.remove(this.cloud);
      this.cloud.geometry.dispose();
      this.cloud.material.dispose();
    }
    this.pack = pack;
    this.somaCount = pack.count;
    this.typeIndex = indexByType(pack);
    this.baseColors = fillBaseColors(pack, new Float32Array(pack.count * 3));
    this.liveColors = new Float32Array(this.baseColors);
    this._hot = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pack.positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.liveColors, 3));
    geo.computeBoundingSphere();
    const mat = new THREE.PointsMaterial({
      size: 1.6,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: false,
      depthWrite: true,
    });
    this.cloud = new THREE.Points(geo, mat);
    this.cloud.frustumCulled = true;
    this.scene.add(this.cloud);
  }

  apply(neurons, mappedIds, firingOnly) {
    if (!this.liveColors || !this.pack || !this.cloud) return;
    if (firingOnly !== this._firingOnly) {
      this._firingOnly = Boolean(firingOnly);
      if (this._firingOnly) this.liveColors.fill(0);
      else this.liveColors.set(this.baseColors);
      this._hot.length = 0;
    }
    for (let h = 0; h < this._hot.length; h++) {
      const i = this._hot[h];
      if (this._firingOnly) {
        this.liveColors[i * 3] = 0;
        this.liveColors[i * 3 + 1] = 0;
        this.liveColors[i * 3 + 2] = 0;
      } else {
        this.liveColors[i * 3] = this.baseColors[i * 3];
        this.liveColors[i * 3 + 1] = this.baseColors[i * 3 + 1];
        this.liveColors[i * 3 + 2] = this.baseColors[i * 3 + 2];
      }
    }
    this._hot.length = 0;
    const lit = litTypesFromNeurons(neurons);
    for (const [key, rate] of lit) {
      const idxs = this.typeIndex.get(key);
      if (!idxs) continue;
      fireColor(rate, this._tmp);
      const r = this._tmp.r;
      const g = this._tmp.g;
      const b = this._tmp.b;
      for (let k = 0; k < idxs.length; k++) {
        const i = idxs[k];
        this.liveColors[i * 3] = r;
        this.liveColors[i * 3 + 1] = g;
        this.liveColors[i * 3 + 2] = b;
        this._hot.push(i);
      }
    }
    if (this.selectedId) {
      const selType = stripSide(this.selectedId);
      const idxs = this.typeIndex.get(selType) || this.typeIndex.get(this.selectedId);
      if (idxs && idxs.length) {
        const i = idxs[0];
        this.liveColors[i * 3] = SEL.r;
        this.liveColors[i * 3 + 1] = SEL.g;
        this.liveColors[i * 3 + 2] = SEL.b;
        this._hot.push(i);
      }
    }
    this.cloud.geometry.attributes.color.needsUpdate = true;
    this.cloud.visible = true;
  }

  _bind() {
    const el = this.canvas;
    el.addEventListener("pointerdown", (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this._moved = 0;
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this._moved += Math.abs(dx) + Math.abs(dy);
      this.yaw += dx * 0.008;
      this.pitch = Math.max(-0.9, Math.min(1.2, this.pitch + dy * 0.006));
    });
    el.addEventListener("pointerup", (e) => {
      this.dragging = false;
      if (this._moved < 6) this._pick(e);
    });
    el.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.dist = Math.max(0.45, Math.min(5.5, this.dist + e.deltaY * 0.0035));
      },
      { passive: false },
    );
  }

  _pick(e) {
    if (!this.cloud || !this.pack) {
      this.selectedId = null;
      if (this.onPick) this.onPick(null);
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.ray.setFromCamera(this.pointer, this.camera);
    const hits = this.ray.intersectObject(this.cloud, false);
    if (hits.length && hits[0].index != null) {
      const i = hits[0].index;
      const type = this.pack.types[this.pack.typeIds[i]] || String(i);
      this.selectedId = type;
      if (this.onPick) this.onPick(type);
      return;
    }
    this.selectedId = null;
    if (this.onPick) this.onPick(null);
  }

  _orbit() {
    const x = this.look.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist;
    const y = this.look.y + Math.sin(this.pitch) * this.dist;
    const z = this.look.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.look);
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  render() {
    this._orbit();
    this.renderer.render(this.scene, this.camera);
  }
}
