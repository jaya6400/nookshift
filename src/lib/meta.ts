/**
 * Meta Model API client — server-only.
 * Keys come from process.env (set in .env.local), never from the client.
 * Model functions use safe starter data when MODEL_API_KEY is missing,
 * so the UI works offline during development.
 *
 * Base: https://api.meta.ai/v1 (OpenAI-compatible)
 */

import { parseImageStream, recordsOfKind } from "@meta-sam/parser";

const BASE = process.env.MODEL_BASE_URL ?? "https://api.meta.ai/v1";
const KEY = process.env.MODEL_API_KEY;

export const SPARK_MODEL = "muse-spark-1.3";
export const IMAGE_MODEL = "muse-image-1.0";
export const SAM_MODEL = process.env.SAM_MODEL || "sam-3.1";

export type Operation = {
  action: "keep" | "remove" | "recolor" | "reposition" | "swap";
  target: string;
  value?: string;
  isRefine?: boolean;
};

export type Plan = {
  goal: string;
  constraints: string[];
  operations: Operation[];
};

export type SamResults = {
  connected: boolean;
  boxes: { label: string; x: number; y: number; width: number; height: number; confidence: number; estimated?: boolean }[];
  masks: { label: string; size: [number, number]; counts: number[]; payload?: string; encoding?: "lossless" | "one_bit" }[];
  objects: { label: string; box: [number, number, number, number] | null; confidence: number }[];
  rawEmpty?: boolean;
};

export type BatchRequest = {
  images: string[];
  originalImages?: string[];
  text: string;
  existingPlan?: Plan;
  index?: number;
  operations?: Operation[];
  isRefine?: boolean;
};

