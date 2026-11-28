import { createContext } from "@lit/context";
import { TemplateResult } from "lit";

export type DialogCloseResult = {
  /** Whether the close succeeded (a `closePredicate` may veto it). */
  closed: boolean;
};

type DialogRefInit<R, D> = {
  data: D;
  disableClose?: boolean;
  closePredicate?: (result?: R) => Promise<boolean>;
  onClose: (result?: R) => void;
};

/**
 * Handle to an open dialog or drawer. Content elements receive it as their `dialogRef` property and
 * descendants can request it with `dialogRefContext`.
 *
 * @fires change - `disableClose` or `label` changed.
 */
export class DialogRef<R = unknown, D = unknown> extends EventTarget {
  readonly isDrawer: boolean = false;

  /** The `data` passed to `openDialog`, replacing `DIALOG_DATA`. */
  readonly data: D;

  /**
   * Called before closing. Resolve `false` to keep the dialog open, e.g. to confirm discarding
   * unsaved changes. Settable at runtime.
   */
  closePredicate?: (result?: R) => Promise<boolean>;

  /** Resolves with the result once the dialog has closed. */
  readonly closed: Promise<R | undefined>;

  /** The mounted content element, replacing `componentInstance`. */
  content?: HTMLElement;

  private _disableClose: boolean;
  private _label = "";
  private _isClosed = false;
  private resolveClosed!: (result?: R) => void;
  private readonly onClose: (result?: R) => void;

  /** @internal Use `openDialog` or `openDrawer`. */
  constructor(init: DialogRefInit<R, D>) {
    super();
    this.data = init.data;
    this._disableClose = init.disableClose ?? false;
    this.closePredicate = init.closePredicate;
    this.onClose = init.onClose;
    this.closed = new Promise((resolve) => (this.resolveClosed = resolve));
  }

  /** Blocks Escape, backdrop clicks, the close button and `data-bit-dialog-close` elements. */
  get disableClose() {
    return this._disableClose;
  }
  set disableClose(value: boolean) {
    this._disableClose = value;
    this.dispatchEvent(new Event("change"));
  }

  /** Accessible name of the dialog; set by `bit-dialog` / `bit-simple-dialog` from their title. */
  get label() {
    return this._label;
  }
  set label(value: string) {
    if (value !== this._label) {
      this._label = value;
      this.dispatchEvent(new Event("change"));
    }
  }

  get isClosed() {
    return this._isClosed;
  }

  /** Closes the dialog, unless `closePredicate` vetoes it. Ignores `disableClose`. */
  async close(result?: R): Promise<DialogCloseResult> {
    if (this._isClosed) {
      return { closed: false };
    }
    if (this.closePredicate) {
      // Cleared while pending, so a predicate that opens its own dialog can't re-enter close().
      const predicate = this.closePredicate;
      this.closePredicate = undefined;
      try {
        if (!(await predicate(result))) {
          this.closePredicate = predicate;
          return { closed: false };
        }
      } catch (error) {
        // eslint-disable-next-line no-console -- matches DialogService's LogService fallback
        console.error(error);
      }
    }
    this._forceClose(result);
    return { closed: true };
  }

  /** @internal Closes without consulting `closePredicate`. */
  _forceClose(result?: R) {
    if (this._isClosed) {
      return;
    }
    this._isClosed = true;
    this.onClose(result);
    this.resolveClosed(result);
  }
}

/**
 * A drawer opened with `openDrawer`. `stack()` pushes another drawer without closing this one; a
 * back button appears when the stack is deeper than one.
 */
export class DrawerRef<R = unknown, D = unknown> extends DialogRef<R, D> {
  override readonly isDrawer = true;

  /** Whether to close the stack when the route changes. Only meaningful on the root drawer. */
  readonly closeOnNavigation: boolean;

  private readonly isTop: () => boolean;
  private readonly onStack: DrawerStackFn;

  /** @internal */
  constructor(
    init: DialogRefInit<R, D> & {
      isTop: () => boolean;
      stack: DrawerStackFn;
      closeOnNavigation?: boolean;
    },
  ) {
    super(init);
    this.isTop = init.isTop;
    this.onStack = init.stack;
    this.closeOnNavigation = init.closeOnNavigation ?? false;
  }

  /** Pushes a drawer on top of this one. Only the top drawer can stack. */
  stack<SR = unknown, SD = unknown>(
    content: DialogContent<SR, SD>,
    config?: Omit<DialogConfig<SD, SR>, "closeOnNavigation" | "position" | "ariaModal">,
  ): DrawerRef<SR, SD> {
    if (!this.isTop()) {
      throw new Error(
        "DrawerRef.stack() called on a non-top drawer; only the top drawer can stack",
      );
    }
    return this.onStack(content, config) as DrawerRef<SR, SD>;
  }

  /** Pops this drawer. Drawers close top-down; closing a buried drawer is refused. */
  override async close(result?: R): Promise<DialogCloseResult> {
    if (this.isClosed) {
      return { closed: false };
    }
    if (!this.isTop()) {
      // eslint-disable-next-line no-console -- matches DrawerRef's LogService fallback
      console.error(
        "DrawerRef.close() called on a non-top drawer; close from the top of the stack",
      );
      return { closed: false };
    }
    return super.close(result);
  }
}

type DrawerStackFn = (
  content: DialogContent<any, any>,
  config?: Omit<DialogConfig<any, any>, "closeOnNavigation" | "position" | "ariaModal">,
) => DrawerRef<any, any>;

/**
 * What to show in a dialog:
 * - an element (receives `dialogRef` and `data` properties if it's a custom element),
 * - a custom element tag name,
 * - a Lit template,
 * - or a function of the ref returning either, e.g. `(ref) => html\`…${ref.data.name}…\``.
 */
export type DialogContent<R = unknown, D = unknown> =
  string | HTMLElement | TemplateResult | ((ref: DialogRef<R, D>) => HTMLElement | TemplateResult);

export type DialogConfig<D = unknown, R = unknown> = {
  data?: D;
  /** Block Escape, backdrop clicks and the close button. */
  disableClose?: boolean;
  /** Replaces `positionStrategy`: `"responsive"` (default) is a bottom sheet below `md`; `"center"` always centers. */
  position?: "responsive" | "center";
  /** Defaults to true. */
  ariaModal?: boolean;
  /** CSS width of the dialog pane. */
  width?: string;
  /** CSS height of the dialog pane. */
  height?: string;
  /** Where focus returns on close. Defaults to the element focused when the dialog opened. */
  restoreFocus?: boolean | HTMLElement;
  /** Close on history navigation (`popstate`/`hashchange`). Dialogs default to true, drawers to false. */
  closeOnNavigation?: boolean;
  closePredicate?: (result?: R) => Promise<boolean>;
};

/** Provided by dialog and drawer hosts to their content. */
export const dialogRefContext = createContext<DialogRef<any, any> | undefined>(
  Symbol("bit-dialog-ref"),
);

/** Implemented by dialog content that knows where focus should land when nothing has `autofocus`. */
export interface AutofocusFallbackHost {
  autofocusFallback(): HTMLElement | null | undefined;
}
