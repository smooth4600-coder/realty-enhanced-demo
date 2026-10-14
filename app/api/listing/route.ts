import { NextRequest, NextResponse } from "next/server";
import { LISTING_WRITER_PROMPT, PHOTO_ANALYST_PROMPT } from "@/content/prompts";
import { DAY_MS, LIMITS, clientKey, limited, take } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 180;

type Facts = {
  area?: string;
  type?: string;
  price?: string;
  bedrooms?: string;
  bathrooms?: string;
  sqft?: string;
  year?: string;
  hoa?: string;
  extras?: string;
  language?: string;
};

type Body = { photos?: string[]; facts?: Facts };

type AnalystPhoto = {
  index: number;
  subject: boolean;
  score: number;
  label: string;
  reason: string;
  differsBecause: string;
};

function bad(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

/*
  Both models are told not to cite photograph numbers, because the agent sees
  the photographs reordered and the numbers will not match their screen. They
  sometimes do it anyway, so the text is cleaned here rather than trusted.
*/
function stripPhotoNumbers(s: string): string {
  return s
    .replace(
      /\b(photographs?|photos?|images?|pictures?)\s*#?\s*\d+(\s*(and|,|&)\s*#?\s*\d+)*/gi,
      "another photograph"
    )
    .replace(
      /\bthe (first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(photograph|photo|image|picture)\b/gi,
      "another photograph"
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

function clean(s: unknown, max: number): string {
  return stripPhotoNumbers(String(s ?? "")).slice(0, max);
}

async function callModel(
  apiKey: string,
  model: string,
  system: string,
  content: unknown,
  maxTokens: number
): Promise<
  { ok: true; data: Record<string, unknown> } | { ok: false; detail: string }
> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Title": "Realty Enhanced Demo",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return {
      ok: false,
      detail: `${model} returned ${res.status}. ${detail.slice(0, 200)}`,
    };
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = (payload.choices?.[0]?.message?.content ?? "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    return { ok: true, data: JSON.parse(raw) as Record<string, unknown> };
  } catch {
    return { ok: false, detail: `${model} did not return valid JSON` };
  }
}

function factsBlock(f: Facts): string {
  const rows: [string, string | undefined][] = [
    ["Area", f.area],
    ["Property type", f.type],
    ["Asking price", f.price],
    ["Bedrooms", f.bedrooms],
    ["Bathrooms", f.bathrooms],
    ["Size in square feet", f.sqft],
    ["Year built", f.year],
    ["HOA", f.hoa],
    ["Other facts from the agent", f.extras],
  ];
  const given = rows
    .filter(([, v]) => v && String(v).trim().length > 0)
    .map(([k, v]) => `- ${k}: ${String(v).trim()}`);
  return given.length ? given.join("\n") : "- The agent supplied no facts.";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  // The photo work decides correctness, so it gets the stronger model.
  const visionModel =
    process.env.OPENROUTER_VISION_MODEL || "anthropic/claude-sonnet-5";
  // The writer never sees an image, so it can be the cheap one.
  const writerModel =
    process.env.OPENROUTER_WRITER_MODEL || "anthropic/claude-haiku-4.5";

  if (!apiKey) return bad(500, "config_missing", "OPENROUTER_API_KEY is not set");

  const retry = take(clientKey(req, "listing"), LIMITS.listingPerDay(), DAY_MS);
  if (retry !== null) {
    return limited(
      retry,
      `This demo allows ${LIMITS.listingPerDay()} listings per day from one device.`
    ) as unknown as NextResponse;
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return bad(400, "invalid_body", "Body must be JSON");
  }

  const photos = (body.photos ?? []).filter(
    (p) => typeof p === "string" && p.startsWith("data:image/")
  );
  if (photos.length < 1)
    return bad(400, "photos_required", "Upload at least one photograph");
  if (photos.length > LIMITS.maxPhotos()) {
    return bad(
      400,
      "too_many_photos",
      `Upload at most ${LIMITS.maxPhotos()} photographs`
    );
  }

  const facts = body.facts ?? {};
  const language = facts.language?.trim() || "English";

  // ---- Step 1: look at the photographs -----------------------------------
  const analystContent: unknown[] = [
    {
      type: "text",
      text:
        photos.length === 1
          ? `There is one photograph, numbered 1. There is nothing to group, so mark it "subject": true. Score it and list what is visible. Return the JSON object only.`
          : `There are ${photos.length} photographs, numbered 1 to ${photos.length} in the order they appear below. Group them, score them, and list what is visible. Return the JSON object only.`,
    },
  ];
  photos.forEach((dataUrl, i) => {
    analystContent.push({ type: "text", text: `Photograph ${i + 1}:` });
    analystContent.push({ type: "image_url", image_url: { url: dataUrl } });
  });

  const analysis = await callModel(
    apiKey,
    visionModel,
    PHOTO_ANALYST_PROMPT,
    analystContent,
    2500
  );
  if (!analysis.ok) return bad(502, "analysis_failed", analysis.detail);

  const rawPhotos = Array.isArray(analysis.data.photos)
    ? (analysis.data.photos as Partial<AnalystPhoto>[])
    : [];

  const seen = new Set<number>();
  const scored: AnalystPhoto[] = [];
  for (const p of rawPhotos) {
    const i = Number(p?.index) - 1;
    if (!Number.isInteger(i) || i < 0 || i >= photos.length || seen.has(i))
      continue;
    seen.add(i);
    const isSubject = p?.subject !== false;
    scored.push({
      index: i,
      subject: isSubject,
      // A non-subject photo can never outrank a real one, whatever the model said.
      score: Math.max(0, Math.min(isSubject ? 100 : 20, Number(p?.score) || 0)),
      label: clean(p?.label, 70) || "Photograph",
      reason: clean(p?.reason, 300),
      differsBecause: clean(p?.differsBecause, 300),
    });
  }
  // Any photo the model forgot is still shown, never silently dropped.
  photos.forEach((_, i) => {
    if (!seen.has(i)) {
      scored.push({
        index: i,
        subject: true,
        score: 0,
        label: "Not scored",
        reason: "The photo editor did not return a position for this photograph.",
        differsBecause: "",
      });
    }
  });

  // Subject photos first, then by score. The order is decided here, not by a model.
  scored.sort((a, b) =>
    a.subject === b.subject ? b.score - a.score : a.subject ? -1 : 1
  );

  /*
    Nothing grouped: every photograph looks like a different building. Rather
    than showing the agent an empty advert, treat the strongest photograph as
    the subject and write from that one alone, with a warning. The copy stays
    truthful because it is still built from one real property.
  */
  let fellBackToOnePhoto = false;
  if (scored.every((p) => !p.subject) && scored.length > 0) {
    const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
    best.subject = true;
    best.score = Math.max(best.score, 60);
    best.differsBecause = "";
    fellBackToOnePhoto = true;
    scored.sort((a, b) =>
      a.subject === b.subject ? b.score - a.score : a.subject ? -1 : 1
    );
  }

  const visibleFeatures: string[] = (
    Array.isArray(analysis.data.visibleFeatures)
      ? analysis.data.visibleFeatures
      : []
  )
    .slice(0, 20)
    .map((f) => clean(f, 160))
    .filter(Boolean);

  const outsiders = scored.filter((p) => !p.subject);

  // When nothing grouped, visibleFeatures is empty because the photo editor
  // found no subject property. Give the writer what the editor did say about
  // the one photograph we fell back to, so it has real material to work from.
  if (fellBackToOnePhoto && visibleFeatures.length === 0) {
    const best = scored.find((p) => p.subject);
    if (best) {
      if (best.label) visibleFeatures.push(best.label);
      if (best.reason) visibleFeatures.push(best.reason);
    }
  }

  // ---- Step 2: write the copy, without ever seeing a photograph ----------
  const writerInput = `Write the listing in ${language}.

FACTS THE AGENT TYPED
${factsBlock(facts)}

FEATURES THE PHOTO EDITOR CONFIRMED ARE VISIBLE
${
  visibleFeatures.length
    ? visibleFeatures.map((f) => `- ${f}`).join("\n")
    : "- The photo editor confirmed no usable features."
}

Return the JSON object only.`;

  const copy = await callModel(
    apiKey,
    writerModel,
    LISTING_WRITER_PROMPT,
    writerInput,
    1200
  );
  if (!copy.ok) return bad(502, "writing_failed", copy.detail);
  const written = copy.data;

  const notUsed = (Array.isArray(written.notUsed) ? written.notUsed : [])
    .slice(0, 10)
    .map((n) => clean(n, 220))
    .filter(Boolean);

  // The agent is warned about excluded photos here, deterministically, rather
  // than depending on the writer to remember to mention them.
  const warnings = outsiders.map(
    (p) =>
      `"${p.label}" was left out of the copy: ${
        p.differsBecause ||
        "it does not appear to show the same building as the others."
      }`
  );
  if (fellBackToOnePhoto) {
    warnings.unshift(
      "These photographs each appear to show a different building, so the listing below was written from the strongest one only. Upload photographs of a single home for a full listing."
    );
  } else if (analysis.data.sameProperty === false && outsiders.length === 0) {
    warnings.push(
      clean(analysis.data.note, 220) ||
        "These photographs do not appear to all show the same property."
    );
  }

  // The writer sometimes returns no highlights when the agent typed no facts,
  // even though the photo editor found plenty to list. Fall back to those.
  function highlights(): string[] {
    const fromWriter = (
      Array.isArray(written.highlights) ? written.highlights : []
    )
      .slice(0, 8)
      .map((h) => clean(h, 120))
      .filter(Boolean);
    if (fromWriter.length >= 3) return fromWriter;

    const extras = visibleFeatures
      .filter((f) => !fromWriter.some((h) => h.toLowerCase() === f.toLowerCase()))
      .map((f) => (f.length > 60 ? f.slice(0, 57) + "..." : f));
    return [...fromWriter, ...extras].slice(0, 8);
  }

  return NextResponse.json({
    photoOrder: scored.map(({ index, score, label, reason, subject }) => ({
      index,
      score,
      label,
      reason,
      subject,
    })),
    title: clean(written.title, 200),
    description: clean(written.description, 4000),
    highlights: highlights(),
    socialCaption: clean(written.socialCaption, 600),
    notUsed,
    warnings,
    fellBackToOnePhoto,
    visibleFeatures,
    models: { photos: visionModel, copy: writerModel },
  });
}
