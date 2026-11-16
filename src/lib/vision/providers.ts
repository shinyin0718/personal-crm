import "server-only";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { CARD_JSON_SCHEMA, CARD_PROMPT, extractJsonObject } from "./parse";

export interface CardImage {
  data: Buffer;
  mimeType: string;
}

export interface VisionResult {
  raw: unknown;
  provider: string;
  model: string;
}

const TIMEOUT_MS = 45_000;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function statusOf(err: unknown): number | undefined {
  const e = err as { status?: number; code?: number };
  return typeof e?.status === "number" ? e.status : typeof e?.code === "number" ? e.code : undefined;
}

// Free-tier Gemini models each have their own daily quota and are often busy,
// so fall through the list on 404/429/5xx (but not on timeouts, which may use quota).
async function gemini(image: CardImage): Promise<VisionResult> {
  const ai = new GoogleGenAI({
    apiKey: requireEnv("GEMINI_API_KEY"),
    // responseJsonSchema and the *-latest aliases are only on v1beta.
    httpOptions: { timeout: TIMEOUT_MS, apiVersion: "v1beta" },
  });
  const models = (process.env.GEMINI_MODELS || "gemini-flash-latest,gemini-flash-lite-latest")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  let lastError: unknown;
  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: image.mimeType, data: image.data.toString("base64") } },
              { text: CARD_PROMPT },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: CARD_JSON_SCHEMA,
          temperature: 0,
        },
      });
      return { raw: extractJsonObject(res.text ?? ""), provider: "gemini", model };
    } catch (err) {
      lastError = err;
      const status = statusOf(err);
      if (![404, 429, 500, 503, 504].includes(status ?? 0)) throw err;
    }
  }
  throw lastError;
}

async function openai(image: CardImage): Promise<VisionResult> {
  const client = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY"), timeout: TIMEOUT_MS, maxRetries: 1 });
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const res = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: CARD_PROMPT },
          {
            type: "image_url",
            image_url: { url: `data:${image.mimeType};base64,${image.data.toString("base64")}` },
          },
        ],
      },
    ],
  });
  return {
    raw: extractJsonObject(res.choices[0]?.message?.content ?? ""),
    provider: "openai",
    model,
  };
}

async function anthropic(image: CardImage): Promise<VisionResult> {
  const client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY"), timeout: TIMEOUT_MS, maxRetries: 1 });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
  const res = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.mimeType as "image/jpeg" | "image/png" | "image/webp",
              data: image.data.toString("base64"),
            },
          },
          { type: "text", text: CARD_PROMPT },
        ],
      },
    ],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return { raw: extractJsonObject(text), provider: "anthropic", model };
}

const PROVIDERS = { gemini, openai, anthropic } as const;

export async function readCard(image: CardImage): Promise<VisionResult> {
  const name = (process.env.VISION_PROVIDER || "gemini").toLowerCase();
  const provider = PROVIDERS[name as keyof typeof PROVIDERS];
  if (!provider) throw new Error(`Unknown VISION_PROVIDER "${name}"`);
  return provider(image);
}
