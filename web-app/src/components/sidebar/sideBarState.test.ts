import { describe, expect, it } from "vitest";
import {
  clampSideBarWidth,
  collapseSideBar,
  expandSideBar,
  getDefaultSideBarWidth,
  getMaxSideBarWidth,
} from "@/components/sidebar/sideBarState";

describe("sidebar state", () => {
  it("derives the default width from 30% of the viewport", () => {
    expect(getDefaultSideBarWidth(1200)).toBe(360);
    expect(getDefaultSideBarWidth(800)).toBe(240);
  });

  it("derives the maximum width from 35% of the viewport", () => {
    expect(getMaxSideBarWidth(1200)).toBe(420);
    expect(getMaxSideBarWidth(800)).toBe(280);
  });

  it("clamps sidebar width between the minimum and 35% of the viewport", () => {
    expect(clampSideBarWidth(100, 1200)).toBe(240);
    expect(clampSideBarWidth(500, 1200)).toBe(420);
    expect(clampSideBarWidth(320, 1200)).toBe(320);
  });

  it("preserves the previous width while collapsed and restores it on expand", () => {
    const collapsed = collapseSideBar({
      collapsed: false,
      widthPx: 320,
      previousWidthPx: 280,
    });
    expect(collapsed).toEqual({
      collapsed: true,
      widthPx: 320,
      previousWidthPx: 320,
    });
    expect(expandSideBar(collapsed, 1200)).toEqual({
      collapsed: false,
      widthPx: 320,
      previousWidthPx: 320,
    });
  });
});
