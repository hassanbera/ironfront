import "./style.css";
import { World } from "./world";
import { Network } from "./network";
import {
  rules, fieldSize, fieldLimit,
  previewState,
  esc,
  timeText,
  clamp,
  terrainAt,
  type GameState,
} from "./types";
import { icon, unitIcon, formationDiagram } from "./icons";

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const hudHTML = new Map<string, string>();
function setHUD(id: string, html: string) {
  if (hudHTML.get(id) === html) return;
  $(id).innerHTML = html;
  hudHTML.set(id, html);
}
let chosenFaction = 0,
  chosenHero = 0,
  chosenMap = 0,
  game: GameState | null = null,
  modalType = "",
  guideFaction = 0,
  started = false,
  lastEvent = 0,
  lobbySignature = "",
  lastHUD = 0;
const net = new Network();
let selected = new Set<number>();
const groups = new Map<string, number[]>();
const app = $("app");
document.body.classList.add("menu");
app.innerHTML = `<div id="viewport"></div>
<header class="app-header"><button class="brand" id="brand" title="Ana menü"><span class="brand-mark">${icon("shield", 28)}</span><span><strong>IRONFRONT</strong><small>DÖRT SANCAK</small></span></button><nav class="nav" aria-label="Ana menü"><button class="active" data-nav="battle">SAVAŞ ALANI</button><button data-nav="guide">BİRLİK REHBERİ</button><button data-nav="drill">BİRLİK TALİMİ</button><button data-nav="help">NASIL OYNANIR</button></nav><div class="header-right"><span class="small-status" id="header-status"><i class="status-dot"></i> 1–4 OYUNCU · GERÇEK ZAMANLI</span><button class="icon-button" id="sound-button" title="Sesi aç" aria-label="Sesi aç">${icon("mute", 16)}</button><button class="icon-button" id="help-button" title="Kontroller" aria-label="Kontroller">${icon("help", 17)}</button><button class="icon-button" id="settings-button" title="Ayarlar" aria-label="Ayarlar">${icon("settings", 17)}</button></div></header>
<section class="menu-panel" id="menu-panel"><div class="eyebrow"><i></i> GERÇEK ZAMANLI TAKTİK</div><h1>DÖRT SANCAK.<br><span>TEK CEPHE.</span></h1><p class="intro">Ekonomi yok. İnşa yok. Sadece taktik.<br>Birliklerini yönet. Savaşın kaderini değiştir.</p><div class="section-label">SANCAĞINI SEÇ <b>01 / 04</b></div><div class="faction-options" id="factions"></div><p class="faction-detail" id="faction-detail"></p><div class="hero-selector">${icon("swords", 23)}<label for="hero-class">KAHRAMAN SINIFI<select id="hero-class">${rules.heroes.map((h) => `<option value="${h.id}">${h.name}</option>`).join("")}</select></label><span class="key">3. ŞAHIS</span></div><div class="menu-actions"><p class="touch-warning">Oyun klavye ve fare ile oynanır. En iyi deneyim için masaüstü kullan.</p><button class="primary" id="practice">${icon("swords", 18)}<span>MEYDANA ÇIK</span>${icon("arrow", 18)}</button><p class="action-note">3 bot ile antrenman · 20 dakikalık savaş</p><div class="secondary-row"><button class="secondary" id="create-room">${icon("users", 15)} Oda oluştur</button><button class="secondary" id="join-room">${icon("globe", 15)} Odaya katıl</button></div></div></section>
<div class="map-caption" id="map-caption"></div><div class="map-coordinates" id="map-coordinates">${icon("crosshair", 25)}<span>TAKTİK GÖRÜNÜM<br><span style="opacity:.5;line-height:2">4 ÜS &nbsp; / &nbsp; 4 OUTPOST &nbsp; / &nbsp; 400 ASKER</span></span></div><section class="map-rail" id="map-rail"><div class="map-rail-title"><span>MUHAREBE ALANI</span><b id="map-count">01 — 03</b></div><div class="map-cards" id="map-cards"></div></section>
<section class="game-hud hidden" id="game-hud"><div class="top-stats" id="top-stats"></div><div class="game-room"><span class="net-status" id="net-status"></span><button id="room-code" title="Oda kodunu kopyala"></button></div><div class="army-panel"><div class="army-head">${icon("flag", 14)} <span id="army-title">BİRLİKLERİN</span><span id="army-roster"></span></div><div class="army-list" id="army-list"></div><div class="army-quick"><button class="secondary" id="select-all">Tümünü seç</button><button class="secondary" id="focus-base">${icon("castle", 11)} Ana üs</button></div></div><div class="event-feed" id="event-feed"></div><div class="terrain-info" id="terrain-info"></div><div class="command-dock"><div class="recruit-panel"><div class="dock-heading">BİRLİK ÇAĞIR <span id="capacity-hint">Her birlik 25 asker</span></div><div class="recruit-grid" id="recruit-grid"></div></div><div class="formation-panel"><div class="dock-heading"><span id="selection-title">DİZİLİM SEÇ</span><span>Z / X / C</span></div><div class="formation-options" id="formation-options"></div><div class="order-actions"><button id="attack-order" title="F · saldırarak ilerle">${icon("crosshair", 12)} İlerle</button><button id="hold-order" title="H · mevziyi koru">${icon("shield", 12)} Koru</button><button id="retreat-order" title="R · ana üsse dön">${icon("retreat", 12)} Geri</button><button id="dismiss-order" title="Seçili birlikleri terhis et">${icon("close", 12)} Terhis</button></div></div></div><div class="control-strip"><span><kbd class="key">SOL TIK</kbd> Seç</span><span><kbd class="key">SAĞ TIK</kbd> Emir ver</span><span><kbd class="key">WASD</kbd> Kamera</span><span><kbd class="key">F</kbd> Saldırarak ilerle</span><span><kbd class="key">TAB</kbd> Kahraman</span></div><button class="primary hero-toggle" id="hero-toggle">${icon("swords", 18)} KAHRAMANA GEÇ <kbd class="key">TAB</kbd></button><div class="minimap-wrap"><div class="minimap-head"><span id="minimap-title">SINIR VADİSİ</span><span>KUZEY ↑</span></div><canvas id="minimap" width="380" height="328" aria-label="Taktik harita: tıklayarak kamerayı taşı"></canvas><span class="minimap-legend">■ ÜS &nbsp; ◆ OUTPOST &nbsp; ● BİRLİK</span></div><div class="hero-hud hidden" id="hero-hud"></div><div class="crosshair hidden" id="crosshair">${icon("crosshair", 16)}</div><button class="secondary hero-exit hidden" id="hero-exit">${icon("eye", 14)} RTS görünümüne dön <kbd class="key">TAB</kbd></button><div class="hero-hint hidden" id="hero-hint">Orta fare tuşunu basılı tutup sürükle · Kamera ve karakter birlikte döner</div></section>
<div class="connection-banner hidden" id="connection-banner"></div><div id="modal-root"></div><div class="toast-stack" id="toasts" role="status" aria-live="polite"></div>`;

