import { describe, it, expect, beforeEach } from "vitest";
import { prismThemes, getStoredPrismTheme, getThemeBackground } from "../prism-theme-utils";

describe("Prism theme defaults", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("registers no custom-source theme (the removed orange editor theme)", () => {
    expect(
      prismThemes.find((t) => (t as { source?: string }).source === "custom"),
    ).toBeUndefined();
  });

  it("includes the stock Tomorrow Night theme", () => {
    const tomorrow = prismThemes.find((t) => t.value === "prism-tomorrow");
    expect(tomorrow).toBeDefined();
    expect(tomorrow?.background).toBe("#2d2d2d");
  });

  it("defaults to prism-tomorrow when nothing is stored", () => {
    expect(getStoredPrismTheme()).toBe("prism-tomorrow");
  });

  it("reads a stored theme from the rustybin storage key", () => {
    localStorage.setItem("rustybin-prism-theme", "prism-okaidia");
    expect(getStoredPrismTheme()).toBe("prism-okaidia");
  });

  it("getThemeBackground returns the Tomorrow Night background", () => {
    expect(getThemeBackground("prism-tomorrow")).toBe("#2d2d2d");
  });
});
