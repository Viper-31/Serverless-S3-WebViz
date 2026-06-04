import { describe, expect, it } from "vitest";
import {
  clampMainSideBarWidth,
  collapseMainSideBar,
  expandMainSideBar,
  getDefaultMainSideBarWidth,
  getMaxMainSideBarWidth,
} from "../mainSideBarState";

describe("main sidebar state", () => {
  it("derives the default width from 30% of the viewport", () => {
    expect(getDefaultMainSideBarWidth(1200)).toBe(360);
    expect(getDefaultMainSideBarWidth(800)).toBe(240);
  });

  it("derives the maximum width from 35% of the viewport", () => {
    expect(getMaxMainSideBarWidth(1200)).toBe(420);
    expect(getMaxMainSideBarWidth(800)).toBe(280);
  });

  it("clamps sidebar width between the minimum and 35% of the viewport", () => {
    expect(clampMainSideBarWidth(100, 1200)).toBe(240);
    expect(clampMainSideBarWidth(500, 1200)).toBe(420);
    expect(clampMainSideBarWidth(320, 1200)).toBe(320);
  });

  it("preserves the previous width while collapsed and restores it on expand", () => {
    const collapsed = collapseMainSideBar({
      collapsed: false,
      widthPx: 320,
      previousWidthPx: 280,
    });
    expect(collapsed).toEqual({
      collapsed: true,
      widthPx: 320,
      previousWidthPx: 320,
    });

    expect(expandMainSideBar(collapsed, 1200)).toEqual({
      collapsed: false,
      widthPx: 320,
      previousWidthPx: 320,
    });
  });
});
