import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  rules,
  clamp,
  isMounted,
  isRanged,
  terrainAt,
  type GameState,
  type Squad,
} from "./types";

type Part = { mesh: THREE.InstancedMesh; count: number };
type Placement = {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
};
type Smooth = { x: number; z: number; facing: number };
const factionColors = rules.factions.map((f) => new THREE.Color(f.color));
const color = new THREE.Color();
const temp = new THREE.Object3D();
const matrix = new THREE.Matrix4();
const tempV = new THREE.Vector3();
const skin = new THREE.Color("#cba77e");
const steel = new THREE.Color("#b4bdba");
const brown = new THREE.Color("#574438");
const dark = new THREE.Color("#303b37");
const gold = new THREE.Color("#c9b67f");

function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function heightAt(map: number, x: number, z: number) {
  let h = 0.14 * Math.sin(x * 0.16) * Math.cos(z * 0.12);
  for (const v of rules.maps[map].zones) {
    if (v.kind !== "hill") continue;
    const d = ((x - v.x) / v.rx) ** 2 + ((z - v.z) / v.rz) ** 2;
    h += 3.5 * Math.max(0, 1 - d) ** 2;
  }
  return h;
}
function offset(shape: string, i: number): [number, number] {
  const row = Math.floor(i / 5),
    col = i % 5;
  if (shape === "wedge") {
    const r = Math.floor(Math.sqrt(i));
    return [(i - r * r - r) * 1.35, r * 1.45 - 3];
  }
  if (shape === "circle") {
    if (i === 0) return [0, 0];
    const outer = i > 8,
      n = outer ? 16 : 8,
      a = ((outer ? i - 9 : i - 1) / n) * Math.PI * 2;
    return [
      Math.sin(a) * (outer ? 4.2 : 2.1),
      Math.cos(a) * (outer ? 4.2 : 2.1),
    ];
  }
  if (shape === "crescent") {
    const a = (col / 4) * Math.PI;
    return [Math.cos(a) * (4 + row * 0.75), Math.sin(a) * (4 + row * 0.75) - 4];
  }
  if (shape === "loose")
    return [(col - 2) * 2.25 + (row % 2) * 0.7, (row - 2) * 2.25];
  if (shape === "line")
    return [((i % 9) - 4) * 1.3, (Math.floor(i / 9) - 1) * 1.35];
  return [(col - 2) * 1.35, (row - 2) * 1.15];
}
export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(44, 1, 0.1, 650);
  canvas: HTMLCanvasElement;
  state: GameState | null = null;
  owner = -1;
  selected = new Set<number>();
  heroMode = false;
  preview = true;
  mapID = -1;
  focus = new THREE.Vector3(0, 0, 0);
  distance = 190;
  azimuth = 0.57;
  heroYaw = 0;
  heroPitch = 0.24;
  onSelect: (ids: number[], append: boolean) => void = () => {};
  onOrder: (x: number, z: number, target: number, attack: boolean) => void =
    () => {};
  onAction: (action: string) => void = () => {};
  onModeExit: () => void = () => {};
  keys = new Set<string>();
  attackMove = false;
  fps = 60;
  drawCalls = 0;
  lastHover = { x: 0, z: 0 };
  sound = false;
  private root = new THREE.Group();
  private actors = new THREE.Group();
  private effects = new THREE.Group();
  private labels: HTMLDivElement;
  private labelNodes = new Map<string, HTMLDivElement>();
  private models = new Map<string, THREE.Group>();
  private parts: Record<string, Part> = {};
  private baseGroups: THREE.Group[] = [];
  private baseFlags: THREE.Mesh[] = [];
  private outpostRings: THREE.Mesh[] = [];
  private outpostFlags: THREE.Mesh[] = [];
  private smooth = new Map<number, Smooth>();
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private mouse = new THREE.Vector2();
  private pointer = { down: false, x: 0, y: 0, button: 0 };
  private box: HTMLDivElement;
  private nextMouseLock = 0;
  private mouseLockPending = false;
  private time = 0;
  private frame = 0;
  private disposed = false;
  private last = performance.now();
  private animation = 0;
  private markers: Array<{ mesh: THREE.Mesh; life: number }> = [];
  private projectiles: Array<{
    mesh: THREE.Mesh;
    from: THREE.Vector3;
    to: THREE.Vector3;
    life: number;
    duration: number;
  }> = [];
  private shots = new Map<number, number>();
  private audio: AudioContext | null = null;
  private quality = "high";
  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.canvas = this.renderer.domElement;
    this.canvas.className = "battle-canvas";
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute(
      "aria-label",
      "3D savaş alanı. Sol tıkla birlik seç, sağ tıkla komut ver.",
    );
    host.append(this.canvas);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.scene.background = new THREE.Color("#263b34");
    this.scene.fog = new THREE.Fog("#263b34", 210, 430);
    this.scene.add(new THREE.HemisphereLight("#e5efdb", "#414b38", 2.1));
    const sun = new THREE.DirectionalLight("#fff3d4", 3.2);
    sun.position.set(-38, 145, 28);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -110;
    sun.shadow.camera.right = 110;
    sun.shadow.camera.top = 110;
    sun.shadow.camera.bottom = -110;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 260;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.45;
    this.scene.add(sun);
    this.scene.add(this.root, this.actors, this.effects);
    this.labels = document.createElement("div");
    this.labels.className = "world-labels";
    host.append(this.labels);
    this.box = document.createElement("div");
    this.box.className = "selection-box";
    host.append(this.box);
    this.makeParts();
    this.events();
    this.resize();
    window.addEventListener("resize", this.resize);
    this.animation = requestAnimationFrame(this.animate);
    this.loadAssets();
  }
  private async loadAssets() {
    const loader = new GLTFLoader();
    const files = [
      "castle/tower-square",
      "castle/wall",
      "castle/tower-hexagon-base",
      "castle/tower-hexagon-top",
      "nature/tree_pineTallA",
      "nature/tree_pineRoundA",
      "nature/tree_oak",
      "nature/tree_palm",
      "nature/rock_largeA",
      "nature/rock_largeC",
      "nature/rock_tallA",
      "nature/tent_detailedOpen",
    ];
    await Promise.all(
      files.map(async (name) => {
        try {
          const gltf = await loader.loadAsync(`/assets/${name}.glb`);
          gltf.scene.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.castShadow = true;
              o.receiveShadow = true;
              for (const mat of Array.isArray(o.material)
                ? o.material
                : [o.material]) {
                if (mat instanceof THREE.MeshStandardMaterial) {
                  mat.metalness = 0;
                  mat.roughness = 0.95;
                  if (/leaf/i.test(mat.name))
                    mat.color.set(
                      mat.name.includes("Dark") ? "#3f6548" : "#5c8151",
                    );
                  if (/wood/i.test(mat.name)) mat.color.set("#76614a");
                  if (/stone|rock|dirt/i.test(mat.name))
                    mat.color.set("#858577");
                  if (mat.name === "grass") mat.color.set("#8d967a");
                }
              }
            }
          });
          this.models.set(name, gltf.scene);
        } catch (e) {
          console.warn("Asset yüklenemedi:", name, e);
        }
      }),
    );
    if (this.mapID >= 0) this.buildMap(this.mapID);
  }
  private makeParts() {
    const defs: Record<string, THREE.BufferGeometry> = {
      body: new THREE.BoxGeometry(0.65, 0.82, 0.42),
      head: new THREE.IcosahedronGeometry(0.23, 0),
      helmet: new THREE.CylinderGeometry(0.24, 0.25, 0.25, 6),
      legs: new THREE.BoxGeometry(0.2, 0.62, 0.23),
      arms: new THREE.BoxGeometry(0.16, 0.65, 0.18),
      shield: new THREE.CylinderGeometry(0.37, 0.37, 0.1, 8),
      weapon: new THREE.BoxGeometry(0.075, 1.8, 0.075),
      blade: new THREE.BoxGeometry(0.13, 0.85, 0.06),
      mount: new THREE.BoxGeometry(0.8, 0.64, 1.5),
      mountHead: new THREE.BoxGeometry(0.33, 0.62, 0.5),
      cape: new THREE.BoxGeometry(0.6, 0.82, 0.08),
      bow: new THREE.TorusGeometry(0.43, 0.045, 4, 8, Math.PI * 1.5),
      ring: new THREE.RingGeometry(0.47, 0.56, 16),
    };
    for (const [name, geo] of Object.entries(defs)) {
      const mesh = new THREE.InstancedMesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.85,
          metalness: name === "helmet" || name === "blade" ? 0.3 : 0,
          side: name === "ring" ? THREE.DoubleSide : THREE.FrontSide,
        }),
        name === "legs" ? 5000 : 1500,
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = !["ring", "bow"].includes(name);
      mesh.receiveShadow = true;
      mesh.count = 0;
      this.parts[name] = { mesh, count: 0 };
      this.actors.add(mesh);
    }
  }
  private put(
    name: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    rx: number,
    ry: number,
    rz: number,
    c: THREE.Color,
  ) {
    const p = this.parts[name];
    const i = p.count++;
    if (i >= p.mesh.instanceMatrix.count) {
      p.count--;
      return;
    }
    temp.position.set(x, y, z);
    temp.scale.set(sx, sy, sz);
    temp.rotation.set(rx, ry, rz);
    temp.updateMatrix();
    p.mesh.setMatrixAt(i, temp.matrix);
    p.mesh.setColorAt(i, c);
  }
  private clearMap() {
    const preservedGeometry = new Set<THREE.BufferGeometry>(),
      preservedMaterials = new Set<THREE.Material>();
    for (const model of this.models.values())
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          preservedGeometry.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            preservedMaterials.add(m);
        }
      });
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        if (!preservedGeometry.has(o.geometry)) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          if (!preservedMaterials.has(m)) m.dispose();
      }
    });
    this.root.clear();
    this.baseGroups = [];
    this.baseFlags = [];
    this.outpostRings = [];
    this.outpostFlags = [];
    this.labelNodes.clear();
    this.labels.innerHTML = "";
  }
  buildMap(id: number) {
    this.mapID = id;
    this.clearMap();
    const m = rules.maps[id],
      rand = random(491 + id * 51);
    const grass = m.biome === "grass";
    const snow = m.biome === "snow";
    this.scene.background = new THREE.Color(
      grass ? "#263b34" : snow ? "#384d57" : "#4a3e34",
    );
    this.scene.fog = new THREE.Fog(
      grass ? "#263b34" : snow ? "#384d57" : "#4a3e34",
      230,
      450,
    );
    const geo = new THREE.PlaneGeometry(180, 180, 100, 100);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute("position");
    const colors = [];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      pos.setY(i, heightAt(id, x, z));
      const terrain = terrainAt(id, x, z);
      let hex = grass ? "#778260" : snow ? "#c5d1ce" : "#b59668";
      if (terrain === "forest") hex = snow ? "#aabfba" : "#5a7050";
      if (terrain === "hill")
        hex = snow ? "#d9ddce" : grass ? "#8e8e66" : "#baa578";
      if (terrain === "marsh") hex = "#657f80";
      if (terrain === "pass") hex = "#c9ad7b";
      const path = Math.min(Math.abs(x - z), Math.abs(x + z));
      if (path < 3.3 || Math.abs(Math.hypot(x, z) - 44) < 2)
        hex = snow ? "#a4b4ae" : grass ? "#b5a685" : "#d7bb88";
      c.set(hex).multiplyScalar(0.92 + rand() * 0.16);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const land = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        flatShading: true,
      }),
    );
    land.receiveShadow = true;
    this.root.add(land);
    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(181, 5, 181),
      new THREE.MeshStandardMaterial({
        color: snow ? "#4b6061" : "#3b4536",
        roughness: 1,
      }),
    );
    pedestal.position.y = -2.75;
    pedestal.receiveShadow = true;
    this.root.add(pedestal);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshStandardMaterial({
        color: grass ? "#25392f" : snow ? "#3c5158" : "#514332",
        roughness: 1,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -5.3;
    floor.receiveShadow = true;
    this.root.add(floor);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(181, 0.15, 181)),
      new THREE.LineBasicMaterial({
        color: "#b8b18d",
        transparent: true,
        opacity: 0.25,
      }),
    );
    edges.position.y = -0.15;
    this.root.add(edges);
    for (const z of m.zones) {
      if (z.kind === "forest") {
        const places: Placement[] = [];
        for (let i = 0; i < 80; i++) {
          const a = rand() * Math.PI * 2,
            r = Math.sqrt(rand()) * 0.94,
            x = z.x + Math.cos(a) * z.rx * r,
            zz = z.z + Math.sin(a) * z.rz * r;
          if (Math.min(Math.abs(x - zz), Math.abs(x + zz)) < 5) continue;
          places.push({
            x,
            y: heightAt(id, x, zz),
            z: zz,
            scale: 4 + rand() * 3.5,
            rotation: rand() * 6.28,
          });
        }
        this.assetInstances(
          snow ? "nature/tree_pineTallA" : "nature/tree_oak",
          places,
        );
      }
      if (z.kind === "marsh") {
        for (let i = 0; i < 5; i++) {
          const water = new THREE.Mesh(
            new THREE.CircleGeometry(1, 32),
            new THREE.MeshStandardMaterial({
              color: "#658b93",
              transparent: true,
              opacity: 0.65,
              roughness: 0.2,
              metalness: 0.35,
            }),
          );
          water.rotation.x = -Math.PI / 2;
          water.scale.set(
            z.rx * (0.2 + rand() * 0.3),
            z.rz * (0.4 + rand() * 0.2),
            1,
          );
          water.position.set(
            z.x + (rand() - 0.5) * z.rx,
            0.06,
            z.z + (rand() - 0.5) * z.rz,
          );
          this.root.add(water);
        }
      }
    }
    const trees: Placement[] = [];
    for (let i = 0; i < 120; i++) {
      const side = i % 4,
        x =
          side < 2
            ? (rand() - 0.5) * 175
            : (side === 2 ? -1 : 1) * (79 + rand() * 9),
        z =
          side < 2
            ? (side === 0 ? -1 : 1) * (79 + rand() * 9)
            : (rand() - 0.5) * 175;
      trees.push({
        x,
        z,
        y: heightAt(id, x, z),
        scale: grass ? 4 + rand() * 4 : 3 + rand() * 4,
        rotation: rand() * 7,
      });
    }
    this.assetInstances(
      grass
        ? "nature/tree_pineRoundA"
        : snow
          ? "nature/tree_pineTallA"
          : "nature/tree_palm",
      trees,
    );
    const stones: Placement[] = [];
    for (const o of m.obstacles) {
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * Math.PI * 2;
        stones.push({
          x: o.x + Math.cos(a) * o.r * 0.3,
          z: o.z + Math.sin(a) * o.r * 0.3,
          y: 0.1,
          scale: o.r * (j === 0 ? 2.2 : 1.6),
          rotation: a,
        });
      }
    }
    this.assetInstances(
      snow
        ? "nature/rock_largeC"
        : id === 1
          ? "nature/rock_tallA"
          : "nature/rock_largeA",
      stones,
    );
    for (let i = 0; i < 4; i++) {
      const [x, z] = [i < 2 ? -66 : 66, i % 2 === 0 ? -66 : 66];
      this.castle(i, x, z);
      const [px, pz] = [i < 2 ? -30 : 30, i % 2 === 0 ? -30 : 30];
      this.outpost(i, px, pz);
    }
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.1, 2),
        new THREE.MeshStandardMaterial({ color: "#c7bc92" }),
      );
      g.position.set(-80 + i * 20, 0.1, 90.3);
      this.root.add(g);
      const h = g.clone();
      h.rotation.y = Math.PI / 2;
      h.position.set(90.3, 0.1, -80 + i * 20);
      this.root.add(h);
    }
  }
  private assetInstances(name: string, places: Placement[]) {
    const model = this.models.get(name);
    if (!model) {
      if (name.includes("tree")) {
        const geo = new THREE.ConeGeometry(0.5, 1.5, 5);
        const mat = new THREE.MeshStandardMaterial({ color: "#455d38" });
        const inst = new THREE.InstancedMesh(geo, mat, places.length);
        places.forEach((p, i) => {
          temp.position.set(p.x, p.y + p.scale * 0.65, p.z);
          temp.rotation.set(0, p.rotation, 0);
          temp.scale.setScalar(p.scale);
          temp.updateMatrix();
          inst.setMatrixAt(i, temp.matrix);
        });
        inst.castShadow = true;
        this.root.add(inst);
      }
      return;
    }
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const inst = new THREE.InstancedMesh(
        o.geometry,
        o.material,
        places.length,
      );
      places.forEach((p, i) => {
        temp.position.set(p.x, p.y, p.z);
        temp.rotation.set(0, p.rotation, 0);
        temp.scale.setScalar(p.scale);
        temp.updateMatrix();
        matrix.multiplyMatrices(temp.matrix, o.matrixWorld);
        inst.setMatrixAt(i, matrix);
      });
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.computeBoundingSphere();
      this.root.add(inst);
    });
  }
  private asset(
    name: string,
    x: number,
    y: number,
    z: number,
    scale: number,
    rotation = 0,
  ) {
    const m = this.models.get(name);
    if (!m) return null;
    const obj = m.clone(true);
    obj.position.set(x, y, z);
    obj.scale.setScalar(scale);
    obj.rotation.y = rotation;
    return obj;
  }
  private castle(i: number, x: number, z: number) {
    const g = new THREE.Group();
    g.position.set(x, heightAt(this.mapID, x, z), z);
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(11, 12, 1, 8),
      new THREE.MeshStandardMaterial({ color: "#7a7e68", flatShading: true }),
    );
    platform.position.y = -0.1;
    platform.receiveShadow = true;
    g.add(platform);
    for (const [xx, zz] of [
      [-6, -6],
      [6, -6],
      [-6, 6],
      [6, 6],
    ]) {
      const tower = this.asset("castle/tower-square", xx, 0.2, zz, 5.5);
      if (tower) g.add(tower);
      else {
        const t = new THREE.Mesh(
          new THREE.BoxGeometry(4, 7, 4),
          new THREE.MeshStandardMaterial({ color: "#a5a792" }),
        );
        t.position.set(xx, 3.5, zz);
        t.castShadow = true;
        g.add(t);
      }
    }
    for (const [xx, zz, rot] of [
      [0, -6, 0],
      [-6, 0, Math.PI / 2],
      [6, 0, Math.PI / 2],
    ]) {
      const wall = this.asset("castle/wall", xx, 0.2, zz, 6, rot);
      if (wall) g.add(wall);
    }
    const keep = this.asset("castle/tower-hexagon-base", 0, 0.2, 0, 6);
    const top = this.asset("castle/tower-hexagon-top", 0, 8, 0, 6);
    if (keep) g.add(keep);
    if (top) g.add(top);
    const flag = this.flag(i, 0, 10, 0, 2.8);
    g.add(flag.group);
    this.baseFlags.push(flag.banner);
    this.baseGroups.push(g);
    this.root.add(g);
  }
  private flag(owner: number, x: number, y: number, z: number, scale: number) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.07, scale * 1.7, 5),
      new THREE.MeshStandardMaterial({ color: "#665b46" }),
    );
    pole.position.y = scale * 0.45;
    group.add(pole);
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(scale, 0.65 * scale, 0.04),
      new THREE.MeshStandardMaterial({
        color: owner < 0 ? "#c6bea5" : rules.factions[owner].color,
      }),
    );
    banner.position.set(scale * 0.5, scale * 0.8, 0);
    group.add(banner);
    return { group, banner };
  }
  private outpost(i: number, x: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, heightAt(this.mapID, x, z), z);
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 5, 0.6, 8),
      new THREE.MeshStandardMaterial({ color: "#8c8970" }),
    );
    p.position.y = 0.1;
    p.receiveShadow = true;
    group.add(p);
    const tower = this.asset("castle/tower-hexagon-base", 0, 0.2, 0, 3.2);
    if (tower) group.add(tower);
    const flag = this.flag(-1, 0, 5, 0, 2);
    group.add(flag.group);
    this.outpostFlags.push(flag.banner);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(7.1, 7.3, 64),
      new THREE.MeshBasicMaterial({
        color: "#d5c79c",
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    group.add(ring);
    this.outpostRings.push(ring);
    this.root.add(group);
  }
  update(state: GameState, owner: number) {
    this.state = state;
    this.owner = owner;
    this.preview = state.phase === "lobby";
    if (state.map !== this.mapID) this.buildMap(state.map);
    for (const b of state.bases) {
      const flag = this.baseFlags[b.id];
      if (flag)
        (flag.material as THREE.MeshStandardMaterial).color.set(
          b.owner < 0 ? "#8d8f83" : rules.factions[b.owner].color,
        );
      const g = this.baseGroups[b.id];
      if (g) g.scale.y = b.stage === "active" ? 1 : 0.35;
    }
    for (const o of state.outposts) {
      const col = o.owner < 0 ? "#c9c3a6" : rules.factions[o.owner].color;
      const ring = this.outpostRings[o.id];
      if (ring) (ring.material as THREE.MeshBasicMaterial).color.set(col);
      const flag = this.outpostFlags[o.id];
      if (flag) (flag.material as THREE.MeshStandardMaterial).color.set(col);
    }
    if (!this.preview)
      for (const s of state.squads) {
        if (s.attackAt > 0 && s.attackAt !== (this.shots.get(s.id) || 0)) {
          this.shots.set(s.id, s.attackAt);
          const spec = rules.factions[s.owner].units[s.class];
          if (isRanged(spec.kind) && this.projectiles.length < 100)
            this.shoot(s);
          if (this.sound && s.owner === owner && Math.random() < 0.15)
            this.tone(85, 0.04, 0.018);
        }
      }
  }
  private shoot(s: Squad) {
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.07, 1.6),
        new THREE.MeshBasicMaterial({ color: "#eedcac" }),
      );
      const from = new THREE.Vector3(
          s.x + (i - 1) * 1.6,
          heightAt(this.mapID, s.x, s.z) + 2,
          s.z,
        ),
        to = new THREE.Vector3(
          s.aimX + (i - 1) * 1.2,
          heightAt(this.mapID, s.aimX, s.aimZ) + 0.8,
          s.aimZ,
        );
      mesh.position.copy(from);
      this.effects.add(mesh);
      this.projectiles.push({
        mesh,
        from,
        to,
        life: 0,
        duration: 0.5 + from.distanceTo(to) / 80,
      });
    }
  }
  private soldier(
    x: number,
    z: number,
    facing: number,
    owner: number,
    kind: string,
    index: number,
    moving: boolean,
    attack: boolean,
    hero = false,
    block = false,
    yExtra = 0,
  ) {
    const base = heightAt(this.mapID, x, z) + yExtra;
    const mount = isMounted(kind);
    const size = hero ? 1.45 : 1;
    const y = base + (mount ? 1.1 : 0);
    const c = factionColors[owner];
    const stride = moving
      ? Math.sin(this.time * (mount ? 13 : 10) + index) * 0.55
      : Math.sin(this.time * 2 + index) * 0.02;
    const sin = Math.sin(facing),
      cos = Math.cos(facing);
    const p = (
      name: string,
      dx: number,
      dy: number,
      dz: number,
      sx = 1,
      sy = 1,
      sz = 1,
      rx = 0,
      rz = 0,
      col = c,
    ) =>
      this.put(
        name,
        x + (dx * cos + dz * sin) * size,
        y + dy * size,
        z + (-dx * sin + dz * cos) * size,
        sx * size,
        sy * size,
        sz * size,
        rx,
        facing,
        rz,
        col,
      );
    p("body", 0, 1.05, 0);
    p("head", 0, 1.68, 0, 1, 1, 1, 0, 0, skin);
    p(
      "helmet",
      0,
      1.86,
      0,
      1,
      1,
      1,
      0,
      0,
      owner === 2 || owner === 3 ? c : steel,
    );
    p("legs", -0.2, 0.4, 0, 1, 1, 1, stride, 0, dark);
    p("legs", 0.2, 0.4, 0, 1, 1, 1, -stride, 0, dark);
    p("arms", -0.42, 1.12, block ? 0.3 : 0, 1, 1, 1, block ? -1 : stride, 0, c);
    p(
      "arms",
      0.42,
      1.12,
      attack ? 0.25 : 0,
      1,
      1,
      1,
      attack ? -1.1 : -stride,
      0,
      c,
    );
    p("cape", 0, 1.05, -0.26, 1, 1, 1, stride * 0.1, 0, c);
    if (["spear", "sword", "camel"].includes(kind) || hero)
      p(
        "shield",
        -0.54,
        1.12,
        block ? 0.45 : 0.15,
        1,
        1,
        1,
        Math.PI / 2,
        0,
        owner === 0 ? steel : c,
      );
    if (["spear", "lancer", "camel"].includes(kind))
      p(
        "weapon",
        0.48,
        1.65,
        0.3,
        1,
        1,
        1,
        attack ? Math.PI / 2 : 0.1,
        0,
        gold,
      );
    else if (isRanged(kind)) p("bow", 0.5, 1.1, 0.35, 1, 1, 1, 0, 0, brown);
    else
      p(
        "blade",
        0.5,
        1.5,
        attack ? 0.6 : 0.1,
        kind === "axe" || kind === "berserker" ? 2.5 : 1,
        1,
        1,
        attack ? -1 : 0,
        0,
        steel,
      );
    if (mount) {
      this.put(
        "mount",
        x,
        base + 0.95,
        z,
        1,
        1,
        1,
        0,
        facing,
        0,
        owner === 2 ? new THREE.Color("#b49b6a") : brown,
      );
      this.put(
        "mountHead",
        x + sin * 0.7,
        base + 1.4,
        z + cos * 0.7,
        1,
        1,
        1,
        -0.3,
        facing,
        0,
        brown,
      );
      for (let j = 0; j < 4; j++) {
        const dx = (j % 2 ? 1 : -1) * 0.28,
          dz = (j < 2 ? 1 : -1) * 0.5;
        this.put(
          "legs",
          x + dx * cos + dz * sin,
          base + 0.4,
          z - dx * sin + dz * cos,
          1,
          1.2,
          1,
          j % 2 ? stride : -stride,
          facing,
          0,
          brown,
        );
      }
    }
  }
  private drawArmy(dt: number) {
    const state = this.state;
    if (!state) return;
    for (const p of Object.values(this.parts)) p.count = 0;
    const ease = 1 - Math.exp(-dt * 16);
    for (const s of state.squads) {
      if (s.alive <= 0) continue;
      let v = this.smooth.get(s.id);
      if (!v || Math.hypot(v.x - s.x, v.z - s.z) > 35) {
        v = { x: s.x, z: s.z, facing: s.facing };
        this.smooth.set(s.id, v);
      }
      const moving = Math.hypot(v.x - s.x, v.z - s.z) > 0.06;
      v.x += (s.x - v.x) * ease;
      v.z += (s.z - v.z) * ease;
      const diff = Math.atan2(
        Math.sin(s.facing - v.facing),
        Math.cos(s.facing - v.facing),
      );
      v.facing += diff * ease;
      const f = rules.factions[s.owner],
        spec = f.units[s.class],
        shape = f.formations[s.formation].shape;
      for (let i = 0; i < s.alive; i++) {
        const [ox, oz] = offset(shape, i);
        const x = v.x + ox * Math.cos(v.facing) + oz * Math.sin(v.facing),
          z = v.z - ox * Math.sin(v.facing) + oz * Math.cos(v.facing);
        this.soldier(
          x,
          z,
          v.facing,
          s.owner,
          spec.kind,
          i,
          moving,
          state.time - s.attackAt < 0.25,
        );
        if (this.selected.has(s.id))
          this.put(
            "ring",
            x,
            heightAt(this.mapID, x, z) + 0.08,
            z,
            1.3,
            1.3,
            1.3,
            -Math.PI / 2,
            0,
            0,
            factionColors[s.owner],
          );
      }
    }
    for (const h of state.heroes) {
      if (h.hp <= 0) continue;
      const id = 10000 + h.owner;
      let v = this.smooth.get(id);
      if (!v || Math.hypot(v.x - h.x, v.z - h.z) > 30) {
        v = { x: h.x, z: h.z, facing: h.facing };
        this.smooth.set(id, v);
      }
      const moving = Math.hypot(v.x - h.x, v.z - h.z) > 0.03;
      v.x += (h.x - v.x) * ease;
      v.z += (h.z - v.z) * ease;
      v.facing = h.facing;
      this.soldier(
        v.x,
        v.z,
        h.facing,
        h.owner,
        h.class === 2 ? "archer" : "sword",
        1,
        moving,
        state.time - h.attackAt < 0.3,
        true,
        h.block,
        h.y,
      );
      this.put(
        "ring",
        v.x,
        heightAt(this.mapID, v.x, v.z) + 0.1,
        v.z,
        2.2,
        2.2,
        2.2,
        -Math.PI / 2,
        0,
        0,
        gold,
      );
    }
    for (const p of Object.values(this.parts)) {
      p.mesh.count = p.count;
      p.mesh.instanceMatrix.needsUpdate = true;
      if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    }
  }
  private drawLabels() {
    const s = this.state;
    if (!s) return;
    const used = new Set<string>();
    const show = (
      id: string,
      x: number,
      y: number,
      z: number,
      html: string,
      cls: string,
    ) => {
      used.add(id);
      let node = this.labelNodes.get(id);
      if (!node) {
        node = document.createElement("div");
        this.labelNodes.set(id, node);
        this.labels.append(node);
      }
      if (node.innerHTML !== html) node.innerHTML = html;
      node.className = "world-label " + cls;
      tempV.set(x, y, z).project(this.camera);
      node.style.transform = `translate(${(tempV.x * 0.5 + 0.5) * this.canvas.clientWidth}px,${(-tempV.y * 0.5 + 0.5) * this.canvas.clientHeight}px) translate(-50%,-50%)`;
      node.style.display =
        tempV.z > 1 || Math.abs(tempV.x) > 1.2 || Math.abs(tempV.y) > 1.2
          ? "none"
          : "";
    };
    for (const b of s.bases) {
      const f = rules.factions[b.id];
      const own = s.players[this.owner]?.mainBase === b.id;
      show(
        "b" + b.id,
        b.x,
        14,
        b.z,
        `<span class="label-dot" style="background:${b.owner < 0 ? "#c2bda6" : rules.factions[b.owner].color}"></span>${this.preview ? f.name : own ? "ANA ÜS" : b.owner < 0 ? "YIKIK ÜS" : rules.factions[b.owner].name.toUpperCase()}${!this.preview && b.stage !== "active" ? ` <b>${Math.round(b.progress * 100)}%</b>` : ""}`,
        "base-label",
      );
    }
    for (const o of s.outposts)
      show(
        "o" + o.id,
        o.x,
        8 + heightAt(this.mapID, o.x, o.z),
        o.z,
        `<span class="outpost-diamond" style="color:${o.owner < 0 ? "#e2d0a5" : rules.factions[o.owner].color}">${o.id + 1}</span><span>${o.contested ? "ÇEKİŞMELİ" : o.progress > 0 ? `${Math.round(o.progress * 100)}%` : "+25"}</span>`,
        "outpost-label",
      );
    if (!this.preview)
      for (const u of s.squads) {
        if (u.alive <= 0) continue;
        const v = this.smooth.get(u.id) ?? u;
        const own = u.owner === this.owner;
        const selected = this.selected.has(u.id);
        const max = rules.factions[u.owner].units[u.class].hp * 25;
        show(
          "s" + u.id,
          v.x,
          4.2 + heightAt(this.mapID, v.x, v.z),
          v.z,
          `<span class="squad-name">${selected ? rules.factions[u.owner].units[u.class].short : ""} <b>${u.alive}</b>${u.notice > s.time ? "<em>!</em>" : ""}</span><span class="world-hp"><i style="width:${(u.hp / max) * 100}%;background:${own ? "#c9dfb2" : rules.factions[u.owner].color}"></i></span>`,
          `${selected ? "selected " : ""}${own ? "friendly" : "enemy"}`,
        );
      }
    for (const [id, n] of this.labelNodes)
      if (!used.has(id)) {
        n.remove();
        this.labelNodes.delete(id);
      }
    this.labels.classList.toggle("hero-labels", this.heroMode);
  }
  private updateCamera(dt: number) {
    if (this.heroMode && this.state) {
      const h = this.state.heroes.find((h) => h.owner === this.owner);
      if (h) {
        const p = this.smooth.get(10000 + h.owner) ?? h;
        const yaw = this.heroYaw;
        const dist = 10;
        const look = new THREE.Vector3(
          p.x,
          heightAt(this.mapID, p.x, p.z) + 2.4 + h.y,
          p.z,
        );
        const goal = new THREE.Vector3(
          p.x - Math.sin(yaw) * dist,
          look.y + 3.2 + this.heroPitch * 8,
          p.z - Math.cos(yaw) * dist,
        );
        const direction = goal.clone().sub(look).normalize();
        let boom = look.distanceTo(goal);
        const blockers = [
          ...this.state.bases.map((b) => ({ x: b.x, z: b.z, r: 11 })),
          ...rules.maps[this.mapID].obstacles,
        ];
        for (const b of blockers) {
          const sphere = new THREE.Sphere(new THREE.Vector3(b.x, 4, b.z), b.r);
          const hit = new THREE.Ray(look, direction).intersectSphere(
            sphere,
            new THREE.Vector3(),
          );
          if (hit)
            boom = Math.min(boom, Math.max(1.6, look.distanceTo(hit) - 0.6));
        }
        goal.copy(look).addScaledVector(direction, boom);
        goal.y = Math.max(goal.y, heightAt(this.mapID, goal.x, goal.z) + 1.5);
        this.camera.position.lerp(goal, 1 - Math.exp(-dt * 12));
        this.camera.lookAt(
          look.x + Math.sin(yaw) * 4,
          look.y + 1 - this.heroPitch * 4,
          look.z + Math.cos(yaw) * 4,
        );
        return;
      }
    }
    if (!this.preview) {
      const speed = this.distance * dt * 0.65;
      let x = 0,
        z = 0;
      if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) z -= 1;
      if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) z += 1;
      if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
      if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
      this.focus.x = clamp(
        this.focus.x +
          (x * Math.cos(this.azimuth) + z * Math.sin(this.azimuth)) * speed,
        -85,
        85,
      );
      this.focus.z = clamp(
        this.focus.z +
          (-x * Math.sin(this.azimuth) + z * Math.cos(this.azimuth)) * speed,
        -85,
        85,
      );
      if (this.keys.has("KeyQ")) this.azimuth += dt * 0.7;
      if (this.keys.has("KeyE")) this.azimuth -= dt * 0.7;
    }
    const goal = new THREE.Vector3(
      this.focus.x + Math.sin(this.azimuth) * this.distance * 0.72,
      this.distance * 0.86,
      this.focus.z + Math.cos(this.azimuth) * this.distance * 0.72,
    );
    this.camera.position.lerp(goal, this.frame < 2 ? 1 : 1 - Math.exp(-dt * 7));
    this.camera.lookAt(this.focus);
  }
  private animate = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.frame++;
    this.fps = this.fps * 0.97 + (1 / Math.max(dt, 0.001)) * 0.03;
    this.updateCamera(dt);
    this.drawArmy(dt);
    if (this.frame % 3 === 0) this.drawLabels();
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i];
      m.life -= dt;
      m.mesh.scale.setScalar(1 + (1 - m.life) * 2);
      (m.mesh.material as THREE.MeshBasicMaterial).opacity = m.life * 0.7;
      if (m.life <= 0) {
        this.effects.remove(m.mesh);
        m.mesh.geometry.dispose();
        (m.mesh.material as THREE.Material).dispose();
        this.markers.splice(i, 1);
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life += dt;
      const t = clamp(p.life / p.duration, 0, 1);
      p.mesh.position.lerpVectors(p.from, p.to, t);
      p.mesh.position.y += Math.sin(t * Math.PI) * 4;
      p.mesh.lookAt(p.to);
      if (t === 1) {
        this.effects.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(i, 1);
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.drawCalls = this.renderer.info.render.calls;
    this.animation = requestAnimationFrame(this.animate);
  };
  resize = () => {
    const w = this.canvas.parentElement!.clientWidth,
      h = this.canvas.parentElement!.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
  private point(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.set(
      ((clientX - r.left) / r.width) * 2 - 1,
      (-(clientY - r.top) / r.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.mouse, this.camera);
    const hit = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.plane, hit) ? hit : null;
  }
  private target(x: number, z: number) {
    let best = 9,
      target = -1;
    for (const s of this.state?.squads ?? []) {
      if (s.owner === this.owner || s.alive <= 0) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < best) {
        best = d;
        target = s.id;
      }
    }
    if (target < 0)
      for (const b of this.state?.bases ?? [])
        if (b.owner !== this.owner && Math.hypot(b.x - x, b.z - z) < 13)
          target = 1000 + b.id;
    return target;
  }
  marker(x: number, z: number, attack = false) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 1.7, 32),
      new THREE.MeshBasicMaterial({
        color: attack ? "#e88d70" : "#d8e5b3",
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, heightAt(this.mapID, x, z) + 0.2, z);
    this.effects.add(mesh);
    this.markers.push({ mesh, life: 1 });
    if (this.sound) this.tone(attack ? 180 : 370, 0.07, 0.03);
  }
  private events() {
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.canvas.addEventListener("pointerdown", (e) => {
      this.canvas.focus();
      if (this.heroMode) {
        if (e.button === 0) this.onAction("attack");
        if (e.button === 0) this.requestMouseLock();
        if (e.button === 2) this.keys.add("Block");
        return;
      }
      this.pointer = {
        down: true,
        x: e.clientX,
        y: e.clientY,
        button: e.button,
      };
      if (e.button === 1) this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (this.heroMode) {
        if (
          document.pointerLockElement === this.canvas ||
          (e.buttons & 1) !== 0
        ) {
          this.heroYaw -= e.movementX * 0.0025;
          this.heroPitch = clamp(
            this.heroPitch + e.movementY * 0.002,
            -0.15,
            0.8,
          );
        }
        return;
      }
      const p = this.point(e.clientX, e.clientY);
      if (p) this.lastHover = { x: p.x, z: p.z };
      if (!this.pointer.down) return;
      if (this.pointer.button === 1) {
        this.focus.x -= e.movementX * 0.15;
        this.focus.z -= e.movementY * 0.15;
        return;
      }
      if (
        this.pointer.button === 0 &&
        Math.hypot(e.clientX - this.pointer.x, e.clientY - this.pointer.y) > 6
      ) {
        this.box.style.display = "block";
        this.box.style.left = Math.min(e.clientX, this.pointer.x) + "px";
        this.box.style.top = Math.min(e.clientY, this.pointer.y) + "px";
        this.box.style.width = Math.abs(e.clientX - this.pointer.x) + "px";
        this.box.style.height = Math.abs(e.clientY - this.pointer.y) + "px";
      }
    });
    window.addEventListener("pointerup", (e) => {
      if (this.heroMode) {
        if (e.button === 2) this.keys.delete("Block");
        return;
      }
      if (!this.pointer.down) return;
      this.pointer.down = false;
      this.box.style.display = "none";
      if (this.preview) return;
      const p = this.point(e.clientX, e.clientY);
      if (!p) return;
      if (
        this.pointer.button === 2 ||
        (this.pointer.button === 0 && this.attackMove)
      ) {
        const t = this.target(p.x, p.z);
        this.onOrder(p.x, p.z, t, this.attackMove || t >= 0);
        this.marker(p.x, p.z, this.attackMove || t >= 0);
        this.attackMove = false;
        return;
      }
      if (this.pointer.button === 0) {
        const dragged =
          Math.hypot(e.clientX - this.pointer.x, e.clientY - this.pointer.y) >
          7;
        const ids: number[] = [];
        let nearest = 10,
          id = -1;
        for (const s of this.state?.squads ?? []) {
          if (s.owner !== this.owner || s.alive <= 0) continue;
          if (dragged) {
            tempV.set(s.x, 1, s.z).project(this.camera);
            const x = (tempV.x * 0.5 + 0.5) * this.canvas.clientWidth,
              y = (-tempV.y * 0.5 + 0.5) * this.canvas.clientHeight;
            if (
              x >= Math.min(e.clientX, this.pointer.x) &&
              x <= Math.max(e.clientX, this.pointer.x) &&
              y >= Math.min(e.clientY, this.pointer.y) &&
              y <= Math.max(e.clientY, this.pointer.y)
            )
              ids.push(s.id);
          } else {
            const d = Math.hypot(s.x - p.x, s.z - p.z);
            if (d < nearest) {
              nearest = d;
              id = s.id;
            }
          }
        }
        if (!dragged && id >= 0) ids.push(id);
        this.onSelect(ids, e.shiftKey);
      }
    });
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (!this.heroMode)
          this.distance = clamp(this.distance + e.deltaY * 0.06, 25, 225);
      },
      { passive: false },
    );
    window.addEventListener("keydown", (e) => {
      if (
        (e.target as HTMLElement)?.matches("input,select,textarea") ||
        document.querySelector(".modal-backdrop")
      )
        return;
      this.keys.add(e.code);
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (this.heroMode && !e.repeat) {
        if (e.code === "Space") this.onAction("jump");
        if (e.code === "ShiftLeft" || e.code === "ShiftRight")
          this.onAction("dodge");
        if (e.code === "KeyQ") this.onAction("skill");
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.pointer.down = false;
      this.box.style.display = "none";
    });
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement !== this.canvas) this.keys.clear();
    });
  }
  requestMouseLock() {
    const now = performance.now();
    if (
      !this.heroMode ||
      document.pointerLockElement === this.canvas ||
      this.mouseLockPending ||
      now < this.nextMouseLock
    )
      return;
    this.nextMouseLock = now + 2000;
    this.mouseLockPending = true;
    try {
      Promise.resolve(this.canvas.requestPointerLock())
        .catch(() => {})
        .finally(() => {
          this.mouseLockPending = false;
        });
    } catch {
      this.mouseLockPending = false;
    }
  }
  enterHero() {
    const h = this.state?.heroes.find((h) => h.owner === this.owner);
    if (!h) return;
    this.heroMode = true;
    this.heroYaw = h.facing;
    this.heroPitch = 0.24;
    this.keys.clear();
    this.requestMouseLock();
    this.canvas.focus();
  }
  exitHero() {
    this.heroMode = false;
    this.keys.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    const h = this.state?.heroes.find((h) => h.owner === this.owner);
    if (h) {
      this.focus.set(h.x, 0, h.z);
      this.distance = 65;
    }
  }
  heroInput() {
    let x = 0,
      z = 0;
    if (this.keys.has("KeyW")) z += 1;
    if (this.keys.has("KeyS")) z -= 1;
    if (this.keys.has("KeyA")) x -= 1;
    if (this.keys.has("KeyD")) x += 1;
    const l = Math.max(1, Math.hypot(x, z));
    return {
      x: (x * Math.cos(this.heroYaw) + z * Math.sin(this.heroYaw)) / l,
      z: (-x * Math.sin(this.heroYaw) + z * Math.cos(this.heroYaw)) / l,
      facing: this.heroYaw,
      block: this.keys.has("Block"),
    };
  }
  focusBase() {
    const b = this.state?.bases.find(
      (b) => b.id === this.state?.players[this.owner]?.mainBase,
    );
    if (b) {
      this.focus.set(b.x * 0.75, 0, b.z * 0.75);
      this.distance = 85;
    }
  }
  focusPoint(x: number, z: number) {
    this.focus.set(x, 0, z);
    if (this.preview) this.distance = 190;
  }
  setQuality(q: string) {
    this.quality = q;
    this.renderer.setPixelRatio(
      q === "low" ? 1 : Math.min(devicePixelRatio, 1.7),
    );
    this.renderer.shadowMap.enabled = q !== "low";
    this.resize();
  }
  setSound(on: boolean) {
    this.sound = on;
    if (on) {
      this.audio ??= new AudioContext();
      this.audio.resume();
      this.tone(260, 0.12, 0.03);
    }
  }
  private tone(freq: number, length: number, volume: number) {
    if (!this.audio) return;
    const o = this.audio.createOscillator(),
      g = this.audio.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, this.audio.currentTime);
    g.gain.setValueAtTime(volume, this.audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.audio.currentTime + length);
    o.connect(g);
    g.connect(this.audio.destination);
    o.start();
    o.stop(this.audio.currentTime + length);
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animation);
    window.removeEventListener("resize", this.resize);
    this.renderer.dispose();
    this.audio?.close();
  }
}
