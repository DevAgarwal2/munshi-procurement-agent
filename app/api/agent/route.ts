import { NextRequest, NextResponse } from "next/server";
import { answerQuestion, defaultLevers, evaluateOffers, recommend } from "@/lib/engine";
import { scenarioById } from "@/lib/scenarios";
import type { Levers } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { question?: string; levers?: Partial<Levers>; scenarioId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "A question is required." }, { status: 400 });
  if (question.length > 500) {
    return NextResponse.json({ error: "Keep the question under 500 characters." }, { status: 400 });
  }

  const scenario = scenarioById(body.scenarioId ?? "cafe");
  const levers: Levers = { ...defaultLevers(scenario), ...body.levers };
  const offers = evaluateOffers(scenario, levers);
  const recommendation = recommend(offers, levers, scenario);
  const answer = answerQuestion(question, offers, levers, recommendation, scenario);

  return NextResponse.json({ ...answer, levers });
}
