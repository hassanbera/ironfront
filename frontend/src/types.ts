import data from "../../server/rules.json";
export const rules = data;
export type MapSpec = (typeof data.maps)[number];
export type Faction = (typeof data.factions)[number];
export type UnitSpec = Faction["units"][number];
export interface Player {
  id: number;
  name: string;
  faction: number;
  heroClass: number;
  connected: boolean;
  bot: boolean;
  eliminated: boolean;
  capacity: number;
  mainBase: number;
  kills: number;
}
export interface Squad {
  slots?: number[];
  id: number;
  owner: number;
  class: number;
  formation: number;
  x: number;
  z: number;
  facing: number;
  hp: number;
  alive: number;
  targetX: number;
  targetZ: number;
  order: string;
  target: number;
  engaged: boolean;
  notice: number;
  respawn: number;
  flash: number;
  attackAt: number;
  aimX: number;
  aimZ: number;
  flank: string;
}
export interface Base {
  id: number;
  owner: number;
  x: number;
  z: number;
  hp: number;
  stage: string;
  captor: number;
  progress: number;
  contested: boolean;
}
export interface Outpost {
  id: number;
  owner: number;
  x: number;
  z: number;
  captor: number;
  progress: number;
  contested: boolean;
}
export interface Hero {
  owner: number;
  class: number;
  x: number;
  z: number;
  y: number;
  facing: number;
  hp: number;
  stamina: number;
  active: boolean;
  block: boolean;
  respawn: number;
  attackAt: number;
  dodgeUntil: number;
  attackKind?: number;
  attackDuration?: number;
  attackImpact?: number;
  impactAt?: number;
  impactX?: number;
  impactZ?: number;
  impactDamage?: number;
  impactKind?: string;
  hitTargets?: {
    kind: string;
    id: number;
    slot: number;
    x: number;
    z: number;
    damage: number;
    blocked: boolean;
  }[];
  blockAt?: number;
  dodgeX?: number;
  dodgeZ?: number;
  skillReady: number;
  guardUntil: number;
}
export interface BattleEvent {
  id: number;
  time: number;
  text: string;
  kind: string;
  owner: number;
}
export interface GameState {
  crowd?: [number, number, number][];
  type: "state";
  room: string;
  phase: "lobby" | "battle" | "finished";
  map: number;
  time: number;
  host: number;
  players: (Player | null)[];
  squads: Squad[];
  bases: Base[];
  outposts: Outpost[];
  heroes: Hero[];
  events: BattleEvent[];
  winner: number;
  tick: number;
}
export const corners = [
  [-66, -66],
  [-66, 66],
  [66, -66],
  [66, 66],
];
export const posts = [
  [-30, -30],
  [-30, 30],
  [30, -30],
  [30, 30],
];
export function previewState(map = 0): GameState {
  return {
    type: "state",
    room: "",
    phase: "lobby",
    map,
    time: 0,
    host: 0,
    players: rules.factions.map((f, i) => ({
      id: i,
      name: f.name,
      faction: i,
      heroClass: 0,
      connected: false,
      bot: false,
      eliminated: false,
      capacity: 100,
      mainBase: i,
      kills: 0,
    })),
    squads: rules.factions.flatMap((_, i) =>
      Array.from({ length: 4 }, (_, j) => {
        const [x, z] = corners[i];
        return {
          id: i * 4 + j + 1,
          owner: i,
          class: j,
          formation: j === 0 ? 0 : 1,
          x: x - Math.sign(x) * 17 + (j % 2) * 10 - 5,
          z: z - Math.sign(z) * 17 + Math.floor(j / 2) * 10 - 5,
          facing: Math.atan2(-x, -z),
          hp: 2500,
          alive: 25,
          targetX: 0,
          targetZ: 0,
          order: "hold",
          target: -1,
          engaged: false,
          notice: 0,
          respawn: 0,
          flash: 0,
          attackAt: -10,
          aimX: 0,
          aimZ: 0,
          flank: "front",
        };
      }),
    ),
    bases: corners.map(([x, z], id) => ({
      id,
      owner: id,
      x,
      z,
      hp: 6000,
      stage: "active",
      captor: -1,
      progress: 0,
      contested: false,
    })),
    outposts: posts.map(([x, z], id) => ({
      id,
      owner: -1,
      x,
      z,
      captor: -1,
      progress: 0,
      contested: false,
    })),
    heroes: [],
    events: [],
    winner: -1,
    tick: 0,
  };
}
export const clamp = (x: number, a: number, b: number) =>
  Math.max(a, Math.min(b, x));
export const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const timeText = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;
export const isMounted = (k: string) =>
  ["cavalry", "camel", "lancer", "horseArcher"].includes(k);
export const isRanged = (k: string) =>
  ["archer", "horseArcher", "javelin"].includes(k);
export function terrainAt(map: number, x: number, z: number) {
  let kind = "plain";
  for (const v of rules.maps[map].zones)
    if (((x - v.x) / v.rx) ** 2 + ((z - v.z) / v.rz) ** 2 < 1) kind = v.kind;
  return kind;
}
