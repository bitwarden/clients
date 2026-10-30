import { BrowserApi } from "./browser-api";

export type Point = { left: number; top: number };
export type Rect = Point & { width: number; height: number };
export type ScreenRecord = Rect & { scale: number };

export type PopoutPlacementMemory = {
  creationScale?: number;
  screens: ScreenRecord[];
};

export type PopoutObservation = {
  /** Omitted once the popout has moved, as its position no longer reflects how it was created. */
  requested?: Point;
  window: Rect;
  screen: Rect;
  devicePixelRatio: number;
};

export const POPOUT_PLACEMENT_STORAGE_KEY = "popout-placement";
export const POPOUT_REQUESTED_LEFT_PARAM = "popoutRequestedLeft";
export const POPOUT_REQUESTED_TOP_PARAM = "popoutRequestedTop";
export const POPOUT_OFFSET_RIGHT = 15;

// Small coordinates make the ratio too sensitive to rounding to be trusted.
const MIN_RELIABLE_COORDINATE = 100;
// Windows display scaling ranges from 100% to 500%.
const MIN_CREATION_SCALE = 1;
const MAX_CREATION_SCALE = 5;
const MAX_REMEMBERED_SCREENS = 8;
const SETTLE_TIMEOUT_MS = 500;

/**
 * The scale Firefox used to convert the requested position when creating the window.
 * Firefox reports positions in the window's current scale, so the ratio of reported to
 * requested, times that scale, recovers the scale used at creation.
 */
export function computeCreationScale(
  requested: Point,
  reported: Point,
  devicePixelRatio: number,
): number | undefined {
  const axis = Math.abs(requested.left) >= Math.abs(requested.top) ? "left" : "top";
  if (Math.abs(requested[axis]) < MIN_RELIABLE_COORDINATE) {
    return undefined;
  }
  const scale = Math.round((reported[axis] / requested[axis]) * devicePixelRatio * 100) / 100;
  return isPlausibleCreationScale(scale) ? scale : undefined;
}

export function isInsideScreen(window: Rect, screen: Rect): boolean {
  return (
    window.left >= screen.left &&
    window.top >= screen.top &&
    window.left + window.width <= screen.left + screen.width &&
    window.top + window.height <= screen.top + screen.height
  );
}

export function positionInsideScreen(window: Rect, screen: Rect, marginRight: number): Point {
  return {
    left: Math.max(
      screen.left,
      Math.min(window.left, screen.left + screen.width - window.width - marginRight),
    ),
    top: Math.max(screen.top, Math.min(window.top, screen.top + screen.height - window.height)),
  };
}

/**
 * Pre-scales the requested position so that, once Firefox applies the creation scale,
 * the popout lands where intended on the sender's screen.
 */
export function adjustRequestedPosition(
  requested: Point,
  sender: Rect,
  memory: PopoutPlacementMemory | undefined,
): Point {
  if (memory?.creationScale == null) {
    return requested;
  }
  const { creationScale } = memory;

  const centre = { left: sender.left + sender.width / 2, top: sender.top + sender.height / 2 };
  const screen = memory.screens.find((s) => isInsideScreen({ ...centre, width: 0, height: 0 }, s));
  if (screen == null || screen.scale === creationScale) {
    return requested;
  }

  const factor = screen.scale / creationScale;
  return { left: Math.round(requested.left * factor), top: Math.round(requested.top * factor) };
}

export function recordObservation(
  memory: PopoutPlacementMemory | undefined,
  observation: PopoutObservation,
): PopoutPlacementMemory {
  const creationScale =
    (observation.requested &&
      computeCreationScale(
        observation.requested,
        observation.window,
        observation.devicePixelRatio,
      )) ??
    memory?.creationScale;

  let screens = memory?.screens ?? [];
  // A popout outside its screen sees that screen in the wrong scale.
  if (isInsideScreen(observation.window, observation.screen)) {
    const { left, top, width, height } = observation.screen;
    const record: ScreenRecord = { left, top, width, height, scale: observation.devicePixelRatio };
    screens = [record, ...screens.filter((s) => !sameRect(s, record))].slice(
      0,
      MAX_REMEMBERED_SCREENS,
    );
  }

  return { creationScale, screens };
}

