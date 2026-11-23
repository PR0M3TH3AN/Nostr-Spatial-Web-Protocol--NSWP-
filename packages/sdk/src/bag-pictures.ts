/**
 * The Bag with each thing drawn as itself: `addBagControls` for a page that has the renderer.
 *
 * The Bag's own code (bagging.ts) loads no renderer, so that a client's page can run it (`nswp-sdk/bag`). Drawing a
 * thing from its model does need one. This is the Bag as a world has always had it: where what looks items up can
 * give a model and no pictures were passed, they are made from it here.
 */
import { addBagControls as addBag, type Bagging, type BaggingOptions } from "./bagging.js";
import { createItemPreviews } from "./item-preview.js";
import type { Controls } from "./ui/model.js";

export function addBagControls(controls: Controls, opts: BaggingOptions): Bagging {
  const model = opts.items.model;
  const previews = opts.previews === undefined ? (model ? createItemPreviews({ model: (item, tints) => model(item, tints) }) : null) : opts.previews;
  return addBag(controls, { ...opts, previews });
}
