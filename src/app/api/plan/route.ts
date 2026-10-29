import { NextResponse } from "next/server";
import {
  callSpark,
  callImage,
  callSam,
  detectObjectsForImage,
  filterOpsForView,
  planToPrompt,
  MOCK_PLAN,
  type Plan,
  type Operation,
  type SamResults,
} from "@/lib/meta";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/plan
 * Body: { images: string[], text: string, existingPlan?: Plan, index?: number }
 * Legacy body: { image?: string } or { imageBase64?: string }
 * Returns: { plan: Plan, samResults: SamResults, proposalUrl: string | null, error?: string }
 *
 * Flow: Spark reasons -> plan JSON -> Image renders the grounded proposal.
 * Image failure is non-fatal (proposalUrl: null, client shows stylized preview).
 */
export async function POST(req: Request) {
  let body: { image?: string; imageBase64?: string; images?: string[]; originalImages?: string[]; text?: string; operations?: Operation[]; isEdit?: boolean; isRefine?: boolean; existingPlan?: Plan; index?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const isBatch = Array.isArray(body.images);
  const isRetry = isBatch && Boolean(body.existingPlan) && body.images!.length === 1 && Number.isInteger(body.index);
  if (isBatch && (body.images!.length < 1 || body.images!.length > 3 || body.images!.some((image) => typeof image !== "string" || !image))) {
    return NextResponse.json({ error: "images must contain between 1 and 3 non-empty image strings" }, { status: 400 });
  }

  if (isBatch) {
    const images = body.images!;
    const index = isRetry ? (Number.isInteger(body.index) ? body.index! : 0) : 0;
    if (body.existingPlan && !Array.isArray(body.existingPlan.operations)) {
      return NextResponse.json({ error: "existingPlan must include an operations array" }, { status: 400 });
    }
    if (isRetry && (index < 0 || index > 2)) {
      return NextResponse.json({ error: "Retry requires one image, an index from 0 to 2, and an existing plan" }, { status: 400 });
    }

    let plan: Plan;
    if (body.isRefine) {
      if (images.length !== 1 || !body.existingPlan || !Array.isArray(body.operations) || !Number.isInteger(body.index) || index < 0 || index > 2) {
        return NextResponse.json({ error: "Refinement requires one image, an index, existingPlan, and operations" }, { status: 400 });
      }
      if (!Array.isArray(body.originalImages) || typeof body.originalImages[index] !== "string") {
        return NextResponse.json({ error: "Refinement requires the original image set and a valid indexed source" }, { status: 400 });
      }
      const operations = body.operations.filter((operation) =>
        ["keep", "remove", "recolor", "reposition", "swap"].includes(operation.action) &&
        typeof operation.target === "string" && operation.target.trim().length > 0
      );
      plan = { ...body.existingPlan, goal: text, operations };
    } else if (body.existingPlan) {
      plan = body.existingPlan!;
    } else {
      try {
        plan = await callSpark(text, images[0]);
        } catch (err) {
          console.error("Spark planning failed:", err);
          plan = MOCK_PLAN;
      }
    }

    console.log("SAM env check", !!process.env.MODEL_API_KEY, process.env.MODEL_BASE_URL || "https://api.meta.ai/v1", process.env.SAM_MODEL || "sam-3.1");
    const operationTargets = plan.operations.map((operation) => operation.target);

    const processView = async (imageBase64: string, resultIndex: number) => {
      let samResults: SamResults | null = null;
      let proposalUrl: string | null = null;
      let error: string | undefined;
      try {
        samResults = await detectObjectsForImage(imageBase64, operationTargets, resultIndex);
      } catch (err) {
        error = err instanceof Error ? err.message : "SAM analysis failed for this view.";
      }
      const { applied, skipped } = filterOpsForView(plan.operations, samResults ?? {
        connected: false,
        boxes: [],
        masks: [],
        objects: [],
      });
      const viewPlan: Plan = { ...plan, operations: applied };
      try {
        proposalUrl = await callImage(planToPrompt(viewPlan, text), imageBase64);
        if (!proposalUrl) error ??= "Proposal generation returned no image for this view.";
      } catch (err) {
        error = err instanceof Error ? err.message : "Proposal generation failed for this view.";
      }
      return { index: resultIndex, proposalUrl, samResults, appliedOperations: applied, skippedOperations: skipped, ...(error ? { error } : {}) };
    };

    const sourceImage = body.isRefine ? body.originalImages![index] : images[0];
    if (body.isRefine) console.log("Refine using original image, not generated, for index", index);
    const results = isRetry || body.isRefine
      ? [await processView(sourceImage, index)]
      : await Promise.all(images.map((image, resultIndex) => processView(image, resultIndex)));
    return NextResponse.json({ plan, results });
  }

  const imageBase64 = body.imageBase64 ?? body.image ?? null;

  try {
    // Edited operations are authoritative; regular requests are planned by Spark.
    let plan: Plan;
    if (body.isEdit && Array.isArray(body.operations)) {
      const operations = body.operations.filter((operation) =>
        ["keep", "remove", "recolor", "reposition", "swap"].includes(operation.action) &&
        typeof operation.target === "string" && operation.target.trim().length > 0
      );
      plan = {
        goal: text,
        constraints: [],
        operations,
      };
    } else {
      try {
        plan = await callSpark(text, imageBase64);
      } catch (first) {
        console.error("Spark attempt 1 failed:", first);
        plan = await callSpark(text, imageBase64);
      }
    }

    const samResults = await callSam(imageBase64 ?? "", plan.operations[0]?.target ?? "furniture", []);

    // Image — failure must not kill the plan.
    let proposalUrl: string | null = null;
    try {
      proposalUrl = await callImage(planToPrompt(plan, text), imageBase64);
    } catch (err) {
      console.error("Image generation failed:", err);
    }

    const response = {
      plan,
      samResults,
      proposalUrl,
    };
    return body.image && !body.imageBase64
      ? NextResponse.json({ ...response, proposal: proposalUrl })
      : NextResponse.json(response);
  } catch (err) {
    console.error("/api/plan failed:", err);
    const fallback = {
      plan: MOCK_PLAN,
      samResults: await callSam(imageBase64 ?? "", MOCK_PLAN.operations[0]?.target ?? "furniture", []),
      proposalUrl: null,
      error: "Planning service unavailable; showing a starter plan.",
    };
    return body.image && !body.imageBase64
      ? NextResponse.json({ ...fallback, proposal: null })
      : NextResponse.json(fallback);
  }
}
