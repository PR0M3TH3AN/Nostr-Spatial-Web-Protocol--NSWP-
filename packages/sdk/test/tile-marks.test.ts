import { describe, expect, it } from "vitest";
import { createControls } from "../src/ui/model.js";

/**
 * A tile's mark (a small icon in its corner) and faintness (drawn greyed, still pressable): the Bag's items show the
 * bag when they are in it, and are faint when only offered (docs/backlog/bag-icon-on-items.md).
 */
describe("a tile's mark and faintness, in the controls' view", () => {
  it("are given as the control says, and nothing for a control that says nothing", () => {
    const c = createControls({ title: "A world" });
    let mine = true;
    c.add(
      { id: "a", section: "bag", kind: "tile", label: "A", act: () => {}, mark: () => (mine ? "bag" : null), faint: () => !mine },
      { id: "b", section: "bag", label: "B", act: () => {} },
    );
    const items = () => c.view().sections.find((s) => s.id === "bag")!.items;
    expect(items().map((i) => [i.id, i.mark, i.faint])).toEqual([["a", "bag", false], ["b", null, false]]);
    mine = false;
    expect(items()[0]).toMatchObject({ mark: null, faint: true });
  });
});
