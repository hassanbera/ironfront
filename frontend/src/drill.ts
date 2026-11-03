import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Characters, outfit } from "./characters";
import { rules } from "./types";
const duel = new URLSearchParams(location.search).has("duel");

document.head.insertAdjacentHTML(
  "beforeend",
  `<style>
*{box-sizing:border-box}body{margin:0;background:#17201d;color:#eee9dc;font:16px Barlow,Arial,sans-serif}canvas{display:block;width:100vw;height:100vh}header{position:absolute;left:34px;top:28px;z-index:1}header a{color:#a9b5a6;text-decoration:none;font-size:13px;letter-spacing:2px}h1{font:600 42px 'Barlow Condensed',sans-serif;margin:12px 0 8px}p{color:#b7bdb0;margin:0;font-size:14px}.tools{position:absolute;right:28px;top:30px;display:flex;gap:8px}select,button{background:#243029;border:1px solid #52604e;border-radius:4px;color:#eee9dc;padding:11px 14px;font:500 15px Barlow,Arial;cursor:pointer}nav{position:absolute;bottom:28px;left:50%;transform:translateX(-50%);display:flex;gap:7px;padding:12px;background:#17201ded;border:1px solid #52604e;border-radius:7px;max-width:94vw;flex-wrap:wrap;justify-content:center;width:max-content}button.active{background:#c6ae74;border-color:#c6ae74;color:#17201d}.unit-label{position:absolute;transform:translate(-50%,-50%);font:600 13px Barlow,sans-serif;letter-spacing:1px;color:#d4d9cd;pointer-events:none;text-shadow:0 2px 4px #000}.status{position:absolute;left:34px;bottom:132px;font-size:13px;color:#a9b5a6}#pose-name{color:#e1c789;margin-top:8px;font-weight:600}#error{color:#ffae91}@media(max-width:800px){header{left:18px;top:18px}h1{font-size:29px}.tools{top:150px;right:18px}nav{bottom:16px}button{padding:8px}}
</style>`,
);
document.querySelector("#drill")!.innerHTML =
  `<header><a href="/">← IRONFRONT</a><h1>BİRLİK TALİMİ</h1><p>Fareyle çevir · Tekerlekle yakınlaş · Hareket seç</p><p id="pose-name">Hazır duruş</p></header><div class="tools"><select id="faction" aria-label="Faction">${rules.factions.map((f, i) => `<option value="${i}">${f.name}</option>`).join("")}</select><button id="pause">Duraklat</button><button id="crowd">400 asker</button></div><div class="status"><span id="load">Karakterler hazırlanıyor…</span><span id="error"></span></div><nav id="motions"></nav>`;
const motions: [string, string][] = [
  ["idle", "Hazır"],
  ["walk", "Yürü"],
  ["run", "Koş"],
  ["back", "Geri yürü"],
  ["strafeLeft", "Sol adım"],
  ["strafeRight", "Sağ adım"],
  ["attack", "Saldır"],
  ["block", "Blok"],
  ["hit", "Darbe"],
  ["dodge", "Kaçın"],
  ["dodgeBack", "Geri kaçın"],
  ["dodgeLeft", "Sola kaçın"],
  ["dodgeRight", "Sağa kaçın"],
  ["jump", "Zıpla"],
  ["death", "Düş"],
];
const studyLink = document.createElement("a");
studyLink.href = duel ? "/drill.html" : "/drill.html?duel";
studyLink.textContent = duel ? "← Tüm birlikler" : "Turks ve Knights · İkili talim";
document.querySelector("header")!.append(studyLink);
if (duel) {
  document.querySelector("h1")!.textContent = "KILIÇ VE KALKAN";
  document.querySelector<HTMLElement>("#faction")!.hidden = true;
  document.querySelector<HTMLElement>("#crowd")!.hidden = true;
  motions.push(["backslash", "Çapraz kes"], ["stab", "Sapla"], ["blockHit", "Kalkan darbesi"]);
}
const nav = document.querySelector("#motions")!;
let motion = "idle",
  faction = 0,
  paused = false,
  crowd = false,
  time = 0,
  started = 0;
function buttons() {
  nav.innerHTML = motions
    .map(
      ([key, label]) =>
        `<button data-motion="${key}" class="${motion === key ? "active" : ""}">${label}</button>`,
    )
    .join("");
}
buttons();
nav.addEventListener("click", (e) => {
  const key = (e.target as HTMLElement).dataset.motion;
  if (!key) return;
  motion = key;
  started = time;
  buttons();
  document.querySelector("#pose-name")!.textContent = motions.find(
    (m) => m[0] === key,
  )![1];
});
document
  .querySelector("#faction")!
  .addEventListener(
    "change",
    (e) => (faction = Number((e.target as HTMLSelectElement).value)),
  );
