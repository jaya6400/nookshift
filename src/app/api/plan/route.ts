import { NextResponse } from "next/server";
import {
  callSpark,
  callImage,
  callSam,
  planToPrompt,
  MOCK_PLAN,
  type Plan,
  type Operation,
} from "@/lib/meta";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/plan
 * Body: { imageBase64?: string, text: string }
 * Returns: { plan: Plan, samResults: SamResults, proposalUrl: string | null, error?: string }
 *
 * Flow: Spark reasons -> plan JSON -> Image renders the grounded proposal.
 * Image failure is non-fatal (proposalUrl: null, client shows stylized preview).
 */
export async function POST(req: Request) {
  let body: { imageBase64?: string; text?: string; operations?: Operation[]; isEdit?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const imageBase64 = body.imageBase64 ?? null;

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

    return NextResponse.json({
      plan,
      samResults,
      proposalUrl,
    });
  } catch (err) {
    console.error("/api/plan failed:", err);
    return NextResponse.json({
      plan: MOCK_PLAN,
      samResults: await callSam(MOCK_PLAN.operations, imageBase64),
      proposalUrl: null,
      error: "Planning service unavailable; showing a starter plan.",
    });
  }
}
