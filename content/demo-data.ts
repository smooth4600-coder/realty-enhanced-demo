/*
  Demo data only. No real customer information.
  The assistant may speak about these listings and nothing else.
  Market: United States. Change this file to re-point the demo at another market.
*/

export const AGENCY = {
  name: "Realty Enhanced",
  agentName: "Megan Carter",
  city: "Tampa, Florida",
  hours: "Monday through Saturday, 9:00 AM to 8:00 PM Eastern",
  viewingPolicy:
    "Showings run Monday through Saturday, 10:00 AM to 7:00 PM. Sundays are not available.",
  feeNote:
    "Commission and fees are handled by Megan directly. The assistant never quotes or negotiates them.",
};

export type Listing = {
  ref: string;
  title: string;
  area: string;
  type: string;
  price: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  year: number;
  hoa: string;
  features: string[];
  availability: string;
};

export const LISTINGS: Listing[] = [
  {
    ref: "RE-1042",
    title: "Updated bungalow in Seminole Heights",
    area: "Seminole Heights, Tampa",
    type: "Single family",
    price: "$415,000",
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1_640,
    year: 1948,
    hoa: "No HOA",
    features: [
      "Kitchen and both baths renovated in 2022",
      "Original hardwood floors throughout",
      "Fenced backyard with a screened porch",
      "New roof in 2021, HVAC in 2020",
      "Two car driveway, no garage",
    ],
    availability: "Vacant, showings available this week",
  },
  {
    ref: "RE-1078",
    title: "Waterfront condo on Harbour Island",
    area: "Harbour Island, Tampa",
    type: "Condo",
    price: "$689,000",
    bedrooms: 2,
    bathrooms: 2,
    sqft: 1_310,
    year: 2006,
    hoa: "$742 per month",
    features: [
      "Ninth floor, water view from the living room and primary bedroom",
      "Deeded parking space in the garage",
      "Building pool, gym and 24 hour desk",
      "Walk to downtown and the Riverwalk",
      "HOA covers water, trash and exterior",
    ],
    availability: "Tenant occupied through next month, showings by appointment",
  },
  {
    ref: "RE-1091",
    title: "Family home with pool in Westchase",
    area: "Westchase, Tampa",
    type: "Single family",
    price: "$572,500",
    bedrooms: 4,
    bathrooms: 3,
    sqft: 2_480,
    year: 2015,
    hoa: "$118 per month",
    features: [
      "Screened saltwater pool",
      "Three car garage",
      "Open kitchen with quartz counters and a gas range",
      "Zoned for Westchase Elementary",
      "Primary suite on the first floor",
    ],
    availability: "Vacant, showings available this week",
  },
  {
    ref: "RE-1103",
    title: "Investment duplex near USF",
    area: "Temple Terrace, Tampa",
    type: "Duplex",
    price: "$298,000",
    bedrooms: 4,
    bathrooms: 2,
    sqft: 1_880,
    year: 1979,
    hoa: "No HOA",
    features: [
      "Both units leased, $1,450 and $1,375 per month",
      "Separate electric meters",
      "Roof replaced in 2023",
      "Two miles from the university",
      "Leases run through next summer",
    ],
    availability: "Tenant occupied, showings require 24 hour notice",
  },
  {
    ref: "RE-1115",
    title: "New construction in Lutz",
    area: "Lutz, Florida",
    type: "Single family",
    price: "$735,000",
    bedrooms: 5,
    bathrooms: 4,
    sqft: 3_210,
    year: 2026,
    hoa: "$95 per month",
    features: [
      "Builder warranty transfers to the buyer",
      "Impact rated windows throughout",
      "Loft plus a downstairs office",
      "Quarter acre lot backing to a preserve",
      "Three car tandem garage",
    ],
    availability: "Vacant, move in ready",
  },
];

export function listingsAsContext(): string {
  return LISTINGS.map((l) =>
    [
      `REF ${l.ref}: ${l.title}`,
      `  Area: ${l.area} | Type: ${l.type} | Price: ${l.price}`,
      `  ${l.bedrooms} bed, ${l.bathrooms} bath, ${l.sqft.toLocaleString("en-US")} sq ft, built ${l.year}, HOA: ${l.hoa}`,
      `  Features: ${l.features.join("; ")}`,
      `  Availability: ${l.availability}`,
    ].join("\n")
  ).join("\n\n");
}

export const SUGGESTED_QUESTIONS = [
  "Do you have anything under 450k with a yard?",
  "Is the Harbour Island condo still available?",
  "Can I see the Westchase house Saturday morning?",
  "What are the HOA fees on the new build in Lutz?",
  "What's the lowest they'd take?",
  "I'd rather just talk to a person.",
];
