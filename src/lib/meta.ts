/**
 * Meta Model API client — server-only.
 * Keys come from process.env (set in .env.local), never from the client.
 * Model functions use safe starter data when MODEL_API_KEY is missing,
 * so the UI works offline during development.
 *
 * Base: https://api.meta.ai/v1 (OpenAI-compatible)
 */

import { decodeMaskToRaster, parseImageStream, recordsOfKind } from "@meta-sam/parser";
import sharp from "sharp";

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
  boxes: { label: string; x: number; y: number; width: number; height: number; box: [number, number, number, number]; confidence: number; estimated?: boolean }[];
  masks: { label: string; x: number; y: number; width: number; height: number; bounds?: [number, number, number, number]; data: string }[];
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

function emptySam(targetLabel: string, sparkFallback: string[]): SamResults {
  const labels = sparkFallback.length ? sparkFallback : [targetLabel];
  return {
    connected: true,
    boxes: [],
    masks: [],
    objects: labels.map((label) => ({ label, box: null, confidence: sparkFallback.length ? 0.5 : 0.25 })),
    rawEmpty: true,
  };
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
  if (!apiKey) return emptySam(targetLabel, sparkFallback);

  const isSofaTarget = /sofa|two[- ]seater/i.test(targetLabel);
  const prompts = isSofaTarget ? ["sofa", "chair", "armchair"] : [targetLabel];
  const fallbackObjects = () => emptySam(targetLabel, sparkFallback).objects;
  let lastMasks: SamResults["masks"] = [];

  for (const prompt of prompts) {
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
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: samImage, detail: "high" },
            ],
          }],
        }),
      });
      if (!response.ok) {
        console.error("SAM failed", response.status, (await response.text()).slice(0, 500));
        continue;
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

      const boxRegex = /<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);/g;
      const maskRegex = /<\|mask;x=(\d+);y=(\d+);data=([^|]+)\|>/g;
      const boxMatches = Array.from(outputText.matchAll(boxRegex)) as RegExpExecArray[];
      const boxes: SamResults["boxes"] = boxMatches.map((match) => {
        const [x1, y1, x2, y2] = match.slice(1).map(Number);
        return { label: targetLabel, x: x1, y: y1, width: x2 - x1, height: y2 - y1, box: [x1, y1, x2, y2] as [number, number, number, number], confidence: 0.8 };
      }).filter((box) => box.width > 0 && box.height > 0);
      const maskMatches = Array.from(outputText.matchAll(maskRegex)) as RegExpExecArray[];
      const masks: SamResults["masks"] = maskMatches.map((match) => ({
        label: targetLabel,
        x: Number(match[1]),
        y: Number(match[2]),
        width: 0,
        height: 0,
        data: match[3],
      }));
      lastMasks = masks;

      if (outputText.trim()) {
        try {
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
          for await (const _snapshot of parsedStream) { /* Consume the stream for finalResult. */ }
          const parsedResult = await parsedStream.finalResult;
          const frameDimensions = /w=(\d+);h=(\d+)/.exec(outputText);
          const sourceWidth = Number(frameDimensions?.[1] ?? 1000);
          const sourceHeight = Number(frameDimensions?.[2] ?? 1000);
          const boxRecords = recordsOfKind(parsedResult.records, "box");
          const maskRecords = recordsOfKind(parsedResult.records, "mask");
          const bounds = [
            ...boxRecords.map((record) => ({ left: record.left, top: record.top, right: record.right, bottom: record.bottom, confidence: record.confidence ?? 0.8 })),
            ...maskRecords.filter((mask) => !boxRecords.some((box) => box.objectId === mask.objectId)).map((mask) => ({ ...mask.bounds, confidence: mask.confidence ?? 0.8 })),
          ];
          if (!boxes.length) boxes.push(...bounds.map((bound) => {
            const x1 = bound.left / sourceWidth * 1000;
            const y1 = bound.top / sourceHeight * 1000;
            const x2 = bound.right / sourceWidth * 1000;
            const y2 = bound.bottom / sourceHeight * 1000;
            return { label: targetLabel, x: x1, y: y1, width: x2 - x1, height: y2 - y1, box: [x1, y1, x2, y2] as [number, number, number, number], confidence: bound.confidence };
          }).filter((box) => box.width > 0 && box.height > 0));
          masks.length = 0;
          masks.push(...maskRecords.map((record) => ({
            label: targetLabel,
            x: record.bounds.left,
            y: record.bounds.top,
            width: record.mask.width,
            height: record.mask.height,
            bounds: [record.bounds.left, record.bounds.top, record.bounds.right, record.bounds.bottom] as [number, number, number, number],
            data: Buffer.from(decodeMaskToRaster(record.mask)).toString("base64"),
          })));
          lastMasks = masks;
        } catch (parseError) {
          console.warn(`SAM structural parser failed for target "${targetLabel}"`, parseError);
        }
      }

      if (!boxes.length) {
        const tupleRegex = /\[(\d{1,4})\s*,\s*(\d{1,4})\s*,\s*(\d{1,4})\s*,\s*(\d{1,4})\]/g;
        const tupleMatches = Array.from(outputText.matchAll(tupleRegex)) as RegExpExecArray[];
        boxes.push(...tupleMatches.map((match) => {
          const [x1, y1, x2, y2] = match.slice(1).map(Number);
          return { label: targetLabel, x: x1, y: y1, width: x2 - x1, height: y2 - y1, box: [x1, y1, x2, y2] as [number, number, number, number], confidence: 0.7 };
        }).filter((box) => box.width > 0 && box.height > 0));
      }
      if (!boxes.length && outputText.length > 20 && !isSofaTarget) {
        boxes.push({ label: targetLabel, x: 200, y: 200, width: 600, height: 600, box: [200, 200, 800, 800], confidence: 0.2, estimated: true });
      }
      if (isSofaTarget) console.log(`SAM target ${targetLabel} -> fallback ${prompt} got ${boxes.length} boxes`);
      if (boxes.length) {
        const objects = boxes.map((box) => ({ label: targetLabel, box: [box.x, box.y, box.x + box.width, box.y + box.height] as [number, number, number, number], confidence: box.confidence }));
        return { connected: true, boxes, masks, objects };
      }
    } catch (error) {
      console.error(`SAM request error for target "${targetLabel}" using prompt "${prompt}"`, error);
    }
  }

  return { connected: true, boxes: [], masks: lastMasks, objects: fallbackObjects(), rawEmpty: true };
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
  const masks = samByTarget.flatMap((result) => result.masks);
  const objects = Array.from(new Map([
    ...sparkObjects.map((object) => ({ label: object.label, box: null, confidence: object.confidence })),
    ...samByTarget.flatMap((result) => result.objects),
  ].map((object) => [object.label, object])).values());
  console.log("SAM per-target for view", viewIndex, targets, "got", boxes.length, "boxes", boxes);

  return {
    connected: true,
    boxes,
    masks,
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

/** Render an edit grounded in the user's original room photo. */
export async function callImage(
  prompt: string,
  imageBase64?: string | null,
  imageSize?: { width: number; height: number },
): Promise<string | null> {
  if (!KEY) return null;
  if (!imageBase64) throw new Error("Image editing requires the original room image.");

  const form = new FormData();
  form.append("model", IMAGE_MODEL);
  form.append("prompt", prompt);
  form.append("n", "1");
  form.append("image", await dataUrlToBlob(imageBase64), "room.webp");
  if (imageSize && imageSize.width > 0 && imageSize.height > 0) {
    form.append("size", `${imageSize.width}x${imageSize.height}`);
  }
  const res = await fetch(`${BASE}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Image edits ${res.status}: ${await res.text()}`);
  return extractImage(await res.json());
}

/** Preserve every source pixel outside the requested recolor surface masks. */
export async function preservePixelsOutsideMasks(
  originalBase64: string,
  proposalUrl: string,
  masks: SamResults["masks"],
  allowedTargets: string[],
  excludedTargets: string[] = [],
): Promise<string> {
  const allowed = allowedTargets.map(normalizeLabel);
  const excluded = excludedTargets.map(normalizeLabel);
  const matchesTarget = (mask: SamResults["masks"][number], names: string[]) => {
    const target = normalizeLabel(mask.label);
    return names.some((name) => target === name || target.includes(name) || name.includes(target));
  };
  const selectedMasks = masks.filter((mask) => matchesTarget(mask, allowed));
  const excludedMasks = masks.filter((mask) => matchesTarget(mask, excluded));
  const missingTargets = allowed.filter((target) => !selectedMasks.some((mask) => matchesTarget(mask, [target])));
  if (missingTargets.length) {
    throw new Error(`SAM masks unavailable for recolor target(s): ${missingTargets.join(", ")}`);
  }

  const original = Buffer.from(originalBase64.split(",").at(-1) ?? "", "base64");
  const proposalSource = proposalUrl.startsWith("data:")
    ? Buffer.from(proposalUrl.split(",").at(-1) ?? "", "base64")
    : Buffer.from(await (await fetch(proposalUrl)).arrayBuffer());
  const originalImage = sharp(original).removeAlpha().toColourspace("srgb");
  const { data: originalPixels, info } = await originalImage.raw().toBuffer({ resolveWithObject: true });
  const proposalPixels = await sharp(proposalSource).resize(info.width, info.height, { fit: "fill" }).removeAlpha().toColourspace("srgb").raw().toBuffer();
  const allowedPixels = Buffer.alloc(info.width * info.height, 0);

  const rasterize = (mask: SamResults["masks"][number], target: Buffer, value: number) => {
    if (!mask.bounds || mask.width <= 0 || mask.height <= 0) return;
    const [left, top, right, bottom] = mask.bounds;
    const raster = Buffer.from(mask.data, "base64");
    if (raster.length !== mask.width * mask.height) return;
    let activePixels = 0;
    for (let y = 0; y < mask.height; y += 1) {
      const targetY = Math.floor(top + ((y + 0.5) * (bottom - top)) / mask.height);
      if (targetY < 0 || targetY >= info.height) continue;
      for (let x = 0; x < mask.width; x += 1) {
        if (!raster[y * mask.width + x]) continue;
        activePixels += 1;
        const targetX = Math.floor(left + ((x + 0.5) * (right - left)) / mask.width);
        if (targetX >= 0 && targetX < info.width) target[targetY * info.width + targetX] = value;
      }
    }
    console.log("SAM composite mask", mask.label, mask.width, mask.height, mask.bounds, "active", activePixels);
  };
  for (const mask of selectedMasks) rasterize(mask, allowedPixels, 255);
  for (const mask of excludedMasks) rasterize(mask, allowedPixels, 0);
  console.log("SAM composite coverage", allowedPixels.reduce((sum, pixel) => sum + (pixel ? 1 : 0), 0), "of", allowedPixels.length);

  for (let pixel = 0; pixel < allowedPixels.length; pixel += 1) {
    if (allowedPixels[pixel]) continue;
    const channel = pixel * info.channels;
    proposalPixels[channel] = originalPixels[channel];
    proposalPixels[channel + 1] = originalPixels[channel + 1];
    proposalPixels[channel + 2] = originalPixels[channel + 2];
  }

  const composited = await sharp(proposalPixels, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  }).png().toBuffer();
  return `data:image/png;base64,${composited.toString("base64")}`;
}

