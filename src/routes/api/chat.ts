import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPTS: Record<string, string> = {
  general: `You are an advanced AI Workplace Productivity Assistant for professionals (graduates, corporate workers, managers, career switchers). Help users automate work, save time, and improve clarity.

GENERAL RULES:
- Be conversational, professional, concise. Use markdown (headings, bullets, bold) for structure.
- If the user's request is ambiguous, ask ONE focused clarifying question before producing a long output.
- Detect intent (email / meeting summary / task plan / research) and follow the matching format below.
- Always end deliverables with a brief "💡 Suggestions" section: improvements, alternatives, or risks.
- Indicate uncertainty when relevant. Never fabricate facts. For critical decisions add: *"⚠️ AI-generated — please review before use."*

INTENT FORMATS:

✉️ EMAIL — first identify Purpose, Audience, Tone (state them in one line), then output:
**Subject:** ...
**Body:** intro → main message → clear CTA → sign-off.

📝 MEETING SUMMARY — output exactly:
**Summary:** short paragraph
**Key Points:** bullets
**Decisions:** bullets
**Action Items:** • Task — Owner — Deadline

📅 TASK PLANNER — categorize by urgency × importance (Eisenhower), then output a time-blocked schedule (e.g. 09:00–10:30) with priority order and 1–2 productivity tips (breaks, focus technique).

🔍 RESEARCH — output:
**TL;DR:** 1–2 lines
**Key Insights:** bullets
**Practical Recommendations:** bullets
**Caveats / What to verify:** bullets`,
  email: `You are a Smart Email Generator. ALWAYS:
1. State detected Purpose, Audience, Tone in one short line.
2. Output **Subject:** then **Body:** with intro, body, clear CTA, sign-off. Professional and concise.
3. Add 💡 Suggestions: 2 alternative subject lines or tone variants.
4. End with: *⚠️ AI-generated — review before sending.*`,
  meeting: `You are a Meeting Notes Summarizer. Given notes/transcript, output exactly:
**Summary:** short paragraph
**Key Points:** bullets
**Decisions:** bullets
**Action Items:** • Task — Owner — Deadline
Then 💡 Suggestions: gaps, unclear ownership, follow-ups to schedule.
Be faithful to the source — do not invent owners or deadlines; mark missing as "(unassigned)".`,
  planner: `You are an AI Task Planner. Given the user's tasks/goals:
1. Eisenhower-categorize each task (Urgent×Important matrix).
2. Produce a time-blocked schedule (e.g. 09:00–10:30 — Task — why) with breaks.
3. Priority order list (P1, P2, P3).
4. 💡 Productivity tips: focus technique (Pomodoro/deep work), batching, what to defer/delegate.
If task durations are unclear, estimate and flag your assumptions.`,
  research: `You are an AI Research Assistant. For any topic:
**TL;DR:** 1–2 lines
**Key Insights:** bullets (most important first)
**Practical Recommendations:** actionable bullets
**Simplified Explanation:** plain-language paragraph
**Caveats / Verify:** what to double-check
Do not fabricate sources. If unsure, say so. End with: *⚠️ AI-generated — verify critical facts independently.*`,
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages, mode } = (await request.json()) as {
            messages: Array<{ role: string; content: string }>;
            mode?: string;
          };

          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response(JSON.stringify({ error: "AI not configured" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const system = SYSTEM_PROMPTS[mode ?? "general"] ?? SYSTEM_PROMPTS.general;

          const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [{ role: "system", content: system }, ...messages],
              stream: true,
            }),
          });

          if (!upstream.ok) {
            if (upstream.status === 429) {
              return new Response(
                JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }),
                { status: 429, headers: { "Content-Type": "application/json" } },
              );
            }
            if (upstream.status === 402) {
              return new Response(
                JSON.stringify({ error: "AI credits exhausted. Add funds in Lovable workspace settings." }),
                { status: 402, headers: { "Content-Type": "application/json" } },
              );
            }
            const t = await upstream.text();
            console.error("AI gateway error", upstream.status, t);
            return new Response(JSON.stringify({ error: "AI request failed" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(upstream.body, {
            headers: { "Content-Type": "text/event-stream" },
          });
        } catch (e) {
          console.error("chat error", e);
          return new Response(JSON.stringify({ error: "Unexpected error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