let world: World;
try {
  world = new World($("viewport"));
} catch (error) {
  $("viewport").innerHTML =
    '<div class="connection-error">WebGL başlatılamadı. Donanım hızlandırması açık güncel bir tarayıcı kullan.</div>';
  throw error;
}
function toast(message: string, error = false) {
  const div = document.createElement("div");
  div.className = "toast" + (error ? " error" : "");
  div.textContent = message;
  $("toasts").append(div);
  setTimeout(() => div.remove(), error ? 8000 : 4500);
}
function mapThumbnail(id: number) {
  const desert = id === 1,
    snow = id === 2,
    bg = desert ? "#9c8056" : snow ? "#91a9a5" : "#637b53",
    path = desert ? "#ccb17e" : snow ? "#c3d3c9" : "#b8ab7b";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><path d="M0 0 100 100M100 0 0 100" stroke="${path}" stroke-width="8"/><circle cx="50" cy="50" r="24" fill="none" stroke="${path}" stroke-width="3"/>${[
    [15, 15],
    [15, 85],
    [85, 15],
    [85, 85],
  ]
    .map(
      ([x, y]) =>
        `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="#c9c6a7"/><rect x="${x - 2}" y="${y - 2}" width="4" height="4" fill="#5c6654"/>`,
    )
    .join("")}${[
    [30, 50],
    [70, 50],
    [50, 20],
    [50, 80],
  ]
    .map(([x, y]) =>
      desert
        ? `<path d="m${x - 10} ${y + 8} 10-20 11 20Z" fill="#736a4f"/>`
        : `<path d="m${x - 10} ${y + 8} 7-18 6 18Zm10 1 6-22 7 22" fill="${snow ? "#526e61" : "#3c5c3b"}"/>`,
    )
    .join("")}<path d="m50 40 10 10-10 10-10-10Z" fill="#787c63"/></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
function renderMenu() {
  const f = rules.factions[chosenFaction];
  $("factions").innerHTML = rules.factions
    .map(
      (f, i) =>
        `<button class="faction-card ${i === chosenFaction ? "active" : ""}" data-faction="${i}" style="--faction:${f.color}" aria-pressed="${i === chosenFaction}"><span class="faction-emblem">${icon(f.emblem, 25)}</span><span><strong>${f.name}</strong><small>${["ÇELİK DİSİPLİN", "KUZEYİN ÖFKESİ", "ÇÖLÜN İRADESİ", "BOZKIRIN GÜCÜ"][i]}</small></span></button>`,
    )
    .join("");
  $("faction-detail").textContent = f.description;
  document.querySelector(".section-label b")!.textContent =
    `0${chosenFaction + 1} / 04`;
  $("map-cards").innerHTML = rules.maps
    .map(
      (m, i) =>
        `<button class="map-card ${i === chosenMap ? "active" : ""}" data-map="${i}" aria-pressed="${i === chosenMap}"><img class="map-thumb" src="${mapThumbnail(i)}" alt=""/><span><strong>${m.name}</strong><small>${m.tag}</small></span><span class="map-number">0${i + 1}</span></button>`,
    )
    .join("");
  const m = rules.maps[chosenMap];
  $("map-caption").innerHTML =
    `<small>MUHAREBE ALANI / 0${chosenMap + 1}</small><h2>${m.name}</h2><p>${m.subtitle}</p><span class="map-tag">${m.tag}</span>`;
  $("map-count").textContent = `0${chosenMap + 1} — 03`;
  world.update(previewState(chosenMap), chosenFaction);
}
renderMenu();
$("factions").addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-faction]");
  if (el) {
    chosenFaction = +el.dataset.faction!;
    renderMenu();
  }
});
$("map-cards").addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-map]");
  if (el) {
    chosenMap = +el.dataset.map!;
    renderMenu();
  }
});
$<HTMLSelectElement>("hero-class").onchange = (e) =>
  (chosenHero = +(e.target as HTMLSelectElement).value);
