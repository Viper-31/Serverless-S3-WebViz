export const SLIDER_SIDEBAR_MIN_WIDTH_PX = 240;
export const SLIDER_SIDEBAR_DEFAULT_VIEWPORT_FRACTION = 0.3;
export const SLIDER_SIDEBAR_MAX_VIEWPORT_FRACTION = 0.35;

export type SidebarState = {
  collapsed: boolean;
  widthPx: number;
  previousWidthPx: number;
};

export function getMaxSidebarWidth(viewportWidth: number): number {
  return Math.floor(
    Math.max(0, viewportWidth) * SLIDER_SIDEBAR_MAX_VIEWPORT_FRACTION,
  );
}

export function getDefaultSidebarWidth(viewportWidth: number): number {
  return clampSidebarWidth(
    Math.floor(
      Math.max(0, viewportWidth) * SLIDER_SIDEBAR_DEFAULT_VIEWPORT_FRACTION,
    ),
    viewportWidth,
  );
}

export function clampSidebarWidth(
  widthPx: number,
  viewportWidth: number,
): number {
  const maxWidthPx = getMaxSidebarWidth(viewportWidth);
  const minWidthPx = Math.min(SLIDER_SIDEBAR_MIN_WIDTH_PX, maxWidthPx);
  return Math.min(Math.max(widthPx, minWidthPx), maxWidthPx);
}

export function collapseSidebar(state: SidebarState): SidebarState {
  return {
    collapsed: true,
    widthPx: state.widthPx,
    previousWidthPx: state.widthPx,
  };
}

export function expandSidebar(
  state: SidebarState,
  viewportWidth: number,
): SidebarState {
  const widthPx = clampSidebarWidth(state.previousWidthPx, viewportWidth);
  return {
    collapsed: false,
    widthPx,
    previousWidthPx: widthPx,
  };
}
