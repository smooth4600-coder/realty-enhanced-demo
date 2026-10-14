# Keller, a real estate virtual assistant demo

A public page that lets a prospective customer test the assistant for themselves,
before anyone tries to sell them anything.

Three things to try:

1. **On a call** — browser microphone straight to the voice agent. No number is dialled.
2. **On text** — the same assistant, streaming, grounded in five sample listings.
3. **Listing studio** — upload property photographs and get them scored and reordered,
   plus a title, a description, highlights and a social caption.

## What the demo proves

The hard part of selling an AI assistant to a real estate agent is not showing that it
talks. It is showing where it stops. Ask it for the lowest a seller would take, ask
whether a neighbourhood suits a certain kind of family, or ask about a listing that does
not exist. It refuses all three and hands you to the agent instead of guessing.

The listing studio holds the same line. The copywriter never sees a photograph: a vision
model reports what is actually visible, and the writer may only use that plus the facts
the agent typed. If the photographs turn out to be of different buildings, it says so
rather than writing an advert about three houses at once.

## Architecture worth knowing about

**The listing pipeline is two calls, not one.** Asking a single model to do visual
forensics and creative writing in the same response was unreliable: it would either group
the photographs correctly and write badly, or write well and quietly treat three
different houses as one. So a stronger model looks at the pictures and reports facts, and
a cheaper model writes from those facts without ever seeing an image.

**The voice budget is enforced against Retell, not the browser.** Each visitor gets a
fixed number of talk seconds in total, not per call, and it does not reset on a timer.
The duration is read back from Retell using the call id, so closing the tab mid-call does
not avoid the charge. The spend is carried in a signed cookie so a serverless restart
does not hand everyone a fresh budget.

**Cost guards are real code, not documentation.** Every limit in `.env.local.example` is
read and enforced in `lib/rate-limit.ts` and `lib/voice-budget.ts`.

## Run it

    npm install
    cp .env.local.example .env.local   # then fill it in
    npm run dev

## Test the listing pipeline

    PHOTO_DIR=/path/to/jpgs node scripts/test-listing.mjs

Five scenarios: one property with no facts, one with full facts, an obvious outlier
photograph mixed in, three different houses, and a single photograph. It asserts no
invented language, no photo numbers in prose that would not match the screen, correct
handling of every index, and that a mixed set is caught and flagged.

## Brand

Every colour lives in `app/globals.css` under `:root`. Changing that block rebrands the
whole page.
