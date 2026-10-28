import { NextResponse } from "next/server";
import {
  callSpark,
  callImage,
  callSam,
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
  let body: { image?: string; imageBase64?: string; images?: string[]; text?: string; operations?: Operation[]; isEdit?: boolean; existingPlan?: Plan; index?: number };
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
    if (body.existingPlan) {
      plan = body.existingPlan!;
    } else {
      try {
        plan = await callSpark(text, images[0]);
        } catch (err) {
          console.error("Spark planning failed:", err);
          plan = MOCK_PLAN;
      }
    }

    const processView = async (imageBase64: string, resultIndex: number) => {
      let samResults: SamResults | null = null;
      let proposalUrl: string | null = null;
      let error: string | undefined;
      try {
        samResults = await callSam(plan.operations, imageBase64);
      } catch (err) {
        error = err instanceof Error ? err.message : "SAM analysis failed for this view.";
      }
      try {
        proposalUrl = await callImage(planToPrompt(plan, text), imageBase64);
        if (!proposalUrl) error ??= "Proposal generation returned no image for this view.";
      } catch (err) {
        error = err instanceof Error ? err.message : "Proposal generation failed for this view.";
      }
      return { index: resultIndex, proposalUrl, samResults, ...(error ? { error } : {}) };
    };

    const results = isRetry
      ? [await processView(images[0], index)]
      : await Promise.all(images.map((image, resultIndex) => processView(image, resultIndex)));
    return NextResponse.json({ plan, results });
  }

  const imageBase64 = body.imageBase64 ?? body.image ?? null;

  try {
    // Edited operations are authoritative; regular requests are planned by Spark.
    let plan: Plan;
    if (body.isEdit && Array.isArray(body.operations)) {
      const operations = body.operations.filter((operation) =>
        ["keep", "remove", "recolor", "reposition"].includes(operation.action) &&
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

    const samResults = await callSam(plan.operations, imageBase64);

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
      samResults: await callSam(MOCK_PLAN.operations, imageBase64),
      proposalUrl: null,
      error: "Planning service unavailable; showing a starter plan.",
    };
    return body.image && !body.imageBase64
      ? NextResponse.json({ ...fallback, proposal: null })
      : NextResponse.json(fallback);
  }
}
