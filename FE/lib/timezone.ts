// The browser's IANA timezone (e.g. "Asia/Ho_Chi_Minh"), sent with study requests so the
// backend files each study day under the user's OWN calendar date for the streak.
//
// It travels as a body field / query param, never a custom header: the backend's CORS
// allows only Authorization and Content-Type, and the frontend and backend deploy
// separately — a new header shipped before the backend allowed it would fail every
// request. Returns undefined when unavailable (SSR, very old browsers); the backend then
// falls back to UTC.
export function browserTimezone(): string | undefined {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === "string" && tz.length > 0 ? tz : undefined;
  } catch {
    return undefined;
  }
}
