/* ============================================================
   Mergent AI — Gemini implementation
   Thin wrapper around @google/generative-ai. Forces JSON output.
   Isolated here so the provider could be swapped (Groq, Ollama,
   Claude) by adding a sibling file.
   ============================================================ */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";

let client = null;
function getClient() {
  if (!config.gemini.apiKey) throw new Error("GEMINI_API_KEY not set");
  if (!client) client = new GoogleGenerativeAI(config.gemini.apiKey);
  return client;
}

/** Call Gemini and parse a JSON object from the response. */
export async function geminiReasonJSON({ system, prompt }) {
  const model = getClient().getGenerativeModel({
    model: config.gemini.model,
    systemInstruction: system,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return parseJSON(text);
}

/** Tolerant JSON parse — strips accidental code fences. */
function parseJSON(text) {
  let t = String(text).trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first > 0 || last < t.length - 1) t = t.slice(first, last + 1);
  return JSON.parse(t);
}
