// Runs an async admin action. On failure it alerts the server's message and
// returns { ok: false } so callers can skip their follow-up work.
export async function attempt(fn) {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (e) {
    window.alert(e?.message || "Something went wrong. Please try again.");
    return { ok: false };
  }
}
