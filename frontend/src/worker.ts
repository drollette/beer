/**
 * Frontend Worker
 *
 * Serves the React SPA via Cloudflare Assets and exposes API endpoints
 * that return default data from environment variables.
 */

interface Env {
  DEFAULT_BASELINE: string;
  DEFAULT_STYLES: string;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/baseline") {
      return json(JSON.parse(env.DEFAULT_BASELINE));
    }
    if (url.pathname === "/api/styles") {
      return json(JSON.parse(env.DEFAULT_STYLES));
    }

    // Everything else: serve static assets (the React SPA)
    return env.ASSETS.fetch(request);
  },
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
