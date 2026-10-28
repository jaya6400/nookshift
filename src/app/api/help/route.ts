import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { name?: unknown; email?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!name || !email || !message) {
    return NextResponse.json({ error: "name, email, and message are required" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    console.log("Help request (Resend not configured):", { name, email, message });
    return NextResponse.json({ ok: true, fallback: true });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "NookShift Help <onboarding@resend.dev>",
      to: process.env.HELP_EMAIL || "MY_EMAIL",
      replyTo: email,
      subject: `NookShift help request from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    });
    if (error) {
      console.error("Help email delivery failed:", error);
      return NextResponse.json({ error: "Could not send help request" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, fallback: false });
  } catch (error) {
    console.error("Help email delivery failed:", error);
    return NextResponse.json({ error: "Could not send help request" }, { status: 502 });
  }
}