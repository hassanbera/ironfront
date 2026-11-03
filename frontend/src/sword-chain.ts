import { rules } from "./types";

export const swordSteps = rules.swordChain.steps;
const stockMotions = ["backslash", "slash", "stab"] as const;
export const swordMotion = (step: number, fitted: boolean) =>
  fitted && step === 0 ? "risingCut" : stockMotions[step];
export const swordLabels = ["Sağdan kesiş", "Soldan kesiş", "Saplama"] as const;

// Retain the blade on the exit side between beats. The opening cut rises from
// the sword hand, the return cut crosses back, then the wrist chambers the point.
const returning = [.19, .30, .42, .55, .70];
const thrust = [.04, .23, .48, .57, .98];
const stockOpening = [.79, .52, .40, .29, .18];
const stockReturn = [.13, .20, .25, .39, .63];
const stockThrust = [.04, .22, .32, .47, .99];
const stockPaths = [stockOpening, stockReturn, stockThrust];

export function swordPhase(step: number, progress: number, model: string, fitted: boolean) {
  if (fitted && step === 0) return progress; // Baked rising cut already uses the beat clock.
  const path = fitted ? (step === 1 ? returning : thrust) : stockPaths[step];
  const impact = swordSteps[step].impact;
  // The fitted rigs' baked lateral crossings are at different source frames.
  const contact = fitted && step < 2 && model === "knight" ? .45 : path[2];
  const t = Math.max(0, Math.min(progress, 1));
  if (t < .22) return path[0] + (path[1]-path[0]) * t/.22;
  if (t < impact) return path[1] + (contact-path[1]) * (t-.22)/(impact-.22);
  if (t < .68) return contact + (path[3]-contact) * (t-impact)/(.68-impact);
  return path[3] + (path[4]-path[3]) * (t-.68)/.32;
}
