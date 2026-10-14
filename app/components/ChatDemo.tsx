"use client";

import { useEffect, useRef, useState } from "react";
import { SUGGESTED_QUESTIONS } from "@/content/demo-data";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatDemo() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;

    setError(null);
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `The assistant did not reply (${res.status})`);
      }

      setMessages([...next, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
    } catch (e) {
      setMessages(next);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid md:grid-cols-[1fr_320px] gap-6">
      <div className="card flex flex-col" style={{ height: "clamp(460px, 62vh, 640px)" }}>
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div>
            <h3 className="serif text-lg leading-tight">Message the assistant</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
              The same assistant that answers WhatsApp, SMS and your website chat
            </p>
          </div>
          {messages.length > 0 && (
            <button
              className="text-xs font-semibold"
              style={{ color: "var(--brand-maroon)" }}
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
            >
              Reset
            </button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <p className="serif text-lg">Start a conversation</p>
              <p className="text-sm mt-2 max-w-xs" style={{ color: "var(--ink-soft)" }}>
                Write the way a buyer actually texts. Short, blunt, half a sentence.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`${m.role === "user" ? "bubble-me" : "bubble-them"} px-4 py-2.5 text-sm max-w-[82%] whitespace-pre-wrap leading-relaxed`}
              >
                {m.content || (
                  <span className="inline-flex gap-1">
                    <span className="dot">.</span>
                    <span className="dot">.</span>
                    <span className="dot">.</span>
                  </span>
                )}
              </div>
            </div>
          ))}

          {busy && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bubble-them px-4 py-2.5 text-sm">
                <span className="inline-flex gap-1">
                  <span className="dot">.</span>
                  <span className="dot">.</span>
                  <span className="dot">.</span>
                </span>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-center" style={{ color: "var(--brand-maroon)" }}>
              {error}
            </p>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="px-6 py-4 flex gap-2"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <input
            className="field"
            placeholder="Write a message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
          <button className="btn-primary px-5 text-sm" disabled={busy || !input.trim()}>
            Send
          </button>
        </form>
      </div>

      <div className="card p-6 h-fit">
        <h4 className="serif text-lg">Try one of these</h4>
        <div className="mt-4 space-y-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={busy}
              className="w-full text-left text-sm px-3 py-2.5 rounded-lg transition"
              style={{
                border: "1px solid var(--line)",
                color: "var(--ink-soft)",
                background: "var(--brand-powder-pale)",
              }}
            >
              {q}
            </button>
          ))}
        </div>
        <div
          className="mt-6 pt-5 text-xs leading-relaxed"
          style={{ borderTop: "1px solid var(--line)", color: "var(--ink-faint)" }}
        >
          Ask it something that is not in the five demo listings. It will tell you
          it has to check with the agent instead of inventing an answer. That is the
          single most important behaviour in the whole system.
        </div>
      </div>
    </div>
  );
}