export type PerViewResult = {
  index: number;
  proposalUrl: string | null;
  samResults: SamResults | null;
  appliedOperations?: Operation[];
  skippedOperations?: Operation[];
  error?: string;
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

function emptySam(): SamResults {
  return { connected: false, boxes: [], masks: [], objects: [] };
}

/** Segment one prompted target and decode SAM's structural output-text stream. */
export async function callSam(
  imageBase64: string,
  targetLabel: string,
  sparkFallback: string[],
): Promise<SamResults> {
  const apiKey = process.env.MODEL_API_KEY;
  const baseUrl = process.env.MODEL_BASE_URL || "https://api.meta.ai/v1";
  const samModel = process.env.SAM_MODEL || "sam-3.1";
  if (!apiKey) return emptySam();

  try {
    const samImage = imageBase64.startsWith("data:") ? imageBase64 : `data:image/webp;base64,${imageBase64}`;
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: samModel,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: targetLabel },
            { type: "input_image", image_url: samImage, detail: "high" },
          ],
        }],
      }),
    });
    if (!response.ok) {
      console.error("SAM failed", response.status, (await response.text()).slice(0, 500));
      return emptySam();
    }

    const responseData = await response.json();
    const outputText = Array.isArray(responseData?.output)
      ? responseData.output.flatMap((item: Record<string, unknown>) =>
        Array.isArray(item.content)
          ? item.content.flatMap((part: Record<string, unknown>) => typeof part.text === "string" ? [part.text] : [])
          : [],
      )[0] ?? ""
      : typeof responseData?.output_text === "string" ? responseData.output_text : "";
    console.log("SAM raw text length", outputText.length, "preview", outputText.slice(0, 200));
    if (!outputText.trim()) {
      console.log(`SAM target "${targetLabel}" -> empty`);
      return {
        connected: true,
        boxes: [],
        masks: [],
        objects: sparkFallback.map((label) => ({ label, box: null, confidence: 0.5 })),
        rawEmpty: true,
      };
    }

    const responseTextEvent = {
      type: "response.output_text.done" as const,
      item_id: "sam-response",
      output_index: 0,
      content_index: 0,
      text: outputText,
    };
    const events = async function* () {
      yield responseTextEvent;
      yield { type: "response.completed" as const };
    };
    const parsedStream = parseImageStream(events());
    for await (const _snapshot of parsedStream) {
      // Consume the event stream so finalResult resolves.
    }
    const parsedResult = await parsedStream.finalResult;
    const frameDimensions = /w=(\d+);h=(\d+)/.exec(outputText);
    const sourceWidth = Number(frameDimensions?.[1] ?? 1000);
    const sourceHeight = Number(frameDimensions?.[2] ?? 1000);
    const boxRecords = recordsOfKind(parsedResult.records, "box");
    const maskRecords = recordsOfKind(parsedResult.records, "mask");
    const parsedBounds = [
      ...boxRecords.map((record) => ({
        left: record.left,
        top: record.top,
        right: record.right,
        bottom: record.bottom,
        confidence: record.confidence ?? 0.8,
      })),
      ...maskRecords
        .filter((mask) => !boxRecords.some((box) => box.objectId === mask.objectId))
        .map((mask) => ({ ...mask.bounds, confidence: mask.confidence ?? 0.8 })),
    ];
    const boxes: SamResults["boxes"] = parsedBounds.map((bounds) => ({
      label: targetLabel,
      x: bounds.left / sourceWidth * 1000,
      y: bounds.top / sourceHeight * 1000,
      width: (bounds.right - bounds.left) / sourceWidth * 1000,
      height: (bounds.bottom - bounds.top) / sourceHeight * 1000,
      confidence: bounds.confidence,
    }));
    if (!boxes.length) {
      const regexBoxes = Array.from(outputText.matchAll(/\[(\d{1,4})\s*,\s*(\d{1,4})\s*,\s*(\d{1,4})\s*,\s*(\d{1,4})\]/g)) as RegExpExecArray[];
      boxes.push(...regexBoxes.map((match) => {
        const [left, top, right, bottom] = match.slice(1).map(Number);
        return {
          label: targetLabel,
          x: left,
          y: top,
          width: right - left,
          height: bottom - top,
          confidence: 0.7,
        };
      }).filter((box) => box.width > 0 && box.height > 0));
    }
    if (!boxes.length && outputText.length > 20) {
      boxes.push({ label: targetLabel, x: 200, y: 200, width: 600, height: 600, confidence: 0.2, estimated: true });
    }
    const masks: SamResults["masks"] = maskRecords.map((record) => ({
      label: targetLabel,
      size: [record.mask.height, record.mask.width],
      counts: [],
      payload: record.mask.payload,
      encoding: record.mask.encoding,
    }));
    const objects = boxes.map((box) => ({ label: box.label, box: [box.x, box.y, box.width, box.height] as [number, number, number, number], confidence: box.confidence }));
    console.log(`SAM target "${targetLabel}" ->`, boxes.length ? boxes.map((box) => [box.x, box.y, box.x + box.width, box.y + box.height]) : "empty");
    return { connected: true, boxes, masks, objects };
  } catch (error) {
    console.error(`SAM request error for target "${targetLabel}"`, error);
    return { connected: true, boxes: [], masks: [], objects: [{ label: targetLabel, box: null, confidence: 0 }], rawEmpty: true };
  }
}

const SPARK_SYSTEM = [
  "You are NookShift, an interior-redesign planner for renters.",
  "Return JSON only — no markdown fences, no prose.",
  'Schema: {"goal": string, "constraints": string[], "operations": [{"action": "keep|remove|recolor|reposition|swap", "target": string, "value": string}]}.',
  "You MUST extract ALL distinct actions from the user request. Never drop recolor actions. If asked to recolor the left wall pink, the right wall blue, and move the sofa, return three separate operations: recolor left wall to pink, recolor right wall to blue, and reposition the existing sofa.",
  "Recolor wall, ceiling, and floor operations are GLOBAL and apply to ALL views even if the surface is not detected. Do not mark global recolors as skippable.",
  "Preservation instructions such as keeping the room layout, camera angle, windows, and other furniture unchanged belong in the constraints array, not as operations.",
  "Every operation target must be a concrete object visible in the room photo.",
  "If the user asks to move a sofa, interpret it as repositioning the existing sofa, never creating another one. For a two-seater sofa movement, use {\"action\":\"reposition\",\"target\":\"two-seater sofa\",\"value\":\"slightly right near fridge\"} when that matches the request.",
  "If the user asks to swap the location of a two-seater sofa and three-seater sofa, use {\"action\":\"swap\",\"target\":\"two-seater sofa and three-seater sofa\",\"value\":\"swap positions\"}.",
  "Respect renter constraints: no structural changes, no drilling, keep beloved items.",
].join(" ");