function playerName() {
  try {
    return localStorage.getItem("ironfront-name") || "Komutan";
  } catch {
    return "Komutan";
  }
}
function connect(practice: boolean, name = playerName(), room = "") {
  if (net.status === "connecting" || net.status === "reconnecting") return;
  net.connect({
    type: room ? "join" : "create",
    room,
    name,
    faction: chosenFaction,
    heroClass: chosenHero,
    map: chosenMap,
    practice,
  });
  try {
    localStorage.setItem("ironfront-name", name);
  } catch {}
}
$("practice").onclick = () => connect(true);
function openModal(type: string, html: string, wide = false) {
  modalType = type;
  world.keys.clear();
  if (world.heroMode && document.pointerLockElement) document.exitPointerLock();
  $("modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${type === "help" ? "Nasıl oynanır" : type === "guide" ? "Birlik rehberi" : "Oyun menüsü"}"><button class="icon-button modal-close" id="modal-close" aria-label="Kapat">${icon("close", 17)}</button>${html}</section></div>`;
  $("modal-close").onclick = closeModal;
  $("modal-root").querySelector<HTMLInputElement>("input")?.focus();
}
function closeModal() {
  if (modalType === "lobby") {
    toast("Oda açık. Çıkmak için “Odadan ayrıl” düğmesini kullan.");
    return;
  }
  modalType = "";
  $("modal-root").innerHTML = "";
}
function roomForm(join: boolean) {
  openModal(
    "room",
    `<div class="eyebrow">${icon("users", 15)} DÖRT OYUNCULU SAVAŞ</div><h2>${join ? "Sancağın seni bekliyor." : "Kendi cepheni aç."}</h2><p>${join ? "Arkadaşının paylaştığı oda kodunu gir. Her oyuncu farklı bir faction seçer." : "Oda kodunu arkadaşlarınla paylaş. Dört farklı faction, aynı savaş alanı."}</p><form id="room-form"><label for="player-name">KOMUTAN ADI<input id="player-name" name="name" required maxlength="20" value="${esc(playerName())}" autocomplete="nickname"/></label>${join ? '<label for="join-code">ODA KODU<input id="join-code" required minlength="6" maxlength="6" pattern="[A-Fa-f0-9]{6}" placeholder="Örn. A7F291" style="text-transform:uppercase;letter-spacing:4px" autocomplete="off"/></label>' : ""}<label for="room-faction">FACTION<select id="room-faction">${rules.factions.map((f, i) => `<option value="${i}" ${i === chosenFaction ? "selected" : ""}>${f.name}</option>`).join("")}</select></label><button type="submit" class="primary">${join ? "ODAYA KATIL" : "ODA OLUŞTUR"} ${icon("arrow", 15)}</button></form><p class="screen-tip">${rules.maps[chosenMap].name} · ${rules.heroes[chosenHero].name} · Ekonomi yok, yalnızca taktik.</p>`,
  );
  $("room-form").onsubmit = (e) => {
    e.preventDefault();
    chosenFaction = +$<HTMLSelectElement>("room-faction").value;
    connect(
      false,
      $<HTMLInputElement>("player-name").value,
      join ? $<HTMLInputElement>("join-code").value.toUpperCase() : "",
    );
  };
}
$("create-room").onclick = () => roomForm(false);
$("join-room").onclick = () => roomForm(true);
function showLobby() {
  if (!game) return;
  const signature = JSON.stringify([game.players, game.host, net.owner]);
  if (modalType === "lobby" && signature === lobbySignature) return;
  lobbySignature = signature;
  const checked = $<HTMLInputElement>("fill-bots")?.checked ?? true;
  const host = game.host === net.owner;
  openModal(
    "lobby",
    `<div class="online-heading"><span class="eyebrow">${icon("users", 15)} SAVAŞ ODASI</span><span class="badge">${game.players.filter(Boolean).length} / 4 OYUNCU</span></div><h2>Sancaklar toplanıyor.</h2><div class="lobby-code"><div><span>ARKADAŞLARINLA PAYLAŞ</span><strong>${esc(game.room)}</strong></div><button class="icon-button" id="copy-code" aria-label="Oda kodunu kopyala">${icon("copy", 17)}</button></div><div class="lobby-slots">${rules.factions
      .map((f, i) => {
        const p = game!.players[i];
        return `<div class="lobby-slot"><span style="color:${f.color}">${icon(f.emblem, 25)}</span><div><strong>${f.name}</strong><small>${p ? esc(p.name) + " · " + rules.heroes[p.heroClass].name : "Komutan bekleniyor"}</small></div><b>${p ? (p.connected ? "● HAZIR" : "BAĞLANTI KOPTU") : "BOŞ SLOT"}</b></div>`;
      })
      .join(
        "",
      )}</div>${host ? `<label class="check-label"><input type="checkbox" id="fill-bots" ${checked ? "checked" : ""}/> Boş slotları botlarla doldur</label><button class="primary" id="start-battle">${icon("swords", 17)} SAVAŞI BAŞLAT</button>` : '<p class="screen-tip">Oda sahibinin savaşı başlatması bekleniyor.</p>'}<div class="modal-actions"><button class="secondary" id="leave-room">Odadan ayrıl</button></div><p class="screen-tip">${rules.maps[game.map].name} · Her birlik 25 asker · 20 dakika</p>`,
  );
  $("copy-code").onclick = copyRoom;
  $("leave-room").onclick = leaveGame;
  if (host)
    $("start-battle").onclick = () =>
      net.send({
        type: "start",
        bots: $<HTMLInputElement>("fill-bots").checked,
      });
}
async function copyRoom() {
  try {
    await navigator.clipboard.writeText(net.room);
    toast("Oda kodu kopyalandı: " + net.room);
  } catch {
    toast("Oda kodu: " + net.room);
  }
}
net.onWelcome = () => {
  toast("Savaş odasına bağlandın: " + net.room);
};
net.onStatus = (status) => {
  const busy = status === "connecting" || status === "reconnecting";
  $("connection-banner").classList.toggle("hidden", !busy);
  $("connection-banner").textContent =
    status === "reconnecting"
      ? "Bağlantı kesildi. Aynı savaşa yeniden bağlanılıyor…"
      : "Sunucuya bağlanılıyor…";
  $<HTMLButtonElement>("practice").disabled = busy;
  if (status === "offline" && started)
    toast("Sunucu bağlantısı kapalı. Komutlar gönderilemiyor.", true);
};
net.onError = (message) => toast(message, true);
net.onState = (state) => {
  game = state;
  if (state.phase === "lobby") {
    showLobby();
    return;
  }
  if (!started) {
    started = true;
    modalType = "";
    $("modal-root").innerHTML = "";
    document.body.classList.remove("menu");
    document.body.classList.add("battle-mode");
    for (const id of [
      "menu-panel",
      "map-rail",
      "map-caption",
      "map-coordinates",
    ])
      $(id).classList.add("hidden");
    $("game-hud").classList.remove("hidden");
    selected = new Set(
      state.squads
        .filter((s) => s.owner === net.owner)
        .slice(0, 1)
        .map((s) => s.id),
    );
    world.selected = selected;
    world.update(state, net.owner);
    world.focusBase();
    world.resize();
    $("minimap-title").textContent = rules.maps[state.map].name.toUpperCase();
    document.documentElement.style.setProperty(
      "--team",
      rules.factions[net.owner].color,
    );
    renderDock();
    toast(
      "Birlik seç → sağ tıkla hareket et. F + tık saldırarak ilerler. Tab kahramana geçer.",
    );
  }
  world.update(state, net.owner);
  for (const id of selected)
    if (!state.squads.some((s) => s.id === id)) selected.delete(id);
  const now = performance.now();
  if (now - lastHUD > 180) {
    renderHUD();
    lastHUD = now;
  }
  if (state.phase === "finished" && modalType !== "result") showResult();
};
function leaveGame() {
  hudHTML.clear();
  net.send({ type: "leave" });
  net.disconnect();
  if (world.heroMode) world.exitHero();
  game = null;
  started = false;
  modalType = "";
  lobbySignature = "";
  lastEvent = 0;
  selected.clear();
  groups.clear();
  world.selected = selected;
  world.heroMode = false;
  world.focusPoint(0, 0);
  world.distance = fieldSize * 1.06;
  world.azimuth = 0.57;
  document.body.className = "menu";
  $("modal-root").innerHTML = "";
  $("game-hud").classList.add("hidden");
  for (const id of ["menu-panel", "map-rail", "map-caption", "map-coordinates"])
    $(id).classList.remove("hidden");
  $("header-status").innerHTML =
    '<i class="status-dot"></i> 1–4 OYUNCU · GERÇEK ZAMANLI';
  renderMenu();
  world.resize();
}
function confirmLeave() {
  if (!started && modalType !== "lobby") return;
  openModal(
    "leave",
    `<div class="eyebrow">SAVAŞ ODASI</div><h2>Meydandan ayrıl?</h2><p>Diğer oyuncuların savaşı devam eder. Bu sayfadan ayrıldıktan sonra aynı oyuncuya geri dönemezsin.</p><div class="modal-actions"><button class="secondary" id="stay">Savaşa dön</button><button class="primary" id="leave">Ayrıl</button></div>`,
  );
  $("stay").onclick = closeModal;
  $("leave").onclick = leaveGame;
}
$("brand").onclick = () => {
  if (started || modalType === "lobby") confirmLeave();
  else closeModal();
};
function setSelected(ids: number[], append = false) {
  if (!append) selected.clear();
  for (const id of ids) selected.add(id);
  world.selected = selected;
  renderHUD();
}
world.onSelect = setSelected;
world.onOrder = (x, z, target, attack) => {
  if (!selected.size) {
    toast("Önce bir birlik seç.");
    return;
  }
  net.send({
    type: "order",
    ids: [...selected],
    order: target >= 0 ? "attack" : attack ? "attackmove" : "move",
    x,
    z,
    target,
  });
};
world.onAction = (action) => {
  if (!modalType) {
    world.onInput();
    net.send({ type: "action", action });
  }
};
world.onInput = () => {
  if (started && world.heroMode && net.status === "online")
    net.send({
      type: "input",
      input: modalType
        ? { x: 0, z: 0, facing: world.heroYaw, block: false }
        : world.heroInput(),
    });
};
$("select-all").onclick = () =>
  setSelected(
    game?.squads
      .filter((s) => s.owner === net.owner && s.alive > 0)
      .map((s) => s.id) ?? [],
  );
$("focus-base").onclick = () => world.focusBase();
$("room-code").onclick = copyRoom;
function order(order: string) {
  if (!selected.size) {
    toast("Önce bir birlik seç.");
    return;
  }
  net.send({ type: "order", ids: [...selected], order });
}
$("hold-order").onclick = () => order("hold");
$("retreat-order").onclick = () => order("retreat");
$("attack-order").onclick = () => {
  world.attackMove = true;
  toast("Saldırarak ilerlemek için hedef noktaya tıkla. [F]");
};
$("dismiss-order").onclick = () => {
  if (!selected.size) return;
  openModal(
    "dismiss",
    `<div class="eyebrow">BİRLİK YÖNETİMİ</div><h2>${selected.size} birlik terhis edilsin mi?</h2><p>Boşalan kapasiteye farklı sınıflar çağırabilirsin. Aktif çatışmadaki birlikler terhis edilemez.</p><button class="primary" id="confirm-dismiss">TERHİS ET</button>`,
  );
  $("confirm-dismiss").onclick = () => {
    net.send({ type: "dismiss", ids: [...selected] });
    closeModal();
  };
};
function setFormation(index: number) {
  if (!selected.size) {
    toast("Dizilim değiştirmek için birlik seç.");
    return;
  }
  net.send({ type: "formation", ids: [...selected], formation: index });
  toast(
    rules.factions[net.owner].formations[index].name + " · dizilim alınıyor",
  );
}
function renderDock() {
  if (!game) return;
  const f = rules.factions[net.owner];
  $("army-title").textContent = f.name.toUpperCase();
  $("recruit-grid").innerHTML = f.units
    .map(
      (u, i) =>
        `<button class="recruit-card" data-recruit="${i}" title="${u.name} · 25 asker · ${u.cooldown} saniye">${icon(unitIcon(u.kind), 26)}<strong>${u.short}</strong><small>25 asker · ${u.cooldown} sn</small><span class="plus-badge">+</span></button>`,
    )
    .join("");
  $("formation-options").innerHTML = f.formations
    .map(
      (f, i) =>
        `<button class="formation-button" data-formation="${i}" title="${f.description}">${formationDiagram(f.shape)}<span>${f.name}</span><small>${["Z", "X", "C"][i]}</small></button>`,
    )
    .join("");
}
$("recruit-grid").addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-recruit]");
  if (el) net.send({ type: "recruit", class: +el.dataset.recruit! });
});
$("formation-options").addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-formation]");
  if (el) setFormation(+el.dataset.formation!);
});
$("army-list").addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-squad]");
  if (el) {
    const id = +el.dataset.squad!;
    setSelected([id], e.shiftKey);
    const s = game?.squads.find((s) => s.id === id);
    if (s && e.detail === 2) world.focusPoint(s.x, s.z);
  }
});
function renderHUD() {
  if (!game) return;
  const p = game.players[net.owner];
  if (!p) return;
  const mine = game.squads.filter((s) => s.owner === net.owner),
    alive = mine.reduce((n, s) => n + s.alive, 0),
    outposts = game.outposts.filter((o) => o.owner === net.owner).length,
    bases = game.bases.filter(
      (b) => b.owner === net.owner && b.stage === "active",
    ).length;
  const roster = mine.length * 25;
  setHUD(
    "top-stats",
    `<div class="stat">${icon("users", 17)}<div><strong>${alive} <span style="color:#7d9673;font-size:11px">/ ${p.capacity}</span></strong><small>ASKER / KAPASİTE</small></div></div><div class="stat">${icon("flag", 17)}<div><strong>${outposts}<span style="color:#7d9673;font-size:11px"> / 4</span></strong><small>OUTPOST</small></div></div><div class="stat">${icon("castle", 17)}<div><strong>${bases}</strong><small>FAAL ÜS</small></div></div><div class="stat timer">${icon("clock", 17)}<div><strong>${timeText(1200 - game.time)}</strong><small>KALAN SÜRE</small></div></div>`,
  );
  $("room-code").textContent = game.room;
  setHUD("net-status", `<i class="status-dot"></i>${net.latency} ms`);
  $("army-roster").textContent = `${mine.length} BİRLİK`;
  if (!world.heroMode)
    setHUD(
      "army-list",
      mine
        .map((s, i) => {
          const u = rules.factions[net.owner].units[s.class];
          const status =
            s.alive === 0
              ? bases === 0
                ? "Üs gerekli"
                : roster > p.capacity
                  ? "Kapasite bekliyor"
                  : `${Math.max(0, Math.ceil(s.respawn - game!.time))} sn · takviye`
              : s.notice > game!.time
                ? "Yan saldırı · tepki gecikmesi"
                : s.engaged
                  ? "Çatışmada"
                  : s.order === "retreat"
                    ? "Ana üsse dönüyor"
                    : s.order === "move" || s.order === "attackmove"
                      ? "İlerliyor"
                      : s.alive < 25
                        ? "Üs yakınında takviye al"
                        : "Hazır";
          return `<button class="army-row ${selected.has(s.id) ? "selected" : ""} ${s.alive === 0 ? "dead" : ""}" data-squad="${s.id}" aria-pressed="${selected.has(s.id)}"><span class="unit-mini-icon">${icon(unitIcon(u.kind), 22)}</span><span class="army-info"><strong>${u.short}</strong><small>${status}</small><span class="row-hp"><i style="width:${(s.hp / (u.hp * 25)) * 100}%"></i></span></span><span class="army-count">${s.alive}<small style="font-size:7px;color:#859b79">${i < 9 ? "[" + (i + 1) + "]" : ""}</small></span></button>`;
        })
        .join(""),
    );
  $("capacity-hint").textContent = `${roster}/${p.capacity} tahsisli`;
  document
    .querySelectorAll<HTMLButtonElement>("[data-recruit]")
    .forEach((b) => (b.disabled = roster + 25 > p.capacity || bases === 0));
  $("selection-title").textContent = selected.size
    ? `${selected.size} BİRLİK SEÇİLİ`
    : "DİZİLİM SEÇ";
  const forms = mine.filter((s) => selected.has(s.id)).map((s) => s.formation);
  document
    .querySelectorAll<HTMLElement>("[data-formation]")
    .forEach((b) =>
      b.classList.toggle(
        "active",
        forms.length > 0 && forms.every((f) => f === +b.dataset.formation!),
      ),
    );
  setHUD(
    "event-feed",
    game.events
      .filter((e) => game!.time - e.time < 14)
      .slice(-3)
      .map(
        (e) =>
          `<div class="event-item"><small>${timeText(e.time)}</small>${esc(e.text)}</div>`,
      )
      .join(""),
  );
  if (
    game.events.some(
      (e) => e.id > lastEvent && e.kind === "capture" && e.owner === net.owner,
    )
  ) {
    toast("Outpost ele geçirildi. +25 kapasite; yeni birlik çağırabilirsin.");
  }
  lastEvent = game.events.at(-1)?.id ?? 0;
  const terrain = terrainAt(game.map, world.lastHover.x, world.lastHover.z);
  const text: Record<string, [string, string]> = {
    plain: ["Açık arazi", "Süvari hücumu için uygun"],
    forest: ["Orman", "Süvari yavaşlar · ok hasarı azalır"],
    hill: ["Yüksek arazi", "Menzilli birliklere +%20 menzil"],
    sand: ["Kumluk", "Develere +%15 hız"],
    marsh: ["Bataklık", "Ağır birlikler daha fazla yavaşlar"],
    pass: ["Dar geçit", "Geniş dizilimlere −%20 hız"],
  };
  setHUD("terrain-info", `<b>${text[terrain][0]}</b>${text[terrain][1]}`);
  const h = game.heroes.find((h) => h.owner === net.owner);
  if (h) {
    $<HTMLButtonElement>("hero-toggle").disabled = h.hp <= 0;
    setHUD(
      "hero-toggle",
      `${icon("swords", 17)} ${h.hp <= 0 ? `KAHRAMAN · ${Math.max(0, Math.ceil(h.respawn - game.time))} sn` : "KAHRAMANA GEÇ"} <kbd class="key">TAB</kbd>`,
    );
    if (world.heroMode) {
      setHUD(
        "hero-hud",
        `<div class="hero-hud-title"><span>${rules.heroes[h.class].name} · ${rules.factions[net.owner].name}</span><span>${Math.ceil(h.hp)} <small style="font-size:10px;color:#80966e">/ ${rules.heroes[h.class].hp}</small></span></div><div class="hero-bars"><div class="hero-bar"><i style="width:${(h.hp / rules.heroes[h.class].hp) * 100}%"></i></div><div class="hero-bar stamina"><i style="width:${h.stamina}%"></i></div></div><div class="hero-controls"><span><kbd class="key">SOL</kbd> ${h.class === 2 ? "Atış" : "Vur · 3 tık seri"}</span><span><kbd class="key">SAĞ</kbd> Blok</span><span><kbd class="key">SHIFT</kbd> Kaçın</span><span><kbd class="key">Q</kbd> ${h.skillReady > game.time ? Math.ceil(h.skillReady - game.time) + " sn" : "Yetenek"}</span></div>${h.hp <= 0 ? `<p style="margin:10px 0 0;font-size:10px">${bases ? Math.max(0, Math.ceil(h.respawn - game.time)) + " sn sonra ana üste doğacaksın." : "Yeniden doğmak için faal üs gerekli."}</p>` : ""}`,
      );
      $("hero-hint").classList.toggle("hidden", !!modalType);
    }
  }
  drawMinimap();
  setHUD(
    "header-status",
    `<i class="status-dot"></i>${Math.round(world.fps)} FPS &nbsp; · &nbsp; ${net.status === "online" ? "BAĞLI" : "BAĞLANTI KOPTU"}`,
  );
}
function toggleHero() {
  if (!game || game.phase !== "battle") return;
  const h = game.heroes.find((h) => h.owner === net.owner);
  if (!world.heroMode && (!h || h.hp <= 0)) {
    toast("Kahramanın yeniden doğmasını bekle.");
    return;
  }
  if (world.heroMode) {
    world.exitHero();
    net.send({ type: "hero", active: false });
  } else {
    world.enterHero();
    net.send({ type: "hero", active: true });
  }
  document.body.classList.toggle("hero-active", world.heroMode);
  for (const id of ["hero-hud", "crosshair", "hero-exit"])
    $(id).classList.toggle("hidden", !world.heroMode);
  $("hero-hint").classList.add("hidden");
  renderHUD();
}
$("hero-toggle").onclick = toggleHero;
$("hero-exit").onclick = toggleHero;

setInterval(() => world.onInput(), 50);
function drawMinimap() {
  if (!game) return;
  const canvas = $<HTMLCanvasElement>("minimap"),
    ctx = canvas.getContext("2d")!;
  const w = canvas.width,
    h = canvas.height;
  const map = rules.maps[game.map];
  ctx.fillStyle =
    map.biome === "grass"
      ? "#526347"
      : map.biome === "snow"
        ? "#81938a"
        : "#948361";
  ctx.fillRect(0, 0, w, h);
  const px = (x: number) => (x / map.size + .5) * w,
    pz = (z: number) => (z / map.size + .5) * h;
  for (const v of map.zones) {
    ctx.fillStyle = (
      {
        forest: "#344f37",
        hill: "#a4a282",
        sand: "#aa9468",
        pass: "#c0ac7f",
        marsh: "#577c79",
      } as Record<string, string>
    )[v.kind];
    ctx.beginPath();
    ctx.ellipse(
      px(v.x),
      pz(v.z),
      (v.rx / map.size) * w,
      (v.rz / map.size) * h,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.strokeStyle = "#c9bb8a44";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, h);
  ctx.moveTo(w, 0);
  ctx.lineTo(0, h);
  ctx.stroke();
  for (const o of map.obstacles) {
    ctx.fillStyle = "#474e41";
    ctx.beginPath();
    ctx.ellipse(
      px(o.x),
      pz(o.z),
      (o.r / map.size) * w,
      (o.r / map.size) * h,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  for (const b of game.bases) {
    ctx.fillStyle = b.owner < 0 ? "#5d6851" : rules.factions[b.owner].color;
    ctx.fillRect(px(b.x) - 9, pz(b.z) - 8, 18, 16);
    if (b.id === game.players[net.owner]?.mainBase) {
      ctx.strokeStyle = "#faf2be";
      ctx.lineWidth = 2;
      ctx.strokeRect(px(b.x) - 12, pz(b.z) - 11, 24, 22);
    }
  }
  for (const o of game.outposts) {
    ctx.fillStyle = o.owner < 0 ? "#e2d6a4" : rules.factions[o.owner].color;
    ctx.beginPath();
    ctx.moveTo(px(o.x), pz(o.z) - 6);
    ctx.lineTo(px(o.x) + 6, pz(o.z));
    ctx.lineTo(px(o.x), pz(o.z) + 6);
    ctx.lineTo(px(o.x) - 6, pz(o.z));
    ctx.fill();
  }
  for (const s of game.squads) {
    if (s.alive === 0) continue;
    ctx.fillStyle = rules.factions[s.owner].color;
    ctx.beginPath();
    ctx.arc(px(s.x), pz(s.z), selected.has(s.id) ? 4.5 : 3, 0, 7);
    ctx.fill();
    if (selected.has(s.id)) {
      ctx.strokeStyle = "#fff7cf";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  const hero = game.heroes.find((h) => h.owner === net.owner);
  if (hero && hero.hp > 0) {
    ctx.fillStyle = "#ffe1a0";
    ctx.fillRect(px(hero.x) - 3, pz(hero.z) - 3, 6, 6);
  }
  ctx.strokeStyle = "#ede5bc8c";
  ctx.lineWidth = 1.5;
  const extent = world.distance * 0.45;
  ctx.strokeRect(
    px(world.focus.x - extent * 0.8),
    pz(world.focus.z - extent * 0.5),
    ((extent * 1.6) / map.size) * w,
    (extent / map.size) * h,
  );
}
$("minimap").addEventListener("pointerdown", (e) => {
  const r = $("minimap").getBoundingClientRect();
  const x = clamp(((e.clientX - r.left) / r.width) * fieldSize - fieldSize/2, -fieldLimit, fieldLimit),
    z = clamp(((e.clientY - r.top) / r.height) * fieldSize - fieldSize/2, -fieldLimit, fieldLimit);
  if (e.button === 2) {
    world.onOrder(x, z, -1, true);
    world.marker(x, z, true);
  } else world.focusPoint(x, z);
});
$("minimap").oncontextmenu = (e) => e.preventDefault();
function showGuide(faction = chosenFaction) {
  guideFaction = faction;
  const f = rules.factions[faction];
  openModal(
    "guide",
    `<div class="eyebrow">SAHA EL KİTABI</div><h2>Her sancağın bir savaş dili var.</h2><div class="guide-tabs">${rules.factions.map((f, i) => `<button data-guide="${i}" class="${i === faction ? "active" : ""}">${f.name}</button>`).join("")}</div><p>${f.description}</p><div class="guide-units">${f.units.map((u) => `<article class="guide-unit">${icon(unitIcon(u.kind), 30)}<h4>${u.name}</h4><p>${u.role}</p><dl><dt>Asker</dt><dd>25</dd><dt>Can / asker</dt><dd>${u.hp}</dd><dt>Hasar / sn</dt><dd>${u.damage}</dd><dt>Zırh</dt><dd>${Math.round(u.armor * 100)}%</dd><dt>Hız</dt><dd>${u.speed}</dd><dt>Menzil</dt><dd>${u.range}</dd><dt>Takviye</dt><dd>${u.cooldown} sn</dd><dt>Tepki süresi</dt><dd>${u.notice} sn</dd></dl></article>`).join("")}</div><h3>Faction dizilimleri</h3><div class="guide-formations">${f.formations.map((f) => `<div class="guide-formation">${formationDiagram(f.shape)}<div><strong>${f.name}</strong><p>${f.description}</p></div></div>`).join("")}</div><div class="tip-box">Ön cephe hasarı dizilime göre değişir. Yan saldırı temel olarak ×1,4; arka saldırı ×2 hasar verir. Çember savunması her yönde aynıdır. Kahraman vuruşları da dizilim ve zırh savunmasına tabidir. Aktif çatışmada yandan yakalanan birlik, tepki süresi dolana kadar yön değiştiremez. Kargıcılar, ağır süvariye önden zayıf; yan ve arkadan güçlüdür.</div><p class="credits">Denge değerleri ilk oynanabilir sürüme aittir; “meta yok” iddiası için farklı oyuncularla maç verisi gerekir.</p>`,
    true,
  );
  document
    .querySelectorAll<HTMLElement>("[data-guide]")
    .forEach((el) => (el.onclick = () => showGuide(+el.dataset.guide!)));
}
function showHelp() {
  openModal(
    "help",
    `<div class="eyebrow">KOMUTANIN EL KİTABI</div><h2>Önce mevzi. Sonra zamanlama.</h2><div class="how-grid"><section><h3>RTS komutları</h3><div class="help-keys"><div><kbd class="key">SOL TIK / SÜRÜKLE</kbd> Birlik seç · Shift ile ekle</div><div><kbd class="key">SAĞ TIK</kbd> Hareket / düşmana saldır</div><div><kbd class="key">F + SOL TIK</kbd> Saldırarak ilerle</div><div><kbd class="key">W A S D</kbd> Kamerayı taşı</div><div><kbd class="key">Q / E · TEKERLEK</kbd> Kamerayı döndür · yakınlaş</div><div><kbd class="key">1–9 · CTRL+1–9</kbd> Birlik/grup seç · grup kaydet</div><div><kbd class="key">Z / X / C</kbd> Faction dizilimini değiştir</div><div><kbd class="key">H / R</kbd> Mevziyi koru / ana üsse dön</div></div></section><section><h3>Kahraman kontrolü</h3><div class="help-keys"><div><kbd class="key">TAB</kbd> RTS / üçüncü şahıs geçişi</div><div><kbd class="key">WASD / OKLAR</kbd> Hareket et</div><div><kbd class="key">ORTA TUŞ + SÜRÜKLE</kbd> Kamera ve karakteri döndür</div><div><kbd class="key">SOL / SAĞ TIK</kbd> Saldır / önden blokla</div><div><kbd class="key">SPACE</kbd> Zıpla</div><div><kbd class="key">SHIFT</kbd> Yön + kaçın · Yönsüz: geri</div><div><kbd class="key">Q</kbd> Sınıf yeteneği · 25 dayanıklılık</div><div><kbd class="key">ESC</kbd> Kamera sürüklemesini bırak</div></div><p>Kahraman 20 saniyede faal ana üste döner. Kahramanı yönetirken birlikler son emirlerini uygulamaya devam eder.</p></section><section><h3>Ele geçir. Yerini koru.</h3><p>Başlangıç: 4 birlik × 25 asker = 100 kapasite. Outpostta 9 saniye kal: +25 kapasite. Rakip üssü yık ve bölgede 14 saniye kal: yeni faal üs. İlk faal üs 100, diğer her üs +50 kapasite verir.</p><p>Ana üssün düşerse başka bir faal üssün ana üs olur. Fazla kapasitedeki mevcut askerler silinmez; yeni asker ve takviyeler kapasite geri gelene kadar bekler. Çekişmeli bölgelerde ele geçirme durur.</p></section><section><h3>Takviye ve zafer</h3><p>Eksik askerler sınıf bekleme süresinden sonra, herhangi bir dost üssün yakınında ve çatışma dışında yenilenir. Tamamen düşen birlik ana üste yeniden doğar. Birlik çağırmak para gerektirmez; kapasite ve süre yeterlidir.</p><p>Son faal faction kazanır. 20 dakika dolarsa kapasite × 4 + düşürülen asker puanı karşılaştırılır; eşit puan beraberliktir. Üssüz, askersiz ve kahramansız faction elenir.</p></section></div><div class="tip-box">Senaryo: Viking kalkanlıları şövalyeleri cephede tutarken Türk kargıcıları arkadan vurur. Şövalyelerin tepki süresi bitmeden ikinci saldırı çok daha etkili olur. Dar geçitler, orman örtüsü ve yüksek arazi bu zamanlamayı değiştirir.</div><p class="credits">3D çevre: <a href="https://kenney.nl/assets/castle-kit" target="_blank" rel="noreferrer">Kenney Castle Kit</a> ve <a href="https://kenney.nl/assets/nature-kit" target="_blank" rel="noreferrer">Nature Kit</a> · CC0. Karakter ve animasyonlar: KayKit (CC0). Binekler ve sesler prosedüreldir.</p>`,
    true,
  );
}
function showSettings() {
  openModal(
    "settings",
    `<div class="eyebrow">SAHA AYARLARI</div><h2>Görünüm ve ses.</h2><div class="settings-row"><label for="quality">Görüntü kalitesi</label><select id="quality"><option value="high">Yüksek · gölgeler açık</option><option value="low">Performans · gölgeler kapalı</option></select></div><div class="settings-row"><label for="sound-setting">Komut ve çatışma sesleri</label><select id="sound-setting"><option value="off" ${!world.sound ? "selected" : ""}>Kapalı</option><option value="on" ${world.sound ? "selected" : ""}>Açık</option></select></div><p>Performans modu piksel yoğunluğunu düşürür ve gölgeleri kapatır. Birlik sayısı ve oyun kuralları aynı kalır.</p>${started ? '<button class="secondary" id="settings-leave" style="width:100%;margin-top:25px">Savaştan ayrıl</button>' : ""}<p class="credits">IRONFRONT v0.1 · Three.js + Go · 20 Hz simülasyon<br>Maçlar bellekte yaşar; sunucu yeniden başlarsa sona erer.</p>`,
  );
  $<HTMLSelectElement>("quality").value =
    localStorage.getItem("ironfront-quality") || "high";
  $("quality").onchange = (e) => {
    const q = (e.target as HTMLSelectElement).value;
    world.setQuality(q);
    try {
      localStorage.setItem("ironfront-quality", q);
    } catch {}
  };
  $("sound-setting").onchange = (e) =>
    setSound((e.target as HTMLSelectElement).value === "on");
  if (started) $("settings-leave").onclick = confirmLeave;
}
function setSound(on: boolean) {
  world.setSound(on);
  $("sound-button").innerHTML = icon(on ? "volume" : "mute", 16);
  $("sound-button").title = on ? "Sesi kapat" : "Sesi aç";
  $("sound-button").setAttribute("aria-label", on ? "Sesi kapat" : "Sesi aç");
}
$("sound-button").onclick = () => setSound(!world.sound);
$("settings-button").onclick = showSettings;
$("help-button").onclick = showHelp;
document
  .querySelectorAll<HTMLElement>("[data-nav]")
  .forEach(
    (el) =>
      (el.onclick = () =>
        el.dataset.nav === "drill"
          ? window.open("/drill.html", "_blank", "noopener")
          : el.dataset.nav === "guide"
            ? showGuide()
            : el.dataset.nav === "help"
              ? showHelp()
              : closeModal()),
  );
function showResult() {
  if (!game) return;
  if (world.heroMode) {
    world.exitHero();
    document.body.classList.remove("hero-active");
  }
  const won = game.winner === net.owner,
    draw = game.winner < 0,
    p = game.players[net.owner]!;
  openModal(
    "result",
    `<div class="result-emblem">${icon(game.winner < 0 ? "swords" : rules.factions[game.winner].emblem, 65)}</div><div class="result-title"><div class="eyebrow" style="justify-content:center">SAVAŞ SONA ERDİ</div><h2>${draw ? "Sancaklar dengede." : won ? "Meydan senin." : rules.factions[game.winner].name + " galip geldi."}</h2><p>${won ? "Zamanlama ve mevzi üstünlüğü zafer getirdi." : "Yeni bir dizilim, farklı bir cephe. Sonraki savaş seni bekliyor."}</p></div><div class="result-stats"><div><strong>${p.kills}</strong><small>DÜŞÜRÜLEN ASKER</small></div><div><strong>${p.capacity}</strong><small>SON KAPASİTE</small></div><div><strong>${timeText(game.time)}</strong><small>SAVAŞ SÜRESİ</small></div></div><button class="primary" id="result-home">SANCAKLARA DÖN ${icon("arrow", 16)}</button>`,
  );
  $("result-home").onclick = leaveGame;
}
window.addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).matches("input,textarea,select")) return;
  if (e.code === "Escape") {
    if (modalType && modalType !== "lobby" && modalType !== "result")
      closeModal();
    else world.attackMove = false;
    return;
  }
  if (modalType) return;
  if (e.code === "Tab" && started) {
    e.preventDefault();
    if (!e.repeat) toggleHero();
    return;
  }
  if (!started || world.heroMode) return;
  if (e.ctrlKey && e.code === "KeyA") {
    e.preventDefault();
    $("select-all").click();
    return;
  }
  if (e.code.startsWith("Digit")) {
    const digit = e.code.slice(-1);
    if (e.ctrlKey) {
      e.preventDefault();
      groups.set(digit, [...selected]);
      toast("Kontrol grubu " + digit + " kaydedildi");
    } else {
      const ids =
        groups.get(digit) ??
        game!.squads
          .filter((s) => s.owner === net.owner)
          .slice(+digit - 1, +digit)
          .map((s) => s.id);
      setSelected(ids, e.shiftKey);
    }
    return;
  }
  if (e.repeat) return;
  if (e.code === "KeyF") $("attack-order").click();
  if (e.code === "KeyH") order("hold");
  if (e.code === "KeyR") order("retreat");
  if (e.code === "KeyZ") setFormation(0);
  if (e.code === "KeyX") setFormation(1);
  if (e.code === "KeyC") setFormation(2);
});
try {
  world.setQuality(localStorage.getItem("ironfront-quality") || "high");
} catch {}
window.addEventListener("beforeunload", () => net.disconnect());
