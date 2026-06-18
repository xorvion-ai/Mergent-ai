/* ============================================================
   Mergent AI — bundled sample repos
   Real multi-language source under /samples. Used for the
   zero-config demo and as the fallback when a clone or quota
   check fails, so a demo never hard-fails.
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

export const SAMPLES = [
  {
    id: "commerce-platform",
    name: "acme/commerce-platform",
    dir: "commerce-platform",
    langs: "Java · TS · Python · Go",
    services: 8,
    blurb: "Flagship multi-service sprawl. A 3-service auth cycle, shared user & billing tables, duplicate login + user APIs.",
  },
];

/** Resolve a sample by name/id to its directory + meta. Returns null if missing. */
export function resolveSample(nameOrId) {
  const s =
    SAMPLES.find((x) => x.id === nameOrId || x.name === nameOrId) ||
    SAMPLES.find((x) => nameOrId && (nameOrId.includes(x.id) || x.name.includes(nameOrId)));
  const pick = s || SAMPLES[0];
  const dir = path.join(config.samplesDir, pick.dir);
  if (!fs.existsSync(dir)) return null;
  return {
    dir,
    meta: { name: pick.name, url: null, source: "sample", branch: "main", commit: "sample" },
    sample: pick,
  };
}

export function defaultSample() {
  return resolveSample(SAMPLES[0].id);
}