function parsePlan(raw: string, requestedText: string): Plan {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Spark returned no JSON");
  const parsed = JSON.parse(raw.slice(start, end + 1));
  if (!parsed || !Array.isArray(parsed.operations)) throw new Error("Spark JSON missing operations");
  let operations: Operation[] = parsed.operations.map((op: Record<string, string>) => ({
    action: (["keep", "remove", "recolor", "reposition", "swap"].includes(op.action)
      ? op.action
      : "keep") as Operation["action"],
    target: String(op.target ?? "unnamed object"),
    value: op.value ? String(op.value) : undefined,
  }));
  const explicitWallColors = Array.from(requestedText.matchAll(/\b(left|right|front|back)\s+wall\s+(?:to\s+)?([a-z][a-z-]*)\b/gi));
  if (explicitWallColors.length) {
    operations = operations.filter((operation) => !(
      operation.action === "recolor" && /^walls?$/i.test(operation.target.trim())
    ));
  }
  for (const match of explicitWallColors) {
    const target = `${match[1].toLowerCase()} wall`;
    const value = match[2].toLowerCase();
    if (!operations.some((operation) => operation.action === "recolor" && normalizeLabel(operation.target) === target && normalizeLabel(operation.value ?? "") === value)) {
      operations.push({ action: "recolor", target, value });
    }
  }
  const constraints = Array.isArray(parsed.constraints) ? parsed.constraints.map(String) : [];
  const preservation = requestedText.match(/\bkeep\b[^.!?]*(?:unchanged|the same)\b/i)?.[0]?.trim();
  if (preservation && !constraints.some((constraint: string) => normalizeLabel(constraint) === normalizeLabel(preservation))) {
    constraints.push(preservation);
  }
  return {
    goal: String(parsed.goal ?? "Redesign the room"),
    constraints,
    operations,
  };
}

function buildSparkPrompt(text: string): string {
  return `Extract ALL distinct requested actions. Never omit or combine separate recolor actions. Example: "pink left wall, blue right wall, move sofa right" means 3 operations: recolor left wall pink, recolor right wall blue, reposition sofa right. Recolor wall, ceiling, and floor operations are global and apply to every view. Put preservation instructions such as keeping layout, camera angle, windows, and other furniture unchanged in constraints, never as operations. User request: ${text}`;
}