document.querySelector("#pause")!.addEventListener("click", (e) => {
  paused = !paused;
  (e.target as HTMLElement).textContent = paused ? "Devam et" : "Duraklat";
});
const renderer = new T.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
document.body.append(renderer.domElement);
const scene = new T.Scene();
scene.background = new T.Color("#28362f");
scene.fog = new T.Fog("#28362f", 30, 95);
const camera = new T.PerspectiveCamera(40, 1, 0.1, 160);
camera.position.set(6, 5.4, 14.5);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
if (duel) camera.position.set(.6, 2.35, 6.1);
controls.minDistance = 3;
controls.maxDistance = 65;
controls.maxPolarAngle = Math.PI * 0.48;
controls.enableDamping = true;
scene.add(new T.HemisphereLight("#f4eede", "#526457", 2.1));
const sun = new T.DirectionalLight("#ffebc5", 3);
sun.position.set(-5, 14, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -25;
sun.shadow.camera.right = 25;
sun.shadow.camera.top = 25;
sun.shadow.camera.bottom = -25;
sun.shadow.normalBias = 0.035;
scene.add(sun);
const floor = new T.Mesh(
  new T.PlaneGeometry(120, 120),
  new T.MeshStandardMaterial({ color: "#64715f", roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const grid = new T.GridHelper(80, 40, "#76816b", "#65705f");
grid.position.y = 0.003;
scene.add(grid);
const chars = new Characters();
scene.add(chars.group);
let loaded = false;
chars
  .load()
  .then(() => {
    loaded = true;
    document.querySelector("#load")!.textContent = "Hazır";
    renderer.domElement.dataset.characters = "rigged";
  })
  .catch((e) => {
    document.querySelector("#error")!.textContent = String(e);
    console.error(e);
  });
const kinds = ["sword", "spear", "archer", "axe", "berserker"];
const labels = ["KILIÇ / KALKAN", "MIZRAK", "YAY", "BÜYÜK BALTA", "ÇİFT BALTA"];
const nodes = labels.map((t) => {
  const el = document.createElement("div");
  el.className = "unit-label";
  el.textContent = t;
  document.body.append(el);
  return el;
});
if (duel) {
  nodes[0].textContent = "TURKS · MUHAFIZ";
  nodes[1].textContent = "KNIGHTS · AĞIR PİYADE";
  nodes.slice(2).forEach((node) => (node.hidden = true));
}
document.querySelector("#crowd")!.addEventListener("click", (e) => {
  crowd = !crowd;
  (e.target as HTMLElement).textContent = crowd ? "Yakın incele" : "400 asker";
  camera.position.set(
    ...((crowd ? [18, 25, 38] : [6, 5.4, 14.5]) as [number, number, number]),
  );
  controls.target.set(0, 1, 0);
  nodes.forEach((n) => (n.hidden = crowd));
});
const colors = rules.factions.map((f) => new T.Color(f.color));
let last = performance.now(),
  frames = 0,
  sum = 0;
function animate(now: number) {
  const elapsed = (now - last) / 1000;
  const dt = Math.min(0.1, elapsed);
  last = now;
  if (!paused) time += dt;
  chars.begin(time, camera.position);
  if (loaded)
    for (let i = 0; i < (duel ? 2 : crowd ? 400 : 5); i++) {
      const kind = duel ? "sword" : kinds[i % 5],
        owner = duel ? (i === 0 ? 3 : 0) : crowd ? Math.floor(i / 100) : faction,
        gear = outfit(owner, kind, duel && i === 0 ? 0 : -1),
        action = motion === "attack" ? gear.attack : motion;
      const duration = chars.duration(gear.model, action),
        once =
          ["attack", "hit", "death", "backslash", "stab", "blockHit"].includes(motion) ||
          motion.startsWith("dodge"),
        cycle = duration + 0.7;
      const phase = once
        ? (time - started) % cycle
        : time + (crowd ? i * 0.173 : 0);
      const x = duel ? (i - .5) * 2.15 : crowd ? ((i % 20) - 9.5) * 1.45 : (i - 2) * 2.35,
        z = crowd ? (Math.floor(i / 20) - 9.5) * 1.45 : 0;
      chars.draw({
        id: String(i),
        ...gear,
        x,
        y: 0,
        z,
        facing: duel ? (i === 0 ? .80 : -.80) : 0,
        color: colors[owner],
        motion: action,
        phase,
        loop: !once,
      });
      if (!crowd) {
        const point = new T.Vector3(x, 2.7, z).project(camera);
        nodes[i].style.left = (point.x * 0.5 + 0.5) * innerWidth + "px";
        nodes[i].style.top = (-point.y * 0.5 + 0.5) * innerHeight + "px";
      }
    }
  chars.end();
  controls.update();
  renderer.render(scene, camera);
  frames++;
  sum += elapsed;
  if (frames >= 30) {
    document.querySelector("#load")!.textContent = loaded
      ? `${chars.count} asker · ${Math.round(frames / sum)} FPS · ${renderer.info.render.calls} çizim`
      : "Karakterler hazırlanıyor…";
    renderer.domElement.dataset.triangles = String(
      renderer.info.render.triangles,
    );
    renderer.domElement.dataset.fps = String(Math.round(frames / sum));
    frames = 0;
    sum = 0;
  }
  requestAnimationFrame(animate);
}
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
requestAnimationFrame(animate);
