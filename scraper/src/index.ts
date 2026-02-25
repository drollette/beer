/**
 * Brew Day Water Scraper
 *
 * Cron-triggered worker that fetches water baseline data from a static JSON URL
 * (e.g., a GitHub Gist) and upserts it into the D1 database.
 *
 * Includes sanity-check validation against reasonable Boise-area groundwater
 * ranges to prevent data corruption from bad upstream data.
 */

interface Env {
  DB: D1Database;
  BASELINE_URL?: string;
}

interface BaselinePayload {
  date: string;
  ca: number;
  mg: number;
  na: number;
  cl: number;
  so4: number;
  alkalinity: number;
  ph: number;
}

// Reasonable ranges for Boise / Treasure Valley groundwater (ppm)
const SANITY_RANGES: Record<string, { min: number; max: number }> = {
  ca:         { min: 10,  max: 100 },
  mg:         { min: 1,   max: 50 },
  na:         { min: 5,   max: 150 },
  cl:         { min: 1,   max: 100 },
  so4:        { min: 5,   max: 200 },
  alkalinity: { min: 30,  max: 400 },
  ph:         { min: 6.0, max: 9.0 },
};

function isValidPayload(data: unknown): data is BaselinePayload {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.date === "string" &&
    typeof d.ca === "number" &&
    typeof d.mg === "number" &&
    typeof d.na === "number" &&
    typeof d.cl === "number" &&
    typeof d.so4 === "number" &&
    typeof d.alkalinity === "number" &&
    typeof d.ph === "number"
  );
}

function sanityCheck(data: BaselinePayload): string[] {
  const errors: string[] = [];
  for (const [key, range] of Object.entries(SANITY_RANGES)) {
    const value = data[key as keyof BaselinePayload] as number;
    if (value < range.min || value > range.max) {
      errors.push(
        `${key}: ${value} is outside expected range [${range.min}–${range.max}]`
      );
    }
  }
  return errors;
}

export default {
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const url = env.BASELINE_URL;
    if (!url) {
      console.log("BASELINE_URL not configured – skipping scrape.");
      return;
    }
    ctx.waitUntil(scrape(url, env.DB));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/trigger" && request.method === "GET") {
      const baselineUrl = env.BASELINE_URL;
      if (!baselineUrl) {
        return new Response("BASELINE_URL not configured", { status: 500 });
      }
      await scrape(baselineUrl, env.DB);
      return new Response("Scrape completed", { status: 200 });
    }
    return new Response("Brew Day Scraper Worker", { status: 200 });
  },
};

async function scrape(url: string, db: D1Database): Promise<void> {
  console.log(`Fetching baseline from: ${url}`);

  const resp = await fetch(url);
  if (!resp.ok) {
    console.error(`Fetch failed: ${resp.status} ${resp.statusText}`);
    return;
  }

  const data: unknown = await resp.json();

  if (!isValidPayload(data)) {
    console.error("Invalid payload shape", data);
    return;
  }

  // Sanity check: reject values outside Boise groundwater norms
  const violations = sanityCheck(data);
  if (violations.length > 0) {
    console.error("Sanity check failed – skipping insert:", violations);
    return;
  }

  await db
    .prepare(
      `INSERT INTO water_baseline (date, ca, mg, na, cl, so4, alkalinity, ph)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      data.date,
      data.ca,
      data.mg,
      data.na,
      data.cl,
      data.so4,
      data.alkalinity,
      data.ph
    )
    .run();

  console.log(`Baseline for ${data.date} inserted successfully.`);
}
