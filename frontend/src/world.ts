import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Characters, outfit } from "./characters";
import { heroMovement, movementClip } from "./hero-controls";
import { HeroTrack } from "./hero-track";
import { attackProgress } from "./attack-motion";
import { swordLabels, swordMotion, swordPhase, swordSteps } from "./sword-chain";
import { ActorVisibility } from "./actor-visibility";
import { addInstanceFade, crowdVisibility } from "./visibility";
import {
  rules,
  clamp,
  isMounted,
  isRanged,
  terrainAt,
  type GameState,
  type Squad,
  type ShotVisual,
} from "./types";

type Part = {
  mesh: THREE.InstancedMesh;
  count: number;
  visibility: THREE.InstancedBufferAttribute;
};
type BodyView = {
  x: number;
  z: number;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  phase: number;
  fade: number;
  seen: number;
};
type Placement = {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
};
type Smooth = { x: number; z: number; facing: number };
type HeroView = Smooth & { y: number; dx: number; dz: number };
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
const distantMountParts: Record<string, string> = {
  horseBody: "horseBodyFar",
  horseLimb: "horseLimbFar",
  horseNeck: "horseNeckFar",
  horseHead: "horseHeadFar",
  horseEar: "horseEarFar",
};

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
  onInput: () => void = () => {};
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
  private orbitPointer: number | null = null;
  private orbitX = 0;
  private orbitY = 0;
  private heroTracks = new Map<number, HeroTrack>();
  private heroViews = new Map<number, HeroView>();
  private heroBoom = 0;
  private time = performance.now() / 1000;
  private frame = 0;
  private disposed = false;
  private last = performance.now();
  private animation = 0;
  private markers: Array<{ mesh: THREE.Mesh; life: number }> = [];
  private projectiles: Array<{
    from: THREE.Vector3;
    to: THREE.Vector3;
    shot: ShotVisual;
  }> = [];
  private arrows = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.07, 0.07, 1.6),
    new THREE.MeshBasicMaterial({ color: 0xeedcac }),
    128,
  );
  private shots = new Map<number, number>();
  private audio: AudioContext | null = null;
  private quality = "high";
  private characters = new Characters();
  private actorVisibility = new ActorVisibility();
  private snapshotAt = 0;
  private hits = new Map<number, number>();
  private fallen: Array<{
    id: string;
    x: number;
    z: number;
    facing: number;
    owner: number;
    kind: string;
    at: number;
    hero: boolean;
    heroClass?: number;
  }> = [];
  private deathID = 0;
  private heroMotion = new Map<
    number,
    { x: number; z: number; phase: number; wasAir: boolean; landed: number }
  >();
  private feedbackUntil = 0;
  private feedbackText = "";
  private feedbackKind = "";
  private cameraKick = 0;
  private footstep = 0;
  private bodies = new Map<number, BodyView>();
  private bodySpan = 0.1;
  private soldierHits = new Map<number, number>();
  private drawVisibility = 1;
  private heroSight = new THREE.Vector3();
  private cameraLook = new THREE.Vector3();
  private cameraGoal = new THREE.Vector3();
  private cameraDirection = new THREE.Vector3();
  private struck: {
    key: number;
    x: number;
    z: number;
    at: number;
    damage: number;
    label: string;
  } | null = null;
  private targetLabel: HTMLDivElement;
  private swing: THREE.Mesh | null = null;
  private sparks: Array<{
    mesh: THREE.Mesh;
    vx: number;
    vy: number;
    vz: number;
    life: number;
  }> = [];
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
    const cue = document.createElement("div");
    cue.id = "hero-feedback";
    cue.className = "hero-feedback hidden";
    host.append(cue);
    this.targetLabel = document.createElement("div");
    this.targetLabel.className = "soldier-impact hidden";
    host.append(this.targetLabel);
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
    this.arrows.count = 0;
    this.arrows.frustumCulled = false;
    this.arrows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.arrows);
    this.scene.add(this.characters.group);
    this.characters
      .load()
      .then(() => {
        this.canvas.dataset.characters = "rigged";
      })
      .catch((error) => {
        this.canvas.dataset.characters = "fallback";
        console.warn(
          "Karakter modelleri yüklenemedi; temel modeller kullanılacak.",
          error,
        );
      });
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
      horseBody: new THREE.SphereGeometry(1, 10, 7),
      horseLimb: new THREE.CapsuleGeometry(0.095, 0.42, 3, 6),
      horseNeck: new THREE.CapsuleGeometry(0.21, 0.55, 3, 7),
      horseHead: new THREE.SphereGeometry(1, 8, 6),
      horseEar: new THREE.ConeGeometry(0.09, 0.28, 5),
      horseHoof: new THREE.BoxGeometry(0.19, 0.16, 0.27),
      saddle: new THREE.BoxGeometry(0.75, 0.13, 0.7),
      // Same articulated gait at distance; fewer rounded surfaces per horse.
      horseBodyFar: new THREE.SphereGeometry(1, 6, 4),
      horseLimbFar: new THREE.BoxGeometry(0.19, 0.61, 0.19),
      horseNeckFar: new THREE.CapsuleGeometry(0.21, 0.55, 2, 4),
      horseHeadFar: new THREE.SphereGeometry(1, 6, 4),
      horseEarFar: new THREE.ConeGeometry(0.09, 0.28, 3),
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
        name.startsWith("horseLimb")
          ? 8800
          : name === "horseHoof"
            ? 4400
            : name.startsWith("horseBody")
              ? 3300
              : name.startsWith("horseHead") ||
                  name.startsWith("horseNeck") ||
                  name.startsWith("horseEar") ||
                  name === "saddle"
                ? 2200
                : name === "legs"
                  ? 5000
                  : 1500,
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(mesh.instanceMatrix.count * 3),
        3,
      ).setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = !["ring", "bow"].includes(name);
      mesh.receiveShadow = true;
      mesh.count = 0;
      const visibility = new THREE.InstancedBufferAttribute(
        new Float32Array(mesh.instanceMatrix.count).fill(1),
        1,
      ).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute("visibility", visibility);
      addInstanceFade(mesh.material as THREE.Material);
      mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
      });
      addInstanceFade(mesh.customDepthMaterial);
      this.parts[name] = { mesh, count: 0, visibility };
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
    p.visibility.setX(i, this.drawVisibility);
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
    const previous = this.state;
    if (!previous || previous.room !== state.room || state.phase === "lobby") {
      this.fallen.length = 0;
      this.hits.clear();
      this.shots.clear();
      this.projectiles.length = 0;
      this.arrows.count = 0;
      this.heroMotion.clear();
      this.heroTracks.clear();
      this.heroViews.clear();
      this.heroBoom = 0;
      this.feedbackUntil = 0;
      this.bodies.clear();
      this.soldierHits.clear();
      this.struck = null;
    } else {
      for (const squad of state.squads) {
        const old = previous.squads.find((s) => s.id === squad.id);
        if (!old) continue;
        const exactHit = state.heroes.some(
          (h) =>
            (h.impactAt || 0) >
              (previous.heroes.find((p) => p.owner === h.owner)?.impactAt ||
                0) &&
            h.hitTargets?.some(
              (t) => t.kind === "soldier" && t.id === squad.id,
            ),
        );
        if (squad.hp < old.hp) {
          if (squad.hitSlots && squad.flash !== old.flash) {
            for (let slot = 0; slot < 25; slot++)
              if (squad.hitSlots & (1 << slot))
                this.soldierHits.set(squad.id * 32 + slot, this.time);
          } else if (!exactHit) this.hits.set(squad.id, this.time);
        }
        if (squad.alive < old.alive) {
          const shape =
            rules.factions[old.owner].formations[old.formation].shape;
          const smooth = this.smooth.get(old.id) || old;
          const live = new Set(
            squad.slots ?? Array.from({ length: squad.alive }, (_, i) => i),
          );
          for (const i of old.slots ??
            Array.from({ length: old.alive }, (_, i) => i)) {
            if (live.has(i)) continue;
            const [ox, oz] = offset(shape, i);
            const body = this.bodies.get(old.id * 32 + i);
            this.fallen.push({
              id: `fallen-${this.deathID++}`,
              x:
                body?.x ??
                smooth.x +
                  ox * Math.cos(smooth.facing) +
                  oz * Math.sin(smooth.facing),
              z:
                body?.z ??
                smooth.z -
                  ox * Math.sin(smooth.facing) +
                  oz * Math.cos(smooth.facing),
              facing: smooth.facing,
              owner: old.owner,
              kind: rules.factions[old.owner].units[old.class].kind,
              at: this.time + (i % 4) * 0.035,
              hero: false,
            });
          }
        }
      }
      for (const hero of state.heroes) {
        const old = previous.heroes.find((h) => h.owner === hero.owner);
        if ((hero.impactAt || 0) > (old?.impactAt || 0))
          for (const hit of hero.hitTargets ?? []) {
            if (hit.kind !== "soldier") continue;
            const key = hit.id * 32 + hit.slot;
            this.soldierHits.set(key, this.time);
            if (hero.owner === owner && this.heroMode) {
              const squad = state.squads.find((s) => s.id === hit.id);
              const label = squad
                ? rules.factions[squad.owner].units[squad.class].short
                : "Asker";
              this.struck = {
                key,
                x: hit.x,
                z: hit.z,
                at: this.time,
                damage: hit.damage,
                label,
              };
            }
          }
        if (old && hero.owner === owner && this.heroMode) {
          if (hero.attackAt > 0 && hero.attackAt !== old.attackAt)
            this.combatSound("swing");
          if ((hero.impactAt || 0) > (old.impactAt || 0)) {
            const blocked = hero.impactKind === "block";
            this.feedbackText = blocked
              ? "KALKANA ÇARPTI"
              : `İSABET · ${Math.round(hero.impactDamage || 0)}`;
            this.feedbackKind = blocked ? "block" : "hit";
            this.feedbackUntil = this.time + 0.55;
            this.cameraKick = blocked ? 0.08 : 0.13;
            this.burst(hero.impactX ?? hero.x, hero.impactZ ?? hero.z, blocked);
            this.combatSound(blocked ? "block" : "hit");
          } else if (hero.hp < old.hp) {
            const blocked = (hero.blockAt || 0) > (old.blockAt || 0);
            this.feedbackText = blocked ? "BLOK" : "DARBE ALDIN";
            this.feedbackKind = blocked ? "block" : "hurt";
            this.feedbackUntil = this.time + 0.45;
            this.cameraKick = blocked ? 0.06 : 0.16;
            this.burst(hero.x, hero.z, blocked);
            this.combatSound(blocked ? "block" : "hit");
          }
        }
        if (old && hero.hp < old.hp)
          this.hits.set(10000 + hero.owner, this.time);
        if (old && old.hp > 0 && hero.hp <= 0)
          this.fallen.push({
            id: `fallen-${this.deathID++}`,
            x: old.x,
            z: old.z,
            facing: old.facing,
            owner: old.owner,
            kind: old.class === 2 ? "archer" : "sword",
            at: this.time,
            hero: true,
            heroClass: old.class,
          });
      }
      if (this.fallen.length > 96)
        this.fallen.splice(0, this.fallen.length - 96);
    }
    const now = performance.now() / 1000,
      alpha = clamp((now - this.snapshotAt) / this.bodySpan, 0, 1);
    for (const h of state.heroes) {
      let track = this.heroTracks.get(h.owner);
      if (!track) {
        track = new HeroTrack();
        this.heroTracks.set(h.owner, track);
      }
      track.push(now, h);
    }
    for (const [key, qx, qz] of state.crowd ?? []) {
      const x = qx / 100,
        z = qz / 100;
      let body = this.bodies.get(key);
      if (!body || Math.hypot(body.toX - x, body.toZ - z) > 30) {
        body = {
          x,
          z,
          fromX: x,
          fromZ: z,
          toX: x,
          toZ: z,
          phase: 0,
          fade: 1,
          seen: now,
        };
        this.bodies.set(key, body);
      } else {
        body.fromX = body.fromX + (body.toX - body.fromX) * alpha;
        body.fromZ = body.fromZ + (body.toZ - body.fromZ) * alpha;
        body.toX = x;
        body.toZ = z;
        body.seen = now;
      }
    }
    for (const [key, body] of this.bodies)
      if (now - body.seen > 8) this.bodies.delete(key);
    for (const [key, at] of this.soldierHits)
      if (now - at > 2) this.soldierHits.delete(key);
    this.bodySpan = clamp(
      state.time - (previous?.time ?? state.time - 0.1),
      0.05,
      0.2,
    );
    this.state = state;
    this.snapshotAt = now;
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
    if (!this.preview) {
      for (const s of state.squads) {
        if (s.attackSlots !== undefined) {
          if (s.volley?.length) this.acceptVolley(s.id, s.volley);
        } else if (
          s.attackAt > 0 &&
          s.attackAt !== (this.shots.get(s.id) || 0)
        ) {
          this.shots.set(s.id, s.attackAt);
          if (isRanged(rules.factions[s.owner].units[s.class].kind))
            this.shoot(s);
        }
        if (
          this.sound &&
          s.owner === owner &&
          s.attackAt > 0 &&
          s.attackAt !==
            previous?.squads.find((p) => p.id === s.id)?.attackAt &&
          Math.random() < 0.15
        )
          this.tone(85, 0.04, 0.018);
      }
      for (const h of state.heroes)
        if (h.volley?.length) this.acceptVolley(-1 - h.owner, h.volley);
    }
  }
  private acceptVolley(key: number, volley: ShotVisual[]) {
    const stamp = volley[0].at;
    if (this.shots.get(key) === stamp) return;
    this.shots.set(key, stamp);
    for (const shot of volley) this.addProjectile(shot);
  }
  private addProjectile(shot: ShotVisual) {
    if (this.projectiles.length >= 128 || shot.land <= this.serverNow()) return;
    this.projectiles.push({
      shot,
      from: new THREE.Vector3(
        shot.fromX,
        heightAt(this.mapID, shot.fromX, shot.fromZ) + shot.height,
        shot.fromZ,
      ),
      to: new THREE.Vector3(
        shot.x,
        heightAt(this.mapID, shot.x, shot.z) + 1.1,
        shot.z,
      ),
    });
  }
  // Compatibility for an older server; current servers supply launch/arrival times.
  private shoot(s: Squad) {
    const at = this.serverNow();
    for (let i = 0; i < 3; i++)
      this.addProjectile({
        at,
        land: at + 0.5 + Math.hypot(s.aimX - s.x, s.aimZ - s.z) / 80,
        fromX: s.x + (i - 1) * 1.6,
        fromZ: s.z,
        height: 2,
        x: s.aimX + (i - 1) * 1.2,
        z: s.aimZ,
        kind: "",
        id: 0,
        slot: -1,
      });
  }
  private serverNow() {
    return (
      (this.state?.time || 0) +
      (this.preview ? 0 : Math.min(0.15, this.time - this.snapshotAt))
    );
  }
  private drawProjectiles() {
    const now = this.serverNow();
    let count = 0;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i],
        s = p.shot;
      if (now >= s.land) {
        this.projectiles[i] = this.projectiles[this.projectiles.length - 1];
        this.projectiles.pop();
        continue;
      }
      if (now < s.at) continue;
      const target =
        s.kind === "soldier"
          ? this.bodies.get(s.id * 32 + s.slot)
          : s.kind === "hero"
            ? this.heroViews.get(s.id)
            : undefined;
      if (target)
        p.to.set(
          target.x,
          heightAt(this.mapID, target.x, target.z) + 1.1,
          target.z,
        );
      const t = clamp((now - s.at) / (s.land - s.at), 0, 1);
      temp.position.lerpVectors(p.from, p.to, t);
      temp.position.y +=
        Math.sin(t * Math.PI) * Math.min(4, p.from.distanceTo(p.to) * 0.15);
      temp.scale.setScalar(1);
      temp.lookAt(p.to);
      temp.updateMatrix();
      this.arrows.setMatrixAt(count++, temp.matrix);
    }
    this.arrows.count = count;
    this.arrows.visible = count > 0;
    if (count) {
      this.arrows.instanceMatrix.clearUpdateRanges();
      this.arrows.instanceMatrix.addUpdateRange(0, count * 16);
      this.arrows.instanceMatrix.needsUpdate = true;
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
        x + dx * cos + dz * sin,
        y + dy,
        z - dx * sin + dz * cos,
        sx,
        sy,
        sz,
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
  private drawMount(
    x: number,
    z: number,
    facing: number,
    owner: number,
    camel: boolean,
    moving: boolean,
    index: number,
  ) {
    const base = heightAt(this.mapID, x, z),
      sin = Math.sin(facing),
      cos = Math.cos(facing);
    const coat = color.set(
      camel
        ? "#b49a72"
        : ["#574334", "#8a6650", "#42403b", "#a08d75"][index % 4],
    );
    const stride = moving
      ? this.time * 11 + index * 0.8
      : this.time * 1.4 + index;
    const bob = moving ? Math.cos(stride * 2) * 0.055 : 0;
    const far =
      (x - this.camera.position.x) ** 2 +
        (base - this.camera.position.y) ** 2 +
        (z - this.camera.position.z) ** 2 >
      900;
    const p = (
      name: string,
      dx: number,
      dy: number,
      dz: number,
      sx: number,
      sy: number,
      sz: number,
      rx = 0,
      c = coat,
    ) =>
      this.put(
        far ? distantMountParts[name] || name : name,
        x + dx * cos + dz * sin,
        base + dy + bob,
        z - dx * sin + dz * cos,
        sx,
        sy,
        sz,
        rx,
        facing,
        0,
        c,
      );
    p("horseBody", 0, 1.17, 0, 0.43, 0.45, 0.95);
    p("horseBody", 0, 1.1, -0.6, 0.44, 0.42, 0.43);
    p(
      "horseNeck",
      0,
      camel ? 1.78 : 1.65,
      0.7,
      camel ? 0.8 : 1,
      camel ? 1.45 : 1,
      1,
      -0.35,
    );
    p(
      "horseHead",
      0,
      camel ? 2.35 : 2.05,
      camel ? 1.06 : 0.96,
      0.19,
      0.24,
      0.43,
      -0.2,
    );
    p(
      "horseHead",
      0,
      camel ? 2.23 : 1.93,
      camel ? 1.38 : 1.3,
      0.16,
      0.14,
      0.24,
      -0.18,
    );
    p("horseEar", -0.14, camel ? 2.59 : 2.34, 0.88, 1, 1, 1, 0.15);
    p("horseEar", 0.14, camel ? 2.59 : 2.34, 0.88, 1, 1, 1, 0.15);
    if (camel) p("horseBody", 0, 1.62, -0.18, 0.28, 0.34, 0.38);
    else p("cape", 0, 1.9, 0.56, 0.22, 0.74, 1.2, -0.35, dark);
    p("saddle", 0, 1.56, -0.08, 1.12, 1, 1.3, 0, factionColors[owner]);
    p("saddle", 0, 1.68, -0.08, 0.72, 1, 0.75, 0, brown);
    p(
      "horseNeck",
      0,
      0.98,
      -0.96,
      0.22,
      0.85,
      0.35,
      -0.6 + Math.sin(stride) * 0.1,
      dark,
    );
    for (let j = 0; j < 4; j++) {
      const side = j % 2 ? 1 : -1,
        front = j < 2 ? 1 : -1;
      const phase = stride + (j === 0 || j === 3 ? 0 : Math.PI);
      const swing = moving ? Math.sin(phase) * 0.55 : 0;
      const knee = moving ? Math.max(0, Math.cos(phase)) * 0.5 : 0.08;
      const dx = side * 0.3,
        hipZ = front * 0.61;
      p(
        "horseLimb",
        dx,
        0.78,
        hipZ + Math.sin(swing) * 0.18,
        1.25,
        0.95,
        1.15,
        swing,
      );
      p(
        "horseLimb",
        dx,
        0.36 + knee * 0.15,
        hipZ + Math.sin(swing) * 0.39,
        0.75,
        0.85,
        0.8,
        -swing * 0.6 - knee,
      );
      p(
        "horseHoof",
        dx,
        0.1 + knee * 0.3,
        hipZ + Math.sin(swing) * 0.48,
        1,
        1,
        1,
        -0.1,
        dark,
      );
    }
  }
  private prepareHeroes() {
    for (const h of this.state?.heroes ?? []) {
      let view = this.heroViews.get(h.owner);
      if (!view) {
        view = { x: h.x, y: h.y, z: h.z, facing: h.facing, dx: 0, dz: 0 };
        this.heroViews.set(h.owner, view);
      }
      const x = view.x,
        z = view.z;
      this.heroTracks.get(h.owner)?.sample(this.time, view);
      view.dx = view.x - x;
      view.dz = view.z - z;
      if (Math.hypot(view.dx, view.dz) > 30) {
        view.dx = 0;
        view.dz = 0;
        if (h.owner === this.owner) this.heroBoom = 0;
      }
      view.facing =
        this.heroMode && h.owner === this.owner ? this.heroYaw : h.facing;
      this.smooth.set(10000 + h.owner, view);
    }
  }
  private drawArmy(dt: number) {
    const state = this.state;
    if (!state) return;
    for (const p of Object.values(this.parts)) p.count = 0;
    this.drawVisibility = 1;
    this.characters.begin(this.time, this.camera.position, this.heroMode);
    const activeHero = state.heroes.find((h) => h.owner === this.owner);
    if (activeHero) {
      const p = this.smooth.get(10000 + this.owner) ?? activeHero;
      this.heroSight.set(
        p.x,
        heightAt(this.mapID, p.x, p.z) +
          1.5 +
          (this.heroViews.get(this.owner)?.y ?? activeHero.y),
        p.z,
      );
    }
    const alpha = clamp((this.time - this.snapshotAt) / this.bodySpan, 0, 1);
    const serverTime = this.serverNow();
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
      const gear = outfit(s.owner, spec.kind),
        mounted = isMounted(spec.kind);
      for (let rank = 0; rank < s.alive; rank++) {
        const i = s.slots?.[rank] ?? rank,
          key = s.id * 32 + i;
        let x = v.x,
          z = v.z;
        const body = this.bodies.get(key);
        let actorMoving = moving;
        if (body) {
          x = body.fromX + (body.toX - body.fromX) * alpha;
          z = body.fromZ + (body.toZ - body.fromZ) * alpha;
          const travel = Math.hypot(x - body.x, z - body.z);
          actorMoving = travel / Math.max(dt, 0.001) > 0.25;
          body.phase += travel * 0.18;
          body.x = x;
          body.z = z;
        } else {
          const [ox, oz] = offset(shape, i);
          x += ox * Math.cos(v.facing) + oz * Math.sin(v.facing);
          z += -ox * Math.sin(v.facing) + oz * Math.cos(v.facing);
        }
        const ground = heightAt(this.mapID, x, z);
        if (!this.actorVisibility.visible(x, ground + 1.5, z)) continue;
        const fade =
          this.heroMode && activeHero
            ? crowdVisibility(
                x,
                ground + (mounted ? 1.9 : 1.25),
                z,
                mounted ? 1.25 : 0.65,
                this.camera.position,
                this.heroSight,
              )
            : 1;
        if (body) {
          body.fade += (fade - body.fade) * (1 - Math.exp(-dt * 20));
          this.drawVisibility = body.fade;
        } else this.drawVisibility = fade;
        if (this.characters.ready) {
          const attackPhase = attackProgress(s, i, serverTime);
          const exactHitAge = this.time - (this.soldierHits.get(key) ?? -100);
          const hitAge = Math.min(
            exactHitAge,
            this.time - (this.hits.get(s.id) ?? -100) - (i % 4) * 0.03,
          );
          const attacking = attackPhase >= 0;
          const motion =
            exactHitAge < 0.28 && !mounted && !attacking
              ? "hit"
              : attacking
                ? mounted
                  ? "ride_" + gear.attack
                  : gear.attack
                : hitAge >= 0 && hitAge < 0.22 && i % 3 === 0
                  ? "hit"
                  : mounted
                    ? "ride"
                    : actorMoving
                      ? "run"
                      : s.engaged && ["spear", "sword"].includes(spec.kind)
                        ? "block"
                        : "idle";
          const phase =
            motion === "hit"
              ? hitAge * 2.5
              : attacking
                ? attackPhase * this.characters.duration(gear.model, motion)
                : actorMoving && body
                  ? body.phase + i * 0.173
                  : this.time + i * 0.173;
          const lunge =
            !body && attacking && !isRanged(spec.kind) && !mounted
              ? Math.sin(attackPhase * Math.PI) * 0.28
              : 0;
          if (mounted)
            this.drawMount(
              x,
              z,
              v.facing,
              s.owner,
              spec.kind === "camel",
              actorMoving,
              i,
            );
          this.characters.draw({
            id: `${s.id}:${i}`,
            ...gear,
            x: x + Math.sin(v.facing) * lunge,
            y:
              ground +
              (mounted
                ? 1.1 + (actorMoving ? Math.sin(this.time * 12 + i) * 0.07 : 0)
                : 0),
            z: z + Math.cos(v.facing) * lunge,
            facing: v.facing,
            color: factionColors[s.owner],
            motion,
            phase,
            loop: !attacking && motion !== "hit",
            hit: hitAge >= 0 && hitAge < 0.16 ? 1 - hitAge / 0.16 : 0,
            visibility: this.drawVisibility,
          });
        } else
          this.soldier(
            x,
            z,
            v.facing,
            s.owner,
            spec.kind,
            i,
            actorMoving,
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
    this.drawVisibility = 1;
    for (const h of state.heroes) {
      if (h.hp <= 0) continue;
      const id = 10000 + h.owner;
      const v = this.heroViews.get(h.owner);
      if (!v) continue;
      const local = this.heroMode && h.owner === this.owner;
      const dx = v.dx,
        dz = v.dz;
      const speed = Math.hypot(dx, dz) / Math.max(dt, 0.001);
      const moving = speed > 0.25;
      let locomotion = this.heroMotion.get(h.owner);
      if (!locomotion) {
        locomotion = { x: 0, z: 0, phase: 0, wasAir: false, landed: -10 };
        this.heroMotion.set(h.owner, locomotion);
      }
      if (moving) {
        locomotion.x = dx;
        locomotion.z = dz;
        locomotion.phase += Math.hypot(dx, dz) * 0.18;
      }
      if (locomotion.wasAir && v.y <= 0.01) {
        locomotion.landed = this.time;
        if (local) this.combatSound("step");
      }
      locomotion.wasAir = v.y > 0.01;
      if (
        !local &&
        !this.actorVisibility.visible(
          v.x,
          heightAt(this.mapID, v.x, v.z) + v.y + 1.5,
          v.z,
        )
      )
        continue;
      if (this.characters.ready) {
        const kind = h.class === 2 ? "archer" : "sword",
          gear = outfit(h.owner, kind, h.class);
        const attackAge = serverTime - h.attackAt;
        const hitAge = this.time - (this.hits.get(id) ?? -10);
        const dodging = h.dodgeUntil > serverTime;
        const duration = h.attackDuration || 0.55;
        const attacking =
          h.attackAt > 0 && attackAge >= 0 && attackAge < duration;
        const beat = h.swordChain && attacking ? h.attackKind ?? 0 : -1;
        const travel = movementClip(locomotion.x, locomotion.z, v.facing);
        const guardTravel = (
          {
            run: "guardRun",
            back: "guardBack",
            strafeLeft: "guardLeft",
            strafeRight: "guardRight",
          } as Record<string, string>
        )[travel];
        const landing = this.time - locomotion.landed < 0.18;
        const motion = dodging
          ? movementClip(
              h.dodgeX ?? locomotion.x,
              h.dodgeZ ?? locomotion.z,
              v.facing,
              true,
            )
          : v.y > 0.1
            ? "jump"
            : h.block
              ? hitAge < 0.24
                ? "blockHit"
                : moving
                  ? guardTravel
                  : "block"
              : attacking
                ? h.class === 2
                  ? "shoot"
                  : beat >= 0 ? swordMotion(beat, gear.weapon === "duelSword") : ["slash", "backslash", "stab"][h.attackKind || 0]
                : hitAge < 0.24
                  ? "hit"
                  : landing
                    ? "land"
                    : moving
                      ? travel
                      : "idle";
        const phase = dodging
          ? (1 - (h.dodgeUntil - serverTime) / 0.3) *
            this.characters.duration(gear.model, motion)
          : attacking
            ? (beat >= 0 ? swordPhase(beat, attackAge / duration, gear.model, gear.weapon === "duelSword") : attackAge / duration) *
              this.characters.duration(gear.model, motion)
            : ["hit", "blockHit"].includes(motion)
              ? hitAge * 2
              : landing
                ? (this.time - locomotion.landed) * 2
                : moving
                  ? locomotion.phase
                  : this.time;
        this.characters.draw({
          id: `hero:${h.owner}`,
          ...gear,
          x: v.x,
          y: heightAt(this.mapID, v.x, v.z) + v.y,
          z: v.z,
          facing: v.facing,
          color: factionColors[h.owner],
          focus: local,
          blendSeconds: beat >= 0 ? .08 : undefined,
          motion,
          phase,
          loop:
            !dodging &&
            !attacking &&
            !["hit", "blockHit", "land"].includes(motion),
          lean:
            moving && travel === "run" && !h.block && !attacking && !dodging
              ? -0.07
              : 0,
          hit: hitAge < 0.15 ? 1 - hitAge / 0.15 : 0,
        });
        if (local) {
          this.canvas.dataset.heroMotion = motion;
          this.canvas.dataset.heroFacing = String(v.facing);
          this.heroCue(
            motion,
            attackAge / duration,
            attacking,
            h.block,
            dodging,
            beat,
          );
          this.drawSwing(
            v.x,
            v.z,
            v.y,
            v.facing,
            attacking && h.class !== 2 ? attackAge / duration : -1,
            h.attackKind || 0,
            beat,
          );
          if (moving && !dodging && v.y <= 0.01 && this.time > this.footstep) {
            this.footstep = this.time + (h.block ? 0.4 : 0.28);
            this.combatSound("step");
          }
        }
      } else
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
          v.y,
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
    if (this.characters.ready) {
      this.fallen = this.fallen.filter((f) => this.time - f.at < 4.5);
      for (const f of this.fallen) {
        if (
          !this.actorVisibility.visible(
            f.x,
            heightAt(this.mapID, f.x, f.z) + 1,
            f.z,
          )
        )
          continue;
        const age = Math.max(0, this.time - f.at),
          gear = outfit(f.owner, f.kind, f.heroClass);
        this.characters.draw({
          id: f.id,
          ...gear,
          x: f.x,
          z: f.z,
          y: heightAt(this.mapID, f.x, f.z) - Math.max(0, age - 3.2) * 0.5,
          facing: f.facing,
          color: factionColors[f.owner],
          motion: "death",
          phase: age * 1.3,
          loop: false,
        });
      }
    }
    this.characters.end();
    for (const p of Object.values(this.parts)) {
      p.mesh.count = p.count;
      if (!p.count) continue;
      for (const [attribute, size] of [
        [p.mesh.instanceMatrix, 16],
        [p.mesh.instanceColor, 3],
        [p.visibility, 1],
      ] as const) {
        if (!attribute) continue;
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(0, p.count * size);
        attribute.needsUpdate = true;
      }
    }
  }
  private drawLabels() {
    const s = this.state;
    if (!s) return;
    // Read layout once, before any label HTML/style writes.
    const width = this.canvas.clientWidth,
      height = this.canvas.clientHeight;
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
      const className = "world-label " + cls;
      if (node.className !== className) node.className = className;
      tempV.set(x, y, z).project(this.camera);
      node.style.transform = `translate(${(tempV.x * 0.5 + 0.5) * width}px,${(-tempV.y * 0.5 + 0.5) * height}px) translate(-50%,-50%)`;
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
        const p = this.heroViews.get(h.owner) ?? h;
        const yaw = this.heroYaw;
        const dist = 8.2;
        const look = this.cameraLook.set(
          p.x,
          heightAt(this.mapID, p.x, p.z) + 1.9 + p.y,
          p.z,
        );
        const goal = this.cameraGoal.set(
          p.x - Math.sin(yaw) * dist - Math.cos(yaw) * 1.15,
          look.y + 2.2 + this.heroPitch * 6,
          p.z - Math.cos(yaw) * dist + Math.sin(yaw) * 1.15,
        );
        const direction = this.cameraDirection.copy(goal).sub(look).normalize();
        let boom = look.distanceTo(goal);
        const obstruct = (x: number, z: number, r: number) => {
          const mx = look.x - x,
            my = look.y - 4,
            mz = look.z - z,
            c = mx * mx + my * my + mz * mz - r * r;
          if (c <= 0) return; // the conservative proxy must not collapse the boom when its origin is inside
          const b = mx * direction.x + my * direction.y + mz * direction.z,
            d = b * b - c;
          if (d < 0) return;
          const entry = -b - Math.sqrt(d);
          if (entry > 0) boom = Math.min(boom, Math.max(2.2, entry - 0.6));
        };
        for (const b of this.state.bases) obstruct(b.x, b.z, 10);
        for (const b of rules.maps[this.mapID].obstacles)
          obstruct(b.x, b.z, b.r);
        // Follow the exact render pose. Only obstacle recovery changes the boom;
        // a second world-space follow filter makes the hero wobble on screen.
        if (this.heroBoom === 0 || boom < this.heroBoom) this.heroBoom = boom;
        else this.heroBoom += (boom - this.heroBoom) * (1 - Math.exp(-dt * 6));
        this.camera.position
          .copy(look)
          .addScaledVector(direction, this.heroBoom);
        this.camera.position.y +=
          Math.sin(this.time * 45) * this.cameraKick * 0.25;
        this.camera.position.y = Math.max(
          this.camera.position.y,
          heightAt(this.mapID, this.camera.position.x, this.camera.position.z) +
            1.2,
        );
        this.camera.lookAt(
          look.x + Math.sin(yaw) * 6,
          look.y - 0.45 - this.heroPitch * 3,
          look.z + Math.cos(yaw) * 6,
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
    const elapsed = (now - this.last) / 1000;
    const dt = Math.min(0.05, elapsed);
    this.last = now;
    this.time = now / 1000;
    this.cameraKick *= Math.exp(-dt * 22);
    this.frame++;
    this.fps = this.fps * 0.97 + (1 / Math.max(elapsed, 0.001)) * 0.03;
    this.prepareHeroes();
    this.updateCamera(dt);
    this.camera.updateMatrixWorld();
    this.actorVisibility.update(this.camera);
    this.drawArmy(dt);
    if (this.struck && this.heroMode && this.time - this.struck.at < 0.8) {
      const hit = this.struck,
        body = this.bodies.get(hit.key);
      const p = tempV
        .set(
          body?.x ?? hit.x,
          heightAt(this.mapID, hit.x, hit.z) + 3.1,
          body?.z ?? hit.z,
        )
        .project(this.camera);
      this.targetLabel.classList.toggle(
        "hidden",
        p.z < 0 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1,
      );
      this.targetLabel.style.left =
        (p.x * 0.5 + 0.5) * this.canvas.clientWidth + "px";
      this.targetLabel.style.top =
        (-p.y * 0.5 + 0.5) * this.canvas.clientHeight + "px";
      this.targetLabel.textContent = `${hit.label} −${Math.round(hit.damage)}`;
      this.canvas.dataset.hitSoldier = String(hit.key);
    } else this.targetLabel.classList.add("hidden");
    this.canvas.dataset.triangles = String(this.renderer.info.render.triangles);
    if (
      !this.heroMode ||
      !this.state?.heroes.some((h) => h.owner === this.owner && h.hp > 0)
    ) {
      document.getElementById("hero-feedback")?.classList.add("hidden");
      if (this.swing) this.swing.visible = false;
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      s.vy -= 12 * dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        s.life / 0.3,
      );
      if (s.life <= 0) {
        this.effects.remove(s.mesh);
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
        this.sparks.splice(i, 1);
      }
    }
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
    this.drawProjectiles();
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
    this.canvas.addEventListener("auxclick", (e) => {
      if (e.button === 1) e.preventDefault();
    });
    this.canvas.addEventListener("pointerdown", (e) => {
      this.canvas.focus();
      if (this.heroMode) {
        if (e.button === 1) {
          e.preventDefault();
          this.orbitPointer = e.pointerId;
          this.orbitX = e.clientX;
          this.orbitY = e.clientY;
          this.canvas.setPointerCapture(e.pointerId);
        }
        if (e.button === 0) this.onAction("attack");
        if (e.button === 2) {
          this.keys.add("Block");
          this.onInput();
        }
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
        if (this.orbitPointer === e.pointerId && (e.buttons & 4) !== 0) {
          this.heroYaw -= (e.clientX - this.orbitX) * 0.0025;
          this.heroPitch = clamp(
            this.heroPitch + (e.clientY - this.orbitY) * 0.002,
            -0.15,
            0.8,
          );
          this.orbitX = e.clientX;
          this.orbitY = e.clientY;
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
        if (e.button === 1) {
          this.endHeroOrbit();
          this.onInput();
        }
        if (e.button === 2) {
          this.keys.delete("Block");
          this.onInput();
        }
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
    this.canvas.addEventListener("lostpointercapture", () => {
      this.orbitPointer = null;
    });
    this.canvas.addEventListener("pointercancel", () => {
      this.endHeroOrbit();
      this.keys.delete("Block");
      this.onInput();
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
      if (this.heroMode && e.code === "Escape") {
        this.endHeroOrbit();
        this.keys.clear();
        this.onInput();
        return;
      }
      this.keys.add(e.code);
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (this.heroMode && !e.repeat) {
        this.onInput();
        if (e.code === "Space") this.onAction("jump");
        if (e.code === "ShiftLeft" || e.code === "ShiftRight")
          this.onAction("dodge");
        if (e.code === "KeyQ") this.onAction("skill");
      }
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (this.heroMode) this.onInput();
    });
    window.addEventListener("blur", () => {
      this.endHeroOrbit();
      this.keys.clear();
      this.onInput();
      this.pointer.down = false;
      this.box.style.display = "none";
    });
  }
  private endHeroOrbit() {
    const pointer = this.orbitPointer;
    this.orbitPointer = null;
    if (pointer !== null && this.canvas.hasPointerCapture(pointer))
      this.canvas.releasePointerCapture(pointer);
  }
  enterHero() {
    const h = this.state?.heroes.find((h) => h.owner === this.owner);
    if (!h) return;
    this.heroMode = true;
    this.heroYaw = h.facing;
    this.heroPitch = 0.24;
    this.heroBoom = 0;
    this.endHeroOrbit();
    this.keys.clear();
    this.canvas.focus();
  }
  exitHero() {
    this.endHeroOrbit();
    this.heroMode = false;
    this.keys.clear();
    const h = this.state?.heroes.find((h) => h.owner === this.owner);
    if (h) {
      this.focus.set(h.x, 0, h.z);
      this.distance = 65;
    }
  }
  heroInput() {
    return heroMovement(this.keys, this.heroYaw);
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
  private heroCue(
    motion: string,
    progress: number,
    attacking: boolean,
    blocking: boolean,
    dodging: boolean,
    beat: number,
  ) {
    const cue = document.getElementById("hero-feedback");
    if (!cue) return;
    cue.classList.remove("hidden");
    const feedback = this.time < this.feedbackUntil;
    const action = dodging
      ? "KAÇINMA"
      : blocking
        ? "SAVUNMA"
        : attacking
          ? beat >= 0 ? swordLabels[beat] : progress < 0.3
            ? "HAZIRLIK"
            : progress < 0.55
              ? "VURUŞ"
              : "TOPARLANMA"
          : motion === "back"
            ? "GERİ ADIM"
            : motion.startsWith("strafe")
              ? "YAN ADIM"
              : motion === "run"
                ? "KOŞU"
                : motion === "jump"
                  ? "HAVADA"
                  : "HAZIR";
    cue.className =
      "hero-feedback " + (feedback ? this.feedbackKind : "stance");
    cue.textContent = feedback ? this.feedbackText : action;
    const cross = document.getElementById("crosshair");
    if (cross) cross.dataset.feedback = feedback ? this.feedbackKind : "";
  }
  private drawSwing(
    x: number,
    z: number,
    y: number,
    facing: number,
    p: number,
    kind: number,
    beat: number,
  ) {
    if (!this.swing) {
      const vertices: number[] = [];
      for (let i = 0; i < 24; i++) {
        const a = -1.05 + (i / 24) * 1.8,
          b = -1.05 + ((i + 1) / 24) * 1.8;
        for (const [t, r] of [
          [a, 1.9],
          [a, 2.2],
          [b, 2.2],
          [a, 1.9],
          [b, 2.2],
          [b, 1.9],
        ])
          vertices.push(Math.sin(t) * r, 0, Math.cos(t) * r);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      this.swing = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: "#ffe5ae",
          transparent: true,
          opacity: 0.25,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      this.effects.add(this.swing);
    }
    const contact = beat >= 0 ? swordSteps[beat].impact : .42;
    const offset = p - contact;
    this.swing.visible = offset > -.16 && offset < .14;
    if (!this.swing.visible) return;
    this.swing.position.set(x, heightAt(this.mapID, x, z) + 1.45 + y, z);
    this.swing.scale.set(beat === 2 ? .07 : 1, 1, beat === 2 ? .94 + offset : 1);
    this.swing.rotation.set(
      beat >= 0 ? 0 : kind === 1 ? 0.45 : kind === 2 ? -0.55 : 0,
      facing + offset * (beat === 1 ? -3 : beat === 2 ? 0 : 3),
      0,
      "YXZ",
    );
    (this.swing.material as THREE.MeshBasicMaterial).opacity =
      Math.sin(((offset + .16) / .3) * Math.PI) * 0.3;
  }
  private burst(x: number, z: number, block: boolean) {
    if (this.sparks.length > 80) return;
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.035, 0.18),
        new THREE.MeshBasicMaterial({
          color: block ? "#eef6ff" : "#ffcf83",
          transparent: true,
          depthWrite: false,
        }),
      );
      mesh.position.set(x, heightAt(this.mapID, x, z) + 1.4, z);
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      const a = (i * Math.PI) / 4;
      this.effects.add(mesh);
      this.sparks.push({
        mesh,
        vx: Math.sin(a) * 3,
        vy: 1.5 + Math.random() * 2,
        vz: Math.cos(a) * 3,
        life: 0.3,
      });
    }
  }
  private combatSound(kind: "swing" | "hit" | "block" | "step") {
    if (!this.sound || !this.audio) return;
    const ctx = this.audio,
      duration = kind === "step" ? 0.06 : kind === "swing" ? 0.15 : 0.12;
    const buffer = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * duration),
        ctx.sampleRate,
      ),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = kind === "block" ? "highpass" : "lowpass";
    filter.frequency.value =
      kind === "block"
        ? 1900
        : kind === "swing"
          ? 1200
          : kind === "step"
            ? 180
            : 600;
    gain.gain.setValueAtTime(kind === "step" ? 0.025 : 0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + duration);
    if (kind === "block") this.tone(1450, 0.09, 0.035);
    if (kind === "hit") this.tone(95, 0.1, 0.06);
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
    this.characters.dispose();
    this.arrows.geometry.dispose();
    (this.arrows.material as THREE.Material).dispose();
    this.audio?.close();
  }
}