/** Turn a Spark plan into an image-edit prompt. */
export function planToPrompt(plan: Plan, userText: string): string {
  const changes = plan.operations
    .map((op) => {
      if (op.action === "swap") {
        const targets = op.target.split(/\s+(?:and|with)\s+|\s*<->\s*/i).map((target) => target.trim()).filter(Boolean);
        return `Swap the positions of the existing ${targets.join(" and ")}`;
      }
      if (op.action === "recolor") return `Recolor ${op.target} ${op.value ?? "as requested"}`;
      if (op.action === "remove") return `Remove ${op.target}`;
      if (op.action === "reposition") return `Reposition the existing ${op.target}${op.value ? ` ${op.value}` : ""}`;
      if (op.action === "keep") return `Keep the existing ${op.target}`;
      return `Change ${op.target}${op.value ? ` to ${op.value}` : ""}`;
    })
    .join(", ");
  const constraints = plan.constraints.length
    ? `Constraints: ${plan.constraints.join("; ")}.`
    : "";
  return [
    changes || userText || plan.goal,
    constraints,
    "Keep existing room layout, camera angle, windows, and other furniture unchanged.",
    "Do not add new furniture unless explicitly requested.",
    "High detail, 8k, real interior photo, no CGI.",
  ].filter(Boolean).join(" ");
}
