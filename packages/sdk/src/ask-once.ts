/**
 * Whether a one-time question about how a visitor moves may be put to them now (fps.ts, input.ts). Never to a
 * browser driven by a script, so that a test of anything else isn't a test of this; `?ask=moving` on the page's
 * address asks all the same, which is how it is looked at.
 */
export function mayAskHowTheyMove(): boolean {
  try {
    if (new URLSearchParams(globalThis.location?.search ?? "").get("ask") === "moving") return true;
    return !globalThis.navigator?.webdriver;
  } catch {
    return false;
  }
}
