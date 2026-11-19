import { afterEach, describe, expect, it } from "vitest";
import { arrivedSettings, arriveWith, currentSettings, reportSettings, resetSettings } from "../src/settings.js";

afterEach(() => resetSettings());

describe("settings that go on with a visitor", () => {
  it("are nothing for someone who arrived with none and has set nothing", () => {
    expect(currentSettings()).toEqual({});
  });

  it("begin as they arrived, cleaned", () => {
    arriveWith({ sound: { music: 0, bass: 9 }, text: 1.2, theme: "dark", mic: true });
    expect(arrivedSettings()).toEqual({ sound: { music: 0 }, text: 1.2 });
    expect(currentSettings()).toEqual({ sound: { music: 0 }, text: 1.2 });
  });

  it("are what each part says they have now, over what they arrived with", () => {
    arriveWith({ sound: { music: 0, effects: 0.7 }, text: 1.2, hand: "right" });
    reportSettings("sound", () => ({ sound: { music: 0.45 } }));
    reportSettings("look", () => ({ text: 1 }));
    // Their hands in a headset: nothing here could show or change them, so they go on as they came.
    expect(currentSettings()).toEqual({ sound: { music: 0.45, effects: 0.7 }, text: 1, hand: "right" });
  });

  it("stop including a part that has gone, and survive one that can't say", () => {
    const stop = reportSettings("screen", () => ({ full: true }));
    reportSettings("broken", () => {
      throw new Error("no");
    });
    expect(currentSettings()).toEqual({ full: true });
    stop();
    expect(currentSettings()).toEqual({});
  });

  it("never let a part say what isn't a setting", () => {
    reportSettings("sly", () => ({ mic: true, sound: { hearShared: true, music: 3 } }) as never);
    expect(currentSettings()).toEqual({ sound: { music: 1 } });
  });
});
