// Client-side helper: next/link auto-applies basePath, but fetch() does not.
// Prefix API calls so they resolve correctly under a sub-path deploy (e.g. /worldcup).
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${p}`;
}
