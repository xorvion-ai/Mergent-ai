/* ============================================================
   Mergent AI — LLM provider
   The "reason" half of every agent goes through reason(). We pass
   ONLY extracted facts (never raw repo source) — this is the core
   hybrid principle. Gemini is used when a key is present; otherwise
   a deterministic fallback keeps the platform fully free + working.
   ============================================================ */
import { config } from "../config.js";
import { geminiReasonJSON } from "./gemini.js";

/** Process-wide call counter (drives the UI quota meter). */
export const usage = {
  calls: 0,
  budget: config.gemini.dailyBudget,
  mode: config.hasLLM ? "gemini" : "deterministic",
};

/**
 * Reason over facts and return a validated JSON object.
 *
 * @param {string}   label        agent label (for logs)
 * @param {object}   opts
 * @param {string}   opts.instruction  what to produce
 * @param {object}   opts.facts        the extracted facts (the ONLY thing the model sees)
 * @param {function} opts.validate     (obj) => boolean — shape check
 * @param {function} opts.fallback     (facts) => obj — deterministic result when no/failed LLM
 * @param {function} [onLog]      optional logger(msg)
 */
export async function reason(label, { instruction, facts, validate, fallback }, onLog) {
  const log = onLog || (() => {});

  if (!config.hasLLM) {
    log(`reason(${label}) · deterministic (no GEMINI_API_KEY)`);
    return fallback(facts);
  }

  const system =
    "You are a senior platform architect analyzing a microservice estate for consolidation. " +
    "You are given ONLY pre-extracted structured facts (never raw source code). " +
    "Reason over those facts and respond with a single JSON object that exactly matches the requested shape. " +
    "Do not invent services, endpoints, or databases that are not present in the facts. " +
    "Respond with JSON only — no prose, no markdown fences.";

  const prompt = `${instruction}\n\nFACTS (JSON):\n${JSON.stringify(facts)}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const obj = await geminiReasonJSON({ system, prompt });
      usage.calls++;
      if (validate(obj)) return obj;
      log(`reason(${label}) · attempt ${attempt} failed validation, retrying`);
    } catch (err) {
      log(`reason(${label}) · attempt ${attempt} error: ${err.message}`);
      // Quota / network errors: stop trying and fall back gracefully.
      if (/quota|rate|429|exhaust/i.test(err.message)) break;
    }
  }

  log(`reason(${label}) · falling back to deterministic result`);
  return fallback(facts);
}
