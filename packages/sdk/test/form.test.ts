import { describe, expect, it } from "vitest";
import { formFor, type DeviceForms } from "../src/form.js";

const phone: DeviceForms = { touch: true, mouse: false, main: "touch" };
const desktop: DeviceForms = { touch: false, mouse: true, main: "desk" };
const touchLaptop: DeviceForms = { touch: true, mouse: true, main: "desk" };
const tabletWithKeys: DeviceForms = { touch: true, mouse: true, main: "touch" };

describe("the form a visitor starts in", () => {
  it("is the device's own when nothing is said", () => {
    expect(formFor(undefined, phone)).toBe("touch");
    expect(formFor(undefined, desktop)).toBe("desk");
    expect(formFor(undefined, touchLaptop)).toBe("desk");
    expect(formFor(undefined, tabletWithKeys)).toBe("touch");
  });

  it("is the one they were in, on a device that can do both", () => {
    expect(formFor("touch", touchLaptop)).toBe("touch");
    expect(formFor("desk", tabletWithKeys)).toBe("desk");
    expect(formFor("desk", touchLaptop)).toBe("desk");
  });

  it("is never one the device can't do, whatever a link says", () => {
    expect(formFor("desk", phone)).toBe("touch");
    expect(formFor("touch", desktop)).toBe("desk");
    expect(formFor("hologram" as never, phone)).toBe("touch");
  });
});
