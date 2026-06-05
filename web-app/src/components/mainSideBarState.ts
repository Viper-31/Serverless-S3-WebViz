const MAIN_SIDEBAR_MIN_WIDTH_PX = 240;
const MAIN_SIDEBAR_DEFAULT_VIEWPORT_FRACTION = 0.3;
const MAIN_SIDEBAR_MAX_VIEWPORT_FRACTION = 0.35;

export type MainSideBarState = {
  collapsed: boolean;
  widthPx: number;
  previousWidthPx: number;
};

export function getMaxMainSideBarWidth(viewportWidth: number): number {
  return Math.floor(
    Math.max(0, viewportWidth) * MAIN_SIDEBAR_MAX_VIEWPORT_FRACTION,
  );
}

export function getDefaultMainSideBarWidth(viewportWidth: number): number {
  return clampMainSideBarWidth(
    Math.floor(
      Math.max(0, viewportWidth) * MAIN_SIDEBAR_DEFAULT_VIEWPORT_FRACTION,
    ),
    viewportWidth,
  );
}

export function clampMainSideBarWidth(
  widthPx: number,
  viewportWidth: number,
): number {
  const maxWidthPx = getMaxMainSideBarWidth(viewportWidth);
  const minWidthPx = Math.min(MAIN_SIDEBAR_MIN_WIDTH_PX, maxWidthPx);
  return Math.min(Math.max(widthPx, minWidthPx), maxWidthPx);
}

export function collapseMainSideBar(state: MainSideBarState): MainSideBarState {
  return {
    collapsed: true,
    widthPx: state.widthPx,
    previousWidthPx: state.widthPx,
  };
}

export function expandMainSideBar(
  state: MainSideBarState,
  viewportWidth: number,
): MainSideBarState {
  const widthPx = clampMainSideBarWidth(state.previousWidthPx, viewportWidth);
  return {
    collapsed: false,
    widthPx,
    previousWidthPx: widthPx,
  };
}
