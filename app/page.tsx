"use client";

import { useState } from "react";
import { LogoMark, Wordmark } from "./components/Logo";
import CallDemo from "./components/CallDemo";
import ChatDemo from "./components/ChatDemo";
import ListingStudio from "./components/ListingStudio";

type Tab = "call" | "chat" | "listing";

const TABS: { id: Tab; label: string; caption: string }[] = [
  { id: "call", label: "On a call", caption: "They ring. It answers." },
  { id: "chat", label: "On text", caption: "Website, SMS, WhatsApp." },
  { id: "listing", label: "Listing studio", caption: "Photos in, listing out." },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("call");

  return (
    <main className="min-h-screen">
      <header
        className="sticky top-0 z-40 backdrop-blur"
        style={{
          background: "rgba(238,243,249,0.9)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Wordmark />
          <span className="pill hidden sm:inline-flex">Test environment</span>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-dark">
        <div className="max-w-6xl mx-auto px-5 py-16 sm:py-20 relative">
          <div className="hero-glyph" aria-hidden="true">
            <LogoMark size={340} />
          </div>
          <div className="relative">
            <p className="wordmark-sub text-[10px]" style={{ color: "var(--brand-powder)" }}>
              Try it yourself
            </p>
            <h1
              className="serif text-4xl sm:text-[56px] mt-5 max-w-3xl leading-[1.08]"
              style={{ color: "#fff" }}
            >
              Test Keller, your virtual assistant that answers your leads 24/7.
            </h1>
            <p
              className="mt-6 text-base sm:text-lg max-w-2xl leading-relaxed"
              style={{ color: "var(--brand-powder)" }}
            >
              This is the live assistant, not a recording. Call it, text it, and hand
              it a set of property photos. It behaves here exactly as it would on
              your own line, with your own listings.
            </p>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <nav className="max-w-6xl mx-auto px-5 -mt-7 relative z-10">
        <div className="card p-2 inline-flex gap-1.5 flex-wrap shadow-sm">
          {TABS.map((t) => (
            <button
              key={t.id}
              className="tab px-5 py-2.5 text-left"
              data-active={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              <span className="block text-sm">{t.label}</span>
              <span className="block text-[11px] opacity-75 mt-0.5">{t.caption}</span>
            </button>
          ))}
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-5 py-8">
        {tab === "call" && <CallDemo />}
        {tab === "chat" && <ChatDemo />}
        {tab === "listing" && <ListingStudio />}
      </section>

      {/* Guardrails */}
      <section className="max-w-6xl mx-auto px-5 pb-16">
        <div className="card p-7">
          <h3 className="serif text-xl">Where it stops</h3>
          <p className="text-sm mt-1.5" style={{ color: "var(--ink-soft)" }}>
            Try to break it. These three are written into the rules, not left to
            chance.
          </p>
          <div className="mt-6 grid sm:grid-cols-3 gap-6 text-sm">
            <div>
              <p className="font-semibold">It will not negotiate</p>
              <p className="mt-1.5" style={{ color: "var(--ink-soft)" }}>
                Ask for the lowest they would take. It gives you the list price and
                puts you through to the agent. Price and commission are never the
                assistant&rsquo;s to discuss.
              </p>
            </div>
            <div>
              <p className="font-semibold">It will not steer</p>
              <p className="mt-1.5" style={{ color: "var(--ink-soft)" }}>
                Ask whether a neighborhood suits a certain kind of family. It
                declines and returns to the property facts. Fair housing is built in,
                not trained in afterwards.
              </p>
            </div>
            <div>
              <p className="font-semibold">It will not make things up</p>
              <p className="mt-1.5" style={{ color: "var(--ink-soft)" }}>
                Ask about a listing that does not exist. It says it will check with
                the agent rather than inventing a price. This demo holds five Tampa
                listings and knows nothing else.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer
        className="max-w-6xl mx-auto px-5 py-8 text-xs"
        style={{ borderTop: "1px solid var(--line)", color: "var(--ink-faint)" }}
      >
        Realty Enhanced demonstration environment. Sample listings only, no real
        customer data. Conversations here are not saved against a customer record.
      </footer>
    </main>
  );
}
