function getApiBase() {
  // Prefer explicit env var (set for special cases). For normal browser clients we construct
  // requests go to the same origin the user loaded the UI from.
  //
  // Important: constructing a protocol+port URL from window.location breaks when the UI
  // is served behind HTTPS (or a reverse proxy) but the bot API is plain HTTP.
  // Defaulting to same-origin allows Next.js rewrites to proxy /api/* to the bot service.
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  return "";
}

export const API_BASE = getApiBase();