// Callbacks rather than promises: Firefox's `chrome` namespace doesn't return promises in MV2.
export function loadPlacementMemory(): Promise<PopoutPlacementMemory | undefined> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(POPOUT_PLACEMENT_STORAGE_KEY, (result) => {
        resolve(
          chrome.runtime.lastError
            ? undefined
            : parseMemory(result?.[POPOUT_PLACEMENT_STORAGE_KEY]),
        );
      });
    } catch {
      resolve(undefined);
    }
  });
}

export function savePlacementMemory(memory: PopoutPlacementMemory): Promise<void> {
  return new Promise((resolve) =>
    chrome.storage.local.set({ [POPOUT_PLACEMENT_STORAGE_KEY]: memory }, () => resolve()),
  );
}

/**
 * Learns how Firefox placed this popout and pulls it back on-screen if needed. Only acts on
 * popouts that `openPopout` positioned, which it signals through the requested-position params.
 */
export async function ensurePopoutPlacement(win: Window): Promise<void> {
  try {
    const requested = readRequestedPosition(win.location.href);
    if (requested == null) {
      return;
    }
    removeRequestedPosition(win);

    const initial = observe(win, requested);
    let memory = recordObservation(await loadPlacementMemory(), initial);

    const { id } = await BrowserApi.getCurrentWindow();
    if (id != null && !isInsideScreen(initial.window, initial.screen)) {
      await BrowserApi.updateWindowProperties(
        id,
        positionInsideScreen(initial.window, initial.screen, POPOUT_OFFSET_RIGHT),
      );
      // Windows rescales the popout once it reaches the screen, so wait before re-observing.
      await waitForResize(win);
      memory = recordObservation(memory, observe(win));
    }

    await savePlacementMemory(memory);
  } catch {
    // Placement is best effort and must never stop the popup from loading.
  }
}

function readRequestedPosition(href: string): Point | undefined {
  const params = new URL(href).searchParams;
  const left = params.get(POPOUT_REQUESTED_LEFT_PARAM);
  const top = params.get(POPOUT_REQUESTED_TOP_PARAM);
  if (left == null || top == null) {
    return undefined;
  }
  const point = { left: Number(left), top: Number(top) };
  return Number.isFinite(point.left) && Number.isFinite(point.top) ? point : undefined;
}

// Otherwise a reload, e.g. on lock, would be mistaken for a newly created popout.
function removeRequestedPosition(win: Window): void {
  const url = new URL(win.location.href);
  url.searchParams.delete(POPOUT_REQUESTED_LEFT_PARAM);
  url.searchParams.delete(POPOUT_REQUESTED_TOP_PARAM);
  win.history.replaceState(win.history.state, "", url.toString());
}

function observe(win: Window, requested?: Point): PopoutObservation {
  // `availLeft`/`availTop` are non-standard but supported by Firefox.
  const screen = win.screen as Screen & { availLeft: number; availTop: number };
  return {
    requested,
    window: {
      left: win.screenX,
      top: win.screenY,
      width: win.outerWidth,
      height: win.outerHeight,
    },
    screen: {
      left: screen.availLeft,
      top: screen.availTop,
      width: screen.availWidth,
      height: screen.availHeight,
    },
    devicePixelRatio: win.devicePixelRatio,
  };
}

function waitForResize(win: Window): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      win.removeEventListener("resize", done);
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(done, SETTLE_TIMEOUT_MS);
    win.addEventListener("resize", done);
  });
}

function sameRect(a: Rect, b: Rect): boolean {
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

function isPlausibleCreationScale(scale: unknown): scale is number {
  return typeof scale === "number" && scale >= MIN_CREATION_SCALE && scale <= MAX_CREATION_SCALE;
}

function isScreenRecord(value: unknown): value is ScreenRecord {
  const screen = value as Partial<Record<keyof ScreenRecord, unknown>> | null | undefined;
  const numbers = [screen?.left, screen?.top, screen?.width, screen?.height, screen?.scale];
  return (
    numbers.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    (screen?.width as number) > 0 &&
    (screen?.height as number) > 0 &&
    (screen?.scale as number) > 0
  );
}

// Stored data outlives this code, so don't trust its shape.
function parseMemory(value: unknown): PopoutPlacementMemory | undefined {
  const memory = value as { creationScale?: unknown; screens?: unknown } | null | undefined;
  if (!Array.isArray(memory?.screens)) {
    return undefined;
  }
  return {
    creationScale: isPlausibleCreationScale(memory.creationScale)
      ? memory.creationScale
      : undefined,
    screens: memory.screens.filter(isScreenRecord),
  };
}
