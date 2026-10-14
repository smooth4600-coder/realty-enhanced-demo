/*
  Listing studio test suite.

  Checks the things that would embarrass an agent in front of a buyer:
  invented features, photographs of the wrong building, a weak lead image,
  photo numbers in prose that do not match the screen, and fair housing
  language. Run it against a deployment before sending the link to anyone.

    node scripts/test-listing.mjs                       # production
    BASE=http://localhost:3100 node scripts/test-listing.mjs
*/

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE || "https://realty-enhanced-demo.vercel.app";
const CODE = process.env.DEMO_CODE || "realty-demo-2026";
const PHOTO_DIR = process.env.PHOTO_DIR;

if (!PHOTO_DIR) {
  console.error("Set PHOTO_DIR to a folder of jpgs named 1.jpg, 2.jpg, ...");
  process.exit(1);
}

const dataUrl = (n) =>
  "data:image/jpeg;base64," +
  readFileSync(join(PHOTO_DIR, n)).toString("base64");

const available = readdirSync(PHOTO_DIR).filter((f) => /\.jpe?g$/i.test(f));
const pick = (...names) => {
  for (const n of names) if (!available.includes(n)) throw new Error(`missing ${n}`);
  return names.map(dataUrl);
};

let cookie = "";
async function signIn() {
  const res = await fetch(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: CODE }),
  });
  if (!res.ok) throw new Error(`auth failed ${res.status}`);
  cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function run(photos, facts) {
  const res = await fetch(`${BASE}/api/listing`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ photos, facts }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// ---- assertions ---------------------------------------------------------

const BANNED = [
  // invented interior, when no interior photo or fact was supplied
  /\bopen (floor ?plan|layout)\b/i,
  /\bnatural light\b/i,
  /\bprimary (suite|bedroom)\b/i,
  /\bthree levels\b/i,
  /\bhardwood\b/i,
  // unprovable market and area claims
  /\bdesirable\b/i,
  /\bestablished neighborhood\b/i,
  /\bsought[- ]after\b/i,
  /\bprime location\b/i,
  /\bup and coming\b/i,
  // fair housing
  /\bfamily[- ]friendly\b/i,
  /\bperfect for\b/i,
  /\bsafe neighborhood\b/i,
  // unprovable superlatives
  /\b(stunning|luxurious|dream home|must see)\b/i,
  // proximity claims nobody supplied
  /\bclose to (shops|dining|schools|transit)\b/i,
  /\bwalk(ing)? distance\b/i,
];

const PHOTO_NUMBER = /\b(photographs?|photos?|images?|pictures?)\s*#?\s*\d/i;

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  -> ${detail}`}`);
  if (!ok) failures++;
};

const allProse = (d) =>
  [
    d.title,
    d.description,
    ...(d.highlights ?? []),
    d.socialCaption,
    ...(d.notUsed ?? []),
    ...(d.warnings ?? []),
    ...(d.photoOrder ?? []).flatMap((p) => [p.label, p.reason]),
  ].join(" \n ");

function baseChecks(d, photoCount) {
  const prose = allProse(d);
  const hit = BANNED.find((re) => re.test(prose));
  check("no invented or unprovable language", !hit, hit && `matched ${hit}`);
  check("no photo numbers in prose", !PHOTO_NUMBER.test(prose));
  check("every photo returned exactly once",
    d.photoOrder.length === photoCount &&
      new Set(d.photoOrder.map((p) => p.index)).size === photoCount,
    `got ${d.photoOrder.length}`);
  check("indices are in range",
    d.photoOrder.every((p) => p.index >= 0 && p.index < photoCount));
  check("description within 180 words",
    d.description.split(/\s+/).filter(Boolean).length <= 180);
  check("has a title and a caption", !!d.title && !!d.socialCaption);
  check("3 to 8 highlights",
    d.highlights.length >= 3 && d.highlights.length <= 8,
    `got ${d.highlights.length}`);
}

// ---- scenarios ----------------------------------------------------------

async function main() {
  await signIn();
  console.log(`Testing ${BASE}\n`);

  // 1. One real property, no facts at all. Must not invent anything.
  console.log("SCENARIO 1  one property, no facts supplied");
  {
    const photos = pick("same1.jpg", "same2.jpg");
    const d = await run(photos, { language: "English" });
    baseChecks(d, photos.length);
    check("did not invent a price", !/\$\s?\d/.test(allProse(d)));
    check("did not invent bed or bath counts",
      !/\b\d+\s*(bed|bath)/i.test(d.description));
  }

  // 2. One real property with full facts. Must use them and still not invent.
  console.log("\nSCENARIO 2  one property, full facts");
  {
    const photos = pick("same1.jpg", "same2.jpg");
    const d = await run(photos, {
      area: "Seminole Heights, Tampa",
      type: "Single family",
      price: "$415,000",
      bedrooms: "3",
      bathrooms: "2",
      sqft: "1640",
      year: "1948",
      hoa: "No HOA",
      extras: "New roof 2021, fenced backyard, two-car garage",
      language: "English",
    });
    baseChecks(d, photos.length);
    check("used the supplied area", /Seminole Heights/i.test(allProse(d)));
    check("used the supplied bed count",
      /\b3\b/i.test(allProse(d)) || /\bthree\b/i.test(allProse(d)));
    check("description is longer when given facts",
      d.description.split(/\s+/).length > 20,
      `${d.description.split(/\s+/).length} words`);
  }

  // 3. A photo of a clearly different building is mixed in. Must be caught.
  console.log("\nSCENARIO 3  an obvious outlier photo is mixed in");
  {
    const photos = pick("same1.jpg", "same2.jpg", "3.jpg"); // 3.jpg is a stucco close-up
    const d = await run(photos, { language: "English" });
    baseChecks(d, photos.length);
    const flagged = d.photoOrder.filter((p) => p.subject === false);
    check("the outlier is flagged", flagged.length >= 1,
      `flagged ${flagged.length}`);
    check("the agent is warned", d.warnings.length >= 1);
    check("the outlier is ranked last",
      flagged.length === 0 ||
        d.photoOrder[d.photoOrder.length - 1].subject === false);
    check("the outlier scores at most 20",
      flagged.every((p) => p.score <= 20));
  }

  // 4. Three different houses. The hard case: they all look plausible.
  console.log("\nSCENARIO 4  three different houses, all plausible");
  {
    const photos = pick("5.jpg", "7.jpg", "8.jpg");
    const d = await run(photos, { language: "English" });
    const flagged = d.photoOrder.filter((p) => p.subject === false);
    check("every photo returned exactly once",
      d.photoOrder.length === photos.length);
    check("at least one house is flagged as different", flagged.length >= 1,
      `flagged ${flagged.length} of ${photos.length}`);
    check("the agent is warned", d.warnings.length >= 1);
    check("no photo numbers in prose", !PHOTO_NUMBER.test(allProse(d)));
    check("never shows an empty advert", !d.blocked);
    baseChecks(d, photos.length);
    check("warns that only one photo was used",
      d.warnings.some((w) => /different building|single home|strongest one/i.test(w)));
  }

  // 5. A single photograph. Grouping is meaningless but copy must still work.
  console.log("\nSCENARIO 5  a single photograph");
  {
    const photos = pick("same1.jpg");
    const d = await run(photos, { language: "English" });
    baseChecks(d, photos.length);
    check("not blocked", !d.blocked);
    check("no warnings for a single photo", d.warnings.length === 0);
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 1 && 0 : 1);
}

main().catch((e) => {
  console.error("\nsuite error:", e.message);
  process.exit(1);
});
