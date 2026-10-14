"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "connecting" | "live" | "ending" | "error";

function mmss(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function CallDemo() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  // Total talk time left for this visitor, not a per-call limit.
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [budgetSec, setBudgetSec] = useState(300);
  const [spent, setSpent] = useState(false);

  const clientRef = useRef<{ stopCall: () => void } | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedRef = useRef<number | null>(null);
  const maxRef = useRef(300);
  const callIdRef = useRef<string | null>(null);

  function cleanup() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    startedRef.current = null;
  }

  useEffect(() => {
    return () => {
      cleanup();
      clientRef.current?.stopCall();
    };
  }, []);

  // Show the real budget, and what is left, before anyone presses anything.
  useEffect(() => {
    let live = true;
    void fetch("/api/retell-webcall-token")
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        if (typeof d.budgetSeconds === "number") setBudgetSec(d.budgetSeconds);
        if (typeof d.remainingSeconds === "number") {
          setRemainingSec(d.remainingSeconds);
          maxRef.current = d.remainingSeconds;
        }
        if (d.spent) setSpent(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  function endCall() {
    setStatus("ending");
    clientRef.current?.stopCall();
  }

  async function startCall() {
    setError(null);
    setSeconds(0);
    setStatus("connecting");
    try {
      const res = await fetch("/api/retell-webcall-token", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "voice_budget_spent") {
          setSpent(true);
          setRemainingSec(0);
        }
        throw new Error(
          data.message || data.detail || `Could not start the call (${res.status})`
        );
      }

      if (typeof data.budgetSeconds === "number") setBudgetSec(data.budgetSeconds);
      if (typeof data.maxSeconds === "number") {
        maxRef.current = data.maxSeconds;
        setRemainingSec(data.maxSeconds);
      }
      callIdRef.current = data.call_id ?? null;

      const { RetellWebClient } = await import("retell-client-js-sdk");
      const client = new RetellWebClient();
      clientRef.current = client;

      client.on("call_started", () => {
        setStatus("live");
        startedRef.current = Date.now();
        timerRef.current = window.setInterval(() => {
          if (!startedRef.current) return;
          const elapsed = Math.floor((Date.now() - startedRef.current) / 1000);
          setSeconds(elapsed);
          setRemainingSec(Math.max(0, maxRef.current - elapsed));
          if (elapsed >= maxRef.current) {
            client.stopCall();
          }
        }, 500);
      });

      client.on("agent_start_talking", () => setSpeaking(true));
      client.on("agent_stop_talking", () => setSpeaking(false));

      client.on("call_ended", () => {
        cleanup();
        setSpeaking(false);
        setStatus("idle");
        // Charge the real duration, which the server reads back from Retell.
        const id = callIdRef.current;
        callIdRef.current = null;
        if (!id) return;
        void fetch("/api/call-ended", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ call_id: id }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (typeof d.remainingSeconds === "number") {
              setRemainingSec(d.remainingSeconds);
              setSpent(d.remainingSeconds < 30);
            }
          })
          .catch(() => {});
      });

      client.on("error", (e: unknown) => {
        cleanup();
        setSpeaking(false);
        setStatus("error");
        setError(e instanceof Error ? e.message : "The call dropped.");
        client.stopCall();
      });

      await client.startCall({ accessToken: data.access_token });
    } catch (e) {
      cleanup();
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not start the call.");
    }
  }

  const live = status === "live";

  return (
    <div className="grid md:grid-cols-[1fr_320px] gap-6">
      <div className="card p-7">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="serif text-xl">Call the assistant</h3>
            <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
              This is what your lead hears when they ring your office and nobody
              picks up. Speak normally, it answers out loud.
            </p>
          </div>
          <span className="pill">
            {live
              ? `${mmss(seconds)} used, ${mmss(remainingSec ?? 0)} left`
              : remainingSec === null
                ? `${Math.round(budgetSec / 60)} minutes of talk time`
                : `${mmss(remainingSec)} of talk time left`}
          </span>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center py-8">
          <div
            className={`h-24 w-24 rounded-full flex items-center justify-center ${
              live && speaking ? "live-ring" : ""
            }`}
            style={{
              background: live ? "var(--brand-maroon)" : "var(--brand-powder-light)",
              transition: "background .2s ease",
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z"
                fill={live ? "#fff" : "var(--brand-maroon)"}
              />
              <path
                d="M19 11a7 7 0 0 1-14 0M12 18v3"
                stroke={live ? "#fff" : "var(--brand-maroon)"}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <p className="mt-5 text-sm font-semibold" style={{ color: "var(--ink-soft)" }}>
            {status === "idle" && "Ready"}
            {status === "connecting" && "Connecting"}
            {status === "live" && (speaking ? "Assistant speaking" : "Listening to you")}
            {status === "ending" && "Ending"}
            {status === "error" && "Call failed"}
          </p>

          <div className="mt-6 flex gap-3">
            {!live ? (
              <button
                className="btn-primary px-7 py-2.5 text-sm"
                onClick={startCall}
                disabled={status === "connecting" || spent}
              >
                {spent
                  ? "Talk time used up"
                  : status === "connecting"
                    ? "Connecting"
                    : "Start the call"}
              </button>
            ) : (
              <button className="btn-ghost px-7 py-2.5 text-sm" onClick={endCall}>
                End call
              </button>
            )}
          </div>

          {error && (
            <p
              className="mt-4 text-sm text-center max-w-sm"
              style={{ color: "var(--brand-maroon)" }}
            >
              {error}
            </p>
          )}

          <p className="mt-5 text-xs text-center max-w-sm" style={{ color: "var(--ink-faint)" }}>
            {spent
              ? `This demo includes ${Math.round(budgetSec / 60)} minutes of talk time in total and they have been used. Ask us if you need more.`
              : `Your browser will ask for microphone access. Nothing is dialled and no number is called. This demo includes ${Math.round(budgetSec / 60)} minutes of talk time in total, across as many calls as you like.`}
          </p>
        </div>
      </div>

      <div className="card p-6 h-fit">
        <h4 className="serif text-lg">Try saying</h4>
        <ul className="mt-4 space-y-3 text-sm" style={{ color: "var(--ink-soft)" }}>
          <li>&ldquo;Hi, I saw the bungalow in Seminole Heights. Is it still available?&rdquo;</li>
          <li>&ldquo;I’m looking for a four bedroom with a pool, around 550.&rdquo;</li>
          <li>&ldquo;Can I see it Saturday morning?&rdquo;</li>
          <li>&ldquo;What’s the lowest they’d take?&rdquo;</li>
          <li>&ldquo;I’d rather just talk to a person.&rdquo;</li>
        </ul>
        <div
          className="mt-6 pt-5 text-xs leading-relaxed"
          style={{ borderTop: "1px solid var(--line)", color: "var(--ink-faint)" }}
        >
          The last two are the important ones. The assistant will not negotiate on
          price and it hands you straight to a person when asked. That boundary is
          set in the rules, not left to chance.
        </div>
      </div>
    </div>
  );
}
