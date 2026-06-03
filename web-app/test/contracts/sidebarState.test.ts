import { describe, expect, it } from "vitest";
import {
  clampSidebarWidth,
  collapseSidebar,
  expandSidebar,
  getDefaultSidebarWidth,
  getMaxSidebarWidth,
} from "../../src/lib/components/sidebarState";

describe("sidebar state", () => {
  it("derives the default width from 30% of the viewport", () => {
    expect(getDefaultSidebarWidth(1200)).toBe(360);
    expect(getDefaultSidebarWidth(800)).toBe(240);
  });

  it("derives the maximum width from 35% of the viewport", () => {
    expect(getMaxSidebarWidth(1200)).toBe(420);
    expect(getMaxSidebarWidth(800)).toBe(280);
  });

  it("clamps sidebar width between the minimum and 35% of the viewport", () => {
    expect(clampSidebarWidth(100, 1200)).toBe(240);
    expect(clampSidebarWidth(500, 1200)).toBe(420);
    expect(clampSidebarWidth(320, 1200)).toBe(320);
  });

  it("preserves the previous width while collapsed and restores it on expand", () => {
    const collapsed = collapseSidebar({
      collapsed: false,
      widthPx: 320,
      previousWidthPx: 280,
    });
    expect(collapsed).toEqual({
      collapsed: true,
      widthPx: 320,
      previousWidthPx: 320,
    });

    expect(expandSidebar(collapsed, 1200)).toEqual({
      collapsed: false,
      widthPx: 320,
      previousWidthPx: 320,
    });
  });
});
