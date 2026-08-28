// Number formatting for agent tool output.
//
// Mirrors the conventions in lib/voice/script.ts (Indian digit grouping, spoken
// percent) so tool results and the voice scripts agree on every figure. Small
// duplication of two pure helpers is preferable to a cross-import that drags the
// voice layer into the agent's dependency graph.

/** Paise -> "9,34,188.36" with Indian (lakh) digit grouping. */
export function rupees(paise: number): string {
  const s = (Math.abs(paise) / 100).toFixed(2);
  const [whole, frac] = s.split(".");
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return `${grouped}.${frac}`;
}

/** Basis points -> "13.73 percent". */
export function percent(bps: number): string {
  return `${(bps / 100).toFixed(2)} percent`;
}

/** Settlement days -> spoken phrase. */
export function settlement(days: number): string {
  if (days === 0) return "the same day";
  if (days === 1) return "the next day";
  return `in ${days} days`;
}