/** Reason over the (optional) room photo + user text -> strict plan JSON. */
export async function callSpark(text: string, imageBase64?: string | null): Promise<Plan> {
  if (!KEY) return MOCK_PLAN;

  const content: Record<string, unknown>[] = [
    { type: "text", text: buildSparkPrompt(text) },
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
  return parsePlan(data?.choices?.[0]?.message?.content ?? "", text);
}

export type VisibleObject = { label: string; confidence: number };

/** Ask Spark to identify objects visible in one specific view, not the whole room. */
export async function callSparkViewObjects(imageBase64: string): Promise<VisibleObject[]> {
  if (!KEY) return [];
  const response = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: SPARK_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: 'Inspect only the supplied room image. List all distinct objects visible in THIS specific room image. Return a JSON array of lowercase labels only, for example ["bed", "shelf"]. Include only visible objects and do not infer objects outside the frame.' },
        { role: "user", content: [
          { type: "text", text: "List all distinct objects visible in this specific room image." },
          { type: "image_url", image_url: { url: imageBase64 } },
        ] },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Spark object detection ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const raw = String(data?.choices?.[0]?.message?.content ?? "");
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("Spark returned no object list");
  const parsed = JSON.parse(raw.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("Spark object list is malformed");
  return parsed.flatMap((object: unknown) => {
    const label = typeof object === "string" ? object : (object as Record<string, unknown>)?.label;
    if (typeof label !== "string" || !label.trim()) return [];
    const confidence = typeof object === "string" ? 0.5 : Number((object as Record<string, unknown>).confidence ?? 0.5);
    return [{ label: label.trim().toLowerCase(), confidence: Number.isFinite(confidence) ? confidence : 0.5 }];
  });
}

/** Detect one image independently, using Spark labels when SAM returns no regions. */
export async function detectObjectsForImage(
  imageBase64: string,
  operationTargets: string[],
  viewIndex: number,
): Promise<SamResults> {
  const sparkObjects = await callSparkViewObjects(imageBase64).catch((error) => {
    console.error("Spark object detection failed for view", viewIndex, error);
    return [];
  });
  const targets = Array.from(new Set([
    ...operationTargets,
    "left wall",
    "right wall",
    "refrigerator",
    "bed",
  ].map((target) => target.trim()).filter(Boolean))).slice(0, 6);
  const samByTarget = await Promise.all(targets.map((target) => callSam(imageBase64, target, sparkObjects.map((object) => object.label)).catch((error) => {
    console.warn("SAM target failed", target, error instanceof Error ? error.message : error);
    return { connected: true, boxes: [], masks: [], objects: [{ label: target, box: null, confidence: 0 }], rawEmpty: true } satisfies SamResults;
  })));
  const boxes = samByTarget.flatMap((result) => result.boxes);
  const samLabels = boxes.map((box) => box.label);
  const objects = Array.from(new Set([...samLabels, ...sparkObjects.map((object) => object.label)]))
    .map((label) => ({ label, box: null, confidence: 0.5 }));
  console.log("SAM per-target for view", viewIndex, targets, "got", boxes.length, "boxes", boxes);

  return {
    connected: samByTarget.some((result) => result.connected),
    boxes,
    masks: [],
    objects,
  };
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

/** Keep global surface changes and object actions whose targets are visible in this image. */
export function filterOpsForView(operations: Operation[], samResults: SamResults): { applied: Operation[]; skipped: Operation[] } {
  const labels = samResults.objects.map((object) => normalizeLabel(object.label));
  const globalSurface = /\b(walls?|ceiling|floor)\b/i;
  const isVisibleTarget = (target: string) => {
    const normalized = normalizeLabel(target);
    const targetHasSofa = /\bsofa\b/.test(normalized);
    return labels.some((label) => {
      if (label.includes(normalized) || normalized.includes(label)) return true;
      if (targetHasSofa && /\b(sofa|seater|chairs?)\b/.test(label)) return true;
      return normalized.split(" ").some((word) => word.length > 2 && label.includes(word));
    });
  };
  const applied: Operation[] = [];
  const skipped: Operation[] = [];
  for (const operation of operations) {
    if (operation.isRefine) {
      applied.push(operation);
      continue;
    }
    const parts = operation.action === "swap"
      ? operation.target.split(/\s+(?:and|with)\s+|\s*<->\s*/i).map((part) => part.trim()).filter(Boolean)
      : [operation.target];
    const globalRecolor = operation.action === "recolor" && globalSurface.test(operation.target);
    const objectPresenceFiltered = operation.action === "reposition" || operation.action === "swap";
    const visible = globalRecolor || !objectPresenceFiltered || parts.every(isVisibleTarget);
    (visible ? applied : skipped).push(operation);
  }
  return { applied, skipped };
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
      if (op.action === "swap") {
        const targets = op.target.split(/\s+(?:and|with)\s+|\s*<->\s*/i).map((target) => target.trim()).filter(Boolean);
        return `swap positions of ${targets.join(" and ")}, preserving each existing item and not creating duplicates`;
      }
      const v = op.value ? ` (${op.value})` : "";
      return `${op.action}: ${op.target}${v}`;
    })
    .join("; ");
  const sofaGuard = /sofa|two.seater|mandir|fridge/i.test(`${plan.goal} ${userText}`)
    ? "Do not add new sofas, chairs, or furniture. Only move the existing two-seater slightly to the right when requested. Keep the mandir, fridge, bed, and windows unchanged."
    : "Do not add new furniture or duplicate existing objects unless explicitly requested.";
  return [
    `Renter-friendly redesign. Goal: ${plan.goal}.`,
    `Requested by user: "${userText}".`,
    `Changes: ${ops}.`,
    "Keep the same camera angle, walls, floor, window and lighting.",
    "Do not add unrequested furniture, duplicate objects, or change the room layout.",
    sofaGuard,
    "Photorealistic interior design proposal, no structural changes.",
  ].join(" ");
}
