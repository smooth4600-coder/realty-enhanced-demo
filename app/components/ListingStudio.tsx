"use client";

import { useRef, useState } from "react";

type Result = {
  photoOrder: {
    index: number;
    score: number;
    label: string;
    reason: string;
    subject: boolean;
  }[];
  warnings: string[];
  blocked?: boolean;
  blockedReason?: string;
  title: string;
  description: string;
  highlights: string[];
  socialCaption: string;
  notUsed: string[];
};

const MAX_PHOTOS = 10;

function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}
const MAX_EDGE = 1400;

/** Downscale in the browser so a 6 MB phone photo does not become a 8 MB request. */
async function toDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

function Copyable({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="text-xs font-semibold"
      style={{ color: "var(--brand-maroon)" }}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        window.setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? "Copied" : `Copy ${label}`}
    </button>
  );
}

export default function ListingStudio() {
  const [photos, setPhotos] = useState<string[]>([]);
  const [facts, setFacts] = useState({
    area: "",
    type: "",
    price: "",
    bedrooms: "",
    bathrooms: "",
    sqft: "",
    year: "",
    hoa: "",
    extras: "",
    language: "English",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setError(`This demo takes at most ${MAX_PHOTOS} photographs.`);
      return;
    }
    try {
      const chosen = Array.from(list)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, room);
      const urls = await Promise.all(chosen.map(toDataUrl));
      setPhotos((p) => [...p, ...urls]);
    } catch {
      setError("One of those files could not be read as an image.");
    }
  }

  async function run() {
    if (photos.length < 2) {
      setError("Upload at least two photographs.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/listing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photos, facts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Failed (${res.status})`);
      setResult(data as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const field = (
    key: keyof typeof facts,
    label: string,
    placeholder: string
  ) => (
    <label className="block">
      <span className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
        {label}
      </span>
      <input
        className="field mt-1"
        placeholder={placeholder}
        value={facts[key]}
        onChange={(e) => setFacts({ ...facts, [key]: e.target.value })}
      />
    </label>
  );

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-6 items-start">
      <div className="card p-6">
        <h3 className="serif text-xl">Build a listing</h3>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          Upload the photographs you would send to a portal and give the facts you
          have. The assistant orders the photographs and writes the advert.
        </p>

        <div
          className="mt-5 rounded-xl p-5 text-center cursor-pointer"
          style={{
            border: "1.5px dashed var(--brand-powder)",
            background: "var(--brand-powder-pale)",
          }}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void addFiles(e.dataTransfer.files);
          }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--brand-maroon)" }}>
            Drop photographs here, or click to choose
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
            Two to {MAX_PHOTOS} photographs. {photos.length} added.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => void addFiles(e.target.files)}
          />
        </div>

        {photos.length > 0 && (
          <div className="mt-4 grid grid-cols-5 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p}
                  alt={`Upload ${i + 1}`}
                  className="w-full h-14 object-cover rounded-md"
                  style={{ border: "1px solid var(--line)" }}
                />
                <button
                  onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full text-[11px] leading-none text-white"
                  style={{ background: "var(--brand-maroon)" }}
                  aria-label={`Remove photograph ${i + 1}`}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          {field("area", "Area", "Seminole Heights, Tampa")}
          {field("type", "Type", "Single family")}
          {field("price", "Asking price", "$415,000")}
          {field("sqft", "Size, sq ft", "1,640")}
          {field("bedrooms", "Bedrooms", "3")}
          {field("bathrooms", "Bathrooms", "2")}
          {field("year", "Year built", "1948")}
          {field("hoa", "HOA", "No HOA")}
        </div>

        <label className="block mt-3">
          <span className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
            Anything else the advert should mention
          </span>
          <textarea
            className="field mt-1"
            rows={3}
            placeholder="New roof 2021, fenced backyard, walk to Hillsborough River"
            value={facts.extras}
            onChange={(e) => setFacts({ ...facts, extras: e.target.value })}
          />
        </label>

        <label className="block mt-3">
          <span className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
            Write it in
          </span>
          <select
            className="field mt-1"
            value={facts.language}
            onChange={(e) => setFacts({ ...facts, language: e.target.value })}
          >
            <option>English</option>
            <option>Spanish</option>
          </select>
        </label>

        <button
          className="btn-primary w-full py-3 mt-5 text-sm"
          onClick={run}
          disabled={busy || photos.length < 2}
        >
          {busy ? "Working on it" : "Order the photos and write the listing"}
        </button>

        {error && (
          <p className="mt-3 text-sm" style={{ color: "var(--brand-maroon)" }}>
            {error}
          </p>
        )}
      </div>

      <div className="card p-6 min-h-[420px]">
        {!result && !busy && (
          <div className="h-full flex flex-col items-center justify-center text-center py-16">
            <p className="serif text-lg">The finished advert appears here</p>
            <p className="text-sm mt-2 max-w-sm" style={{ color: "var(--ink-soft)" }}>
              Photographs in the order a buyer should see them, a title, a
              description, highlights and a social caption.
            </p>
          </div>
        )}

        {busy && (
          <div className="h-full flex flex-col items-center justify-center text-center py-16">
            <p className="serif text-lg">Looking at the photographs</p>
            <p className="text-sm mt-2" style={{ color: "var(--ink-soft)" }}>
              Scoring each one, then writing the advert. This takes a few seconds.
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-7">
            {result.warnings?.length > 0 && (
              <section
                className="rounded-xl p-4"
                style={{
                  border: "1px solid var(--brand-maroon)",
                  background: "#fdf6f7",
                }}
              >
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--brand-maroon)" }}
                >
                  Check these photographs
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {result.warnings.map((w) => (
                    <li key={w} style={{ color: "var(--ink-soft)" }}>
                      {w}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <div className="flex items-baseline justify-between">
                <h4 className="serif text-lg">Photographs, reordered</h4>
                <span className="pill">Best first</span>
              </div>
              <div className="mt-4 space-y-2.5">
                {result.photoOrder.map((p, position) => (
                  <div
                    key={p.index}
                    className="flex gap-3 items-center p-2 rounded-lg"
                    style={{
                      background: p.subject === false ? "#fdf6f7" : "var(--brand-powder-pale)",
                      opacity: p.subject === false ? 0.75 : 1,
                    }}
                  >
                    <span
                      className="serif text-lg w-6 text-center shrink-0"
                      style={{ color: "var(--brand-maroon)" }}
                    >
                      {position + 1}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photos[p.index]}
                      alt={p.label}
                      className="h-14 w-20 object-cover rounded-md shrink-0"
                      style={{ border: "1px solid var(--line)" }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{p.label}</span>
                        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                          {p.score}/100
                        </span>
                        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                          you uploaded this {ordinal(p.index + 1)}
                        </span>
                        {position === 0 && p.subject !== false && (
                          <span className="pill" style={{ fontSize: 10 }}>
                            Lead image
                          </span>
                        )}
                        {p.subject === false && (
                          <span
                            className="pill"
                            style={{
                              fontSize: 10,
                              borderColor: "var(--brand-maroon)",
                              background: "#fff",
                              color: "var(--brand-maroon)",
                            }}
                          >
                            Different property
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>
                        {p.reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {result.blocked ? (
              <section
                style={{ borderTop: "1px solid var(--line)", paddingTop: 22 }}
              >
                <h4 className="serif text-lg">No listing was written</h4>
                <p
                  className="text-sm mt-2 max-w-xl leading-relaxed"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {result.blockedReason}
                </p>
                <p className="text-xs mt-3" style={{ color: "var(--ink-faint)" }}>
                  Writing an advert from photographs of different homes would put
                  wrong information in front of a buyer, so the assistant stops
                  instead of guessing which one you meant.
                </p>
              </section>
            ) : (
            <section style={{ borderTop: "1px solid var(--line)", paddingTop: 22 }}>
              <div className="flex items-baseline justify-between">
                <h4 className="serif text-lg">The advert</h4>
                <Copyable
                  label="advert"
                  text={`${result.title}\n\n${result.description}\n\n${result.highlights
                    .map((h) => `- ${h}`)
                    .join("\n")}`}
                />
              </div>
              <p className="serif text-xl mt-3">{result.title}</p>
              <p
                className="text-sm mt-3 whitespace-pre-wrap leading-relaxed"
                style={{ color: "var(--ink-soft)" }}
              >
                {result.description}
              </p>
              {result.highlights?.length > 0 && (
                <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  {result.highlights.map((h) => (
                    <li key={h} className="flex gap-2">
                      <span style={{ color: "var(--brand-maroon)" }}>&bull;</span>
                      <span style={{ color: "var(--ink-soft)" }}>{h}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            )}

            {!result.blocked && result.socialCaption && (
              <section style={{ borderTop: "1px solid var(--line)", paddingTop: 22 }}>
                <div className="flex items-baseline justify-between">
                  <h4 className="serif text-lg">Social caption</h4>
                  <Copyable label="caption" text={result.socialCaption} />
                </div>
                <p
                  className="text-sm mt-3 whitespace-pre-wrap leading-relaxed"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {result.socialCaption}
                </p>
              </section>
            )}

            {!result.blocked && result.notUsed?.length > 0 && (
              <section style={{ borderTop: "1px solid var(--line)", paddingTop: 22 }}>
                <h4 className="serif text-lg">Deliberately left out</h4>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {result.notUsed.map((n) => (
                    <li key={n} style={{ color: "var(--ink-soft)" }}>
                      {n}
                    </li>
                  ))}
                </ul>
                <p className="text-xs mt-3" style={{ color: "var(--ink-faint)" }}>
                  The assistant writes only what your facts and your photographs
                  support. Anything it could not verify is listed here instead of
                  being guessed.
                </p>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
