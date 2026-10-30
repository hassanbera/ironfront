const paths: Record<string, string> = {
  shield:
    '<path d="M12 3 3 7v5c0 6 9 10 9 10s9-4 9-10V7Z"/><path d="M12 7v10M8 11h8"/>',
  swords:
    '<path d="m3 3 6 2 12 14-2 2L5 9Zm18 0-6 2-5 6M3 21l6-6M16 16l-2 4M8 16l2 4"/>',
  axe: '<path d="m6 22 9-15M13 3l8 5-6 5-5-3 1-4Z"/><path d="m3 8 5-5 5 4-4 6Z"/>',
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M20 4l-2 2M6 18l-2 2"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/><path d="m18 3 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>',
  flag: '<path d="M5 22V3h14l-3 5 3 5H5"/>',
  castle: '<path d="M3 22V7h4v4h3V4h4v7h3V7h4v15ZM10 22v-6h4v6"/>',
  crosshair:
    '<circle cx="12" cy="12" r="7"/><path d="M12 1v6m0 10v6M1 12h6m10 0h6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  close: '<path d="m5 5 14 14M5 19 19 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3v.1"/>',
  settings:
    '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  volume:
    '<path d="M3 9h4l5-5v16l-5-5H3ZM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M3 9h4l5-5v16l-5-5H3Zm13 0 6 6m-6 0 6-6"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  play: '<path d="m7 3 14 9-14 9Z"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  bow: '<path d="M5 3c20 2 20 16 0 18l5-9Zm0 9h17m-4-4 4 4-4 4"/>',
  horse:
    '<path d="m5 21 1-7 4-4-1-5 4-2 3 4 4 3-1 4-5-2-1 9M6 7l3-2"/><path d="M5 21h13"/>',
  spear: '<path d="m4 21 13-14-1-4 5-1-1 5-3 0"/>',
  boots: '<path d="M6 3h9v11l6 3v4H4v-7Z"/>',
  retreat: '<path d="M20 19v-7a5 5 0 0 0-5-5H4m5-5L4 7l5 5"/>',
  diamond: '<path d="m12 2 10 10-10 10L2 12Z"/>',
  mountain: '<path d="m2 21 8-17 12 17Zm5-10 3 2 3-3"/>',
  tree: '<path d="m12 2 7 10h-4l6 7H3l6-7H5Zm0 17v4"/>',
  lightning: '<path d="m13 2-9 12h7l-1 8 10-12h-8Z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  logout: '<path d="M10 3H3v18h7m-2-9h14m-5-5 5 5-5 5"/>',
};
export function icon(name: string, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.shield}</svg>`;
}
export function unitIcon(kind: string) {
  return ["cavalry", "camel", "lancer"].includes(kind)
    ? "horse"
    : ["archer", "horseArcher", "javelin"].includes(kind)
      ? "bow"
      : kind === "spear"
        ? "spear"
        : ["axe", "berserker"].includes(kind)
          ? "axe"
          : "swords";
}
export function formationDiagram(shape: string) {
  const points: Array<[number, number]> = [];
  for (let i = 0; i < 15; i++) {
    let x = 0,
      y = 0;
    if (shape === "wedge") {
      const row = Math.floor(Math.sqrt(i));
      x = 30 + (i - row * row - row) * 6;
      y = 5 + row * 10;
    } else if (shape === "circle") {
      const a = (i / 15) * Math.PI * 2;
      x = 30 + Math.cos(a) * 22;
      y = 24 + Math.sin(a) * 18;
    } else if (shape === "crescent") {
      const a = (i / 14) * Math.PI;
      x = 30 + Math.cos(a) * 24;
      y = 8 + Math.sin(a) * 27;
    } else if (shape === "loose") {
      x = 10 + (i % 5) * 11 + (Math.floor(i / 5) % 2) * 3;
      y = 7 + Math.floor(i / 5) * 14;
    } else {
      x = 8 + (i % 5) * 11;
      y = 10 + Math.floor(i / 5) * (shape === "wall" ? 6 : 11);
    }
    points.push([x, y]);
  }
  return `<svg viewBox="0 0 60 48" class="formation-diagram" aria-hidden="true">${points.map(([x, y]) => `<rect x="${x - 1.7}" y="${y - 1.7}" width="3.4" height="3.4" rx=".6" fill="currentColor"/>`).join("")}</svg>`;
}
