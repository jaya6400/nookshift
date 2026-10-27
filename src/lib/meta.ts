/**
 * Meta Model API client — server-only.
 * Keys come from process.env (set in .env.local), never from the client.
 * Model functions use safe starter data when MODEL_API_KEY is missing,
 * so the UI works offline during development.
 *
 * Base: https://api.meta.ai/v1 (OpenAI-compatible)
 */

const BASE = process.env.MODEL_BASE_URL ?? "https://api.meta.ai/v1";
const KEY = process.env.MODEL_API_KEY;

export const SPARK_MODEL = "muse-spark-1.3";
export const IMAGE_MODEL = "muse-image-1.0";
export const SAM_MODEL = "sam-3.1";

export type Operation = {
  action: "keep" | "remove" | "recolor" | "reposition";
  target: string;
  value?: string;
};

export type Plan = {
  goal: string;
  constraints: string[];
  operations: Operation[];
};

export type SamResults = {
  connected: boolean;
  boxes: { label: string; x: number; y: number; width: number; height: number }[];
  masks: { label: string; size: [number, number]; counts: number[] }[];
};

export const MOCK_PLAN: Plan = {
  goal: "Make the room feel open, calm and work-friendly",
  constraints: ["renter-friendly, no drilling", "keep existing furniture", "low budget"],
  operations: [
    { action: "remove", target: "clothes pile on chair" },
    { action: "recolor", target: "walls", value: "warm white" },
    { action: "reposition", target: "desk", value: "near the window" },
    { action: "keep", target: "bookshelf" },
  ],
};

function fallbackSam(): SamResults {
  return { connected: false, boxes: [], masks: [] };
}

/** Segment operation targets. If the optional SAM endpoint is unavailable, return labeled preview boxes. */
export async function callSam(
  operations: Operation[],
  imageBase64?: string | null
): Promise<SamResults> {
  if (!KEY || !imageBase64) return fallbackSam();

  try {
    const response = await fetch(`${BASE}/sam`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: SAM_MODEL,
        image: imageBase64,
        prompts: operations.slice(0, 4).map((operation) => operation.target),
      }),
    });
    if (!response.ok) return fallbackSam();

    const data = await response.json();
    const rawBoxes = Array.isArray(data?.boxes) ? data.boxes : [];
    const boxes = rawBoxes.flatMap((box: Record<string, unknown>, index: number) => {
      const bounds = Array.isArray(box.box) ? box.box : null;
      const x = Number(box.x ?? bounds?.[0]);
      const y = Number(box.y ?? bounds?.[1]);
      const width = Number(box.width ?? (bounds ? Number(bounds[2]) - x : NaN));
      const height = Number(box.height ?? (bounds ? Number(bounds[3]) - y : NaN));
      if (![x, y, width, height].every(Number.isFinite)) return [];
      return [{ label: String(box.label ?? box.prompt ?? operations[index]?.target ?? `Object ${index + 1}`), x, y, width, height }];
    });
    const rawMasks = Array.isArray(data?.masks) ? data.masks : [];
    const masks = rawMasks.flatMap((mask: Record<string, unknown>, index: number) => {
      const size = Array.isArray(mask.size) && mask.size.length === 2
        ? [Number(mask.size[0]), Number(mask.size[1])] as [number, number]
        : [768, 1024] as [number, number];
      const counts = Array.isArray(mask.counts) ? mask.counts.map(Number) : [];
      if (!counts.length) return [];
      return [{ label: String(mask.label ?? operations[index]?.target ?? `Object ${index + 1}`), size, counts }];
    });
    return { connected: true, boxes, masks };
  } catch {
    return fallbackSam();
  }
}

const SPARK_SYSTEM = [
  "You are NookShift, an interior-redesign planner for renters.",
  "Return JSON only — no markdown fences, no prose.",
  'Schema: {"goal": string, "constraints": string[], "operations": [{"action": "keep|remove|recolor|reposition", "target": string, "value": string}]}.',
  "Every operation target must be a concrete object visible in the room photo.",
  "Respect renter constraints: no structural changes, no drilling, keep beloved items.",
].join(" ");

function parsePlan(raw: string): Plan {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Spark returned no JSON");
  const parsed = JSON.parse(raw.slice(start, end + 1));
  if (!parsed || !Array.isArray(parsed.operations)) throw new Error("Spark JSON missing operations");
  return {
    goal: String(parsed.goal ?? "Redesign the room"),
    constraints: Array.isArray(parsed.constraints)
      ? parsed.constraints.map(String)
      : [],
    operations: parsed.operations.map((op: Record<string, string>) => ({
      action: (["keep", "remove", "recolor", "reposition"].includes(op.action)
        ? op.action
        : "keep") as Operation["action"],
      target: String(op.target ?? "unnamed object"),
      value: op.value ? String(op.value) : undefined,
    })),
  };
}

/** Reason over the (optional) room photo + user text -> strict plan JSON. */
export async function callSpark(text: string, imageBase64?: string | null): Promise<Plan> {
  if (!KEY) return MOCK_PLAN;

  const content: Record<string, unknown>[] = [
    { type: "text", text: `User request: ${text}` },
  ];
  if (imageBase64) {
    content.push({ type: "image_url", image_url: { url: imageBase64 } });
  }

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SPARK_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: SPARK_SYSTEM },
        { role: "user", content },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Spark ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return parsePlan(data?.choices?.[0]?.message?.content ?? "");
}

function extractImage(data: unknown): string | null {
  const d = (data as { data?: { b64_json?: string; url?: string }[] })?.data?.[0];
  if (!d) return null;
  if (d.b64_json) return `data:image/png;base64,${d.b64_json}`;
  return d.url ?? null;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/**
 * Render the proposal. When the original room photo is available we use
 * /images/edits so the proposal stays grounded in the user's actual room;
 * otherwise we fall back to /images/generations from prompt alone.
 */
export async function callImage(
  prompt: string,
  imageBase64?: string | null
): Promise<string | null> {
  if (!KEY) return null;

  if (imageBase64) {
    const form = new FormData();
    form.append("model", IMAGE_MODEL);
    form.append("prompt", prompt);
    form.append("n", "1");
    form.append("image", await dataUrlToBlob(imageBase64), "room.webp");
    const res = await fetch(`${BASE}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}` }, // no Content-Type — browser sets the boundary
      body: form,
    });
    if (!res.ok) throw new Error(`Image edits ${res.status}: ${await res.text()}`);
    return extractImage(await res.json());
  }

  const res = await fetch(`${BASE}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: IMAGE_MODEL, prompt, n: 1 }),
  });
  if (!res.ok) throw new Error(`Image generations ${res.status}: ${await res.text()}`);
  return extractImage(await res.json());
}

/** Turn a Spark plan into an image-edit prompt. */
export function planToPrompt(plan: Plan, userText: string): string {
  const ops = plan.operations
    .map((op) => {
      const v = op.value ? ` (${op.value})` : "";
      return `${op.action}: ${op.target}${v}`;
    })
    .join("; ");
  return [
    `Renter-friendly redesign. Goal: ${plan.goal}.`,
    `Requested by user: "${userText}".`,
    `Changes: ${ops}.`,
    "Keep the same camera angle, walls, floor, window and lighting.",
    "Photorealistic interior design proposal, no structural changes.",
  ].join(" ");
}
