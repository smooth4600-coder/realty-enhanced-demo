import { NextRequest } from "next/server";
import { inboundChatPrompt } from "@/content/prompts";
import { DAY_MS, LIMITS, clientKey, limited, take } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };

function err(status: number, error: string, message: string) {
  return new Response(JSON.stringify({ error, message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5";

  if (!apiKey) {
    return err(500, "config_missing", "OPENROUTER_API_KEY is not set");
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return err(400, "invalid_body", "Body must be JSON");
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return err(400, "messages_required", "No messages supplied");
  }

  // One user turn per request. Cap the whole conversation, not the request rate,
  // because a demo visitor holding a long conversation is the real cost.
  const userTurns = messages.filter((m) => m.role === "user").length;
  if (userTurns > LIMITS.chatPerSession()) {
    return limited(
      0,
      `This demo allows ${LIMITS.chatPerSession()} messages per conversation. Reset the chat to start again.`
    );
  }

  const retry = take(clientKey(req, "chat"), LIMITS.chatPerDay(), DAY_MS);
  if (retry !== null) {
    return limited(
      retry,
      `This demo allows ${LIMITS.chatPerDay()} messages per day from one device. Try again tomorrow.`
    );
  }

  const trimmed = messages.slice(-20).map((m) => ({
    role: m.role,
    content: String(m.content ?? "").slice(0, 2000),
  }));

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Title": "Realty Enhanced Demo",
    },
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 400,
      temperature: 0.4,
      messages: [
        { role: "system", content: inboundChatPrompt() },
        ...trimmed,
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return err(
      502,
      "upstream_error",
      `Model request failed (${upstream.status}). ${detail.slice(0, 200)}`
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const delta = JSON.parse(data).choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta) {
                controller.enqueue(encoder.encode(delta));
              }
            } catch {
              // keep-alive or partial frame, ignore
            }
          }
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
