const SIDE_BAR_MIN_WIDTH_PX = 240;
const SIDE_BAR_DEFAULT_VIEWPORT_FRACTION = 0.3;
const SIDE_BAR_MAX_VIEWPORT_FRACTION = 0.35;

export type SideBarState = {
  collapsed: boolean;
  widthPx: number;
  previousWidthPx: number;
};

export function getMaxSideBarWidth(viewportWidth: number): number {
  return Math.floor(
    Math.max(0, viewportWidth) * SIDE_BAR_MAX_VIEWPORT_FRACTION,
  );
}

export function getDefaultSideBarWidth(viewportWidth: number): number {
  return clampSideBarWidth(
    Math.floor(Math.max(0, viewportWidth) * SIDE_BAR_DEFAULT_VIEWPORT_FRACTION),
    viewportWidth,
  );
}

export function clampSideBarWidth(
  widthPx: number,
  viewportWidth: number,
): number {
  const maxWidthPx = getMaxSideBarWidth(viewportWidth);
  const minWidthPx = Math.min(SIDE_BAR_MIN_WIDTH_PX, maxWidthPx);
  return Math.min(Math.max(widthPx, minWidthPx), maxWidthPx);
}

export function collapseSideBar(state: SideBarState): SideBarState {
  return {
    collapsed: true,
    widthPx: state.widthPx,
    previousWidthPx: state.widthPx,
  };
}

export function expandSideBar(
  state: SideBarState,
  viewportWidth: number,
): SideBarState {
  const widthPx = clampSideBarWidth(state.previousWidthPx, viewportWidth);
  return { collapsed: false, widthPx, previousWidthPx: widthPx };
}
