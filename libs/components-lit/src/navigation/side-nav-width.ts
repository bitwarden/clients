/** Width of the collapsed nav (icon strip / side rail), in rem. */
export const SIDERAIL_WIDTH_REM = 4;

/** Bounds the saved width is always held within, in rem. Excludes container-dependent limits. */
export const SIDE_NAV_WIDTH_BOUNDS = Object.freeze({
  min: 15, // 240px
  max: 37.5, // 600px
  default: 18.5, // 296px
});

/** Get computed root font size to support user-defined a11y font increases. */
export function getRootFontSizePx(): number {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

export const remToPx = (rem: number, rootFontSizePx: number) => rem * rootFontSizePx;
export const pxToRem = (px: number, rootFontSizePx: number) => px / rootFontSizePx;

/**
 * Where the user's chosen side nav width is persisted. Replaces Angular's `GlobalStateProvider`
 * key so apps can plug in their own state layer.
 */
export interface SideNavWidthStorage {
  load(): number | null | undefined | Promise<number | null | undefined>;
  save(width: number): void | Promise<void>;
}

/** Persists the width in `localStorage` under `key`. */
export function localStorageSideNavWidth(key = "bit-side-nav-width"): SideNavWidthStorage {
  return {
    load() {
      try {
        const value = localStorage.getItem(key);
        return value == null ? null : Number(value);
      } catch {
        return null;
      }
    },
    save(width) {
      try {
        localStorage.setItem(key, String(width));
      } catch {
        // Storage may be unavailable (privacy mode); the width then lasts for the session only.
      }
    },
  };
}

/**
 * The side nav width store: the current painted width, the width the user chose, the bounds both
 * are held within, and persistence.
 *
 * The width the user chose and the width currently painted are deliberately different things: a
 * drag preview, or a width narrowed to fit the container, must never become the user's preference.
 * Callers therefore have to pick a verb — `display` paints only, `commit` paints and remembers.
 * A commit also outranks a storage read that resolves after it.
 *
 * This class knows nothing about gestures, open/closed state, or push/overlay mode — those belong
 * to `SideNavState`, which decides which verb to call.
 */
export class SideNavWidthStore {
  private _width: number = SIDE_NAV_WIDTH_BOUNDS.default;
  private _hydrated = false;
  private _savedWidth: number = SIDE_NAV_WIDTH_BOUNDS.default;
  private hydrating = false;
  private saveTimer?: ReturnType<typeof setTimeout>;

  /** Set once the user commits a width, so a late storage read cannot overwrite their choice. */
  private _userCommitted = false;

  constructor(
    private storage: SideNavWidthStorage | null,
    private readonly onChange: () => void,
  ) {}

  /** The committed width to paint, in rem. */
  get width() {
    return this._width;
  }

  /** True once the saved width has been read, so callers can gate first-paint behavior. */
  get hydrated() {
    return this._hydrated;
  }

  setStorage(storage: SideNavWidthStorage | null) {
    this.storage = storage;
  }

  /** Read the saved width once and adopt it. Out-of-bounds values are repaired and written back. */
  hydrate() {
    if (this.hydrating) {
      return;
    }
    this.hydrating = true;
    void Promise.resolve(this.storage?.load())
      .catch(() => null)
      .then((stored) => {
        const diskWidth =
          typeof stored === "number" && Number.isFinite(stored)
            ? stored
            : SIDE_NAV_WIDTH_BOUNDS.default;
        this._hydrated = true;

        // A width the user committed while the read was in flight outranks the stored one, and
        // repairing a value they have already superseded would write a width nobody asked for.
        if (this._userCommitted) {
          this.onChange();
          return;
        }

        const repaired = this.clamp(diskWidth);
        this._savedWidth = repaired;
        this._width = repaired;
        if (repaired !== diskWidth && stored != null) {
          this.scheduleSave(repaired);
        }
        this.onChange();
      });
  }

  /** Paint `width` without changing what the user gets next time. */
  display(width: number) {
    if (width !== this._width) {
      this._width = width;
      this.onChange();
    }
  }

  /** Paint `width` and remember it as the user's preference. */
  commit(width: number) {
    const clamped = this.clamp(width);
    const shouldPersist = clamped !== this._savedWidth;

    this._userCommitted = true;
    this._savedWidth = clamped;
    this._width = clamped;
    this.onChange();

    if (shouldPersist) {
      this.scheduleSave(clamped);
    }
  }

  /** The width the user chose, always within bounds. Never narrowed to fit the container. */
  saved() {
    return this._savedWidth;
  }

  /** Hold `width` within the saved-width bounds. */
  clamp(width: number) {
    return Math.min(Math.max(width, SIDE_NAV_WIDTH_BOUNDS.min), SIDE_NAV_WIDTH_BOUNDS.max);
  }

  // Drags already persist only on release. The debounce is for the keyboard path: arrow-key
  // autorepeat fires keydown ~30x/sec and every step is a commit.
  private scheduleSave(width: number) {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.storage?.save(width), 200);
  }
}
