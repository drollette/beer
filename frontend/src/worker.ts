/**
 * Frontend Worker
 *
 * Serves the React SPA via Cloudflare Assets and exposes API endpoints
 * to read from the D1 database.
 */

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API routes
    if (url.pathname === "/api/baseline") {
      return handleBaseline(env.DB);
    }
    if (url.pathname === "/api/styles") {
      return handleStyles(env.DB);
    }

    // Everything else: serve static assets (the React SPA)
    return env.ASSETS.fetch(request);
  },
};

async function handleBaseline(db: D1Database): Promise<Response> {
  const row = await db
    .prepare(
      "SELECT * FROM water_baseline ORDER BY date DESC LIMIT 1"
    )
    .first();

  if (!row) {
    return json({ error: "No baseline data found" }, 404);
  }
  return json(row);
}

async function handleStyles(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare("SELECT * FROM beer_styles ORDER BY name ASC")
    .all();

  return json(results);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
