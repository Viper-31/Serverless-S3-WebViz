import { describe, expect, it } from "vitest";
import {
  clampSidebarWidth,
  collapseSidebar,
  expandSidebar,
  resizeSidebarWidth,
} from "../../src/lib/components/sidebarState";

describe("sidebar state", () => {
  it("clamps sidebar width between the minimum and 30% of the viewport", () => {
    expect(clampSidebarWidth(100, 1200)).toBe(240);
    expect(clampSidebarWidth(500, 1200)).toBe(360);
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

  it("applies drag delta before clamping resized width", () => {
    expect(resizeSidebarWidth(300, 40, 1200)).toBe(340);
    expect(resizeSidebarWidth(350, 40, 1200)).toBe(360);
    expect(resizeSidebarWidth(260, -40, 1200)).toBe(240);
  });
});
