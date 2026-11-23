/**
 * Whether this visitor sees people's own models (protocol/05-looks.md, "A model of your own"): the switch, and
 * nothing that draws one. It is theirs, kept on this site, and goes with them from world to world
 * (protocol/11-the-visitors-console.md, "Settings that travel").
 *
 * In a file of its own so that a page that draws no models can hold it: where a client draws the visitor's menu
 * above a world, the switch is the client's row, and the world is told (settings.ts, `changeSettings`).
 * look-models.ts, which draws the models, hands these on under the names they have always had.
 */
import { arrivedSettings, reportSettings } from "./settings.js";

const MODELS_KEY = "nswp:models";
let showing: boolean | null = null;
const modelWatchers = new Set<() => void>();
const keepModels = (on: boolean): void => {
  try {
    if (on) globalThis.localStorage?.removeItem(MODELS_KEY);
    else globalThis.localStorage?.setItem(MODELS_KEY, "off");
  } catch {
    /* for this page only */
  }
};
/** Whether this visitor sees people's own models. On, unless they turned it off here or where they came from: it travels. */
export function showsModels(): boolean {
  if (showing !== null) return showing;
  const came = arrivedSettings().models;
  let kept: string | null = null;
  try {
    kept = globalThis.localStorage?.getItem(MODELS_KEY) ?? null;
  } catch {
    /* nothing kept */
  }
  showing = came ?? kept !== "off";
  if (came !== undefined) keepModels(showing);
  reportSettings("models", () => ({ models: showsModels() }), (now) => void (now.models !== undefined && now.models !== showing && setShowsModels(now.models)));
  return showing;
}
export function setShowsModels(on: boolean): void {
  showsModels();
  showing = on;
  keepModels(on);
  for (const fn of modelWatchers) fn();
}
export function onModelsChange(fn: () => void): () => void {
  modelWatchers.add(fn);
  return () => void modelWatchers.delete(fn);
}
/** For tests: forget the switch, so it is read afresh. */
export function forgetModelsSwitch(): void {
  showing = null;
}
