function getApiBase() {
  // Prefer explicit env var (set for special cases). For normal browser clients we construct
  // the API base from the page's host so requests go to the same server the user loaded the UI from.
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:";
    const host = window.location.hostname;
    return `${protocol}//${host}:3030`;
  }
  return "http://localhost:3030";
}

export const API_BASE = getApiBase();
