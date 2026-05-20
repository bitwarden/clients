import {
  DialogConfig as CdkDialogConfig,
  DialogRef as CdkDialogRefBase,
  DialogCloseOptions,
} from "@angular/cdk/dialog";
import { ComponentType } from "@angular/cdk/overlay";
import { Portal } from "@angular/cdk/portal";
import { Observable, Subject } from "rxjs";

import { LogService } from "@bitwarden/logging";

export type DialogCloseRef = {
  /** A boolean indicating whether the close succeeded */
  closed: boolean;
};

export abstract class DialogRef<R = unknown, C = unknown> implements Pick<
  CdkDialogRefBase<R, C>,
  "close" | "closed" | "disableClose" | "componentInstance"
> {
  abstract readonly isDrawer?: boolean;

  // --- From CdkDialogRefBase ---
  abstract close(result?: R, options?: DialogCloseOptions): Promise<DialogCloseRef>;
  abstract readonly closed: Observable<R | undefined>;
  abstract disableClose: boolean | undefined;
  /**
   * @deprecated
   * Does not work with drawer dialogs.
   **/
  abstract componentInstance: C | null;

  /**
   * An optional predicate called before closing. Return `true` to allow the close, `false` to
   * prevent it (e.g. to ask the user to confirm discarding unsaved changes). Settable at
   * runtime so a dialog component can gate its own close based on its own state.
   */
  closePredicate?: (result?: R) => Promise<boolean>;
}

export type DialogConfig<D = unknown, R = unknown> = Pick<
  CdkDialogConfig<D, R>,
  | "data"
  | "disableClose"
  | "ariaModal"
  | "positionStrategy"
  | "height"
  | "width"
  | "restoreFocus"
  | "closeOnNavigation"
> & {
  closePredicate?: (result?: R) => Promise<boolean>;
};

/**
 * A reference to an open drawer. Returned by `DialogService.openDrawer()`.
 *
 * Extends `DialogRef` with `stack()`, which pushes a new component onto the drawer stack
 * without closing the current one. The back button appears automatically when the stack
 * depth exceeds one.
 *
 * Can be injected directly inside drawer components alongside (or instead of) `DialogRef`:
 * ```ts
 * private drawerRef = inject(DrawerRef, { optional: true });
 * drawerRef?.stack(ChildComponent, { data: { ... } });
 * ```
 */
export class DrawerRef<R = unknown, C = unknown> implements DialogRef<R, C> {
  readonly isDrawer = true;

  private _closedSubject = new Subject<R | undefined>();
  private _isClosed = false;
  closed = this._closedSubject.asObservable();
  disableClose = false;
  closePredicate?: (result?: R) => Promise<boolean>;

  /** The portal containing the drawer — set by DialogService after construction. */
  portal?: Portal<unknown>;

  constructor(
    /** Called when close() is invoked to notify the owner to handle teardown. */
    private readonly onClose: () => void,
    /** Returns true if this ref is currently on top of the stack. Provided by DialogService. */
    private readonly isTop: () => boolean,
    /** Pushes a new entry onto the stack. Provided by DialogService. */
    private readonly onStack: <SR, SD, SC>(
      component: ComponentType<SC>,
      config?: Omit<DialogConfig<SD, SR>, "closeOnNavigation">,
    ) => DrawerRef<SR, SC>,
    /** Whether to close this drawer when navigating to a different route. Only meaningful on the root ref. */
    readonly closeOnNavigation = false,
    closePredicate?: (result?: R) => Promise<boolean>,
    private readonly logService?: LogService | null,
  ) {
    this.closePredicate = closePredicate;
  }

  /**
   * Push a new component onto the drawer stack without closing the current drawer.
   * The back button will appear automatically when the stack depth exceeds one.
   *
   * `closeOnNavigation` is inherited from the root drawer and cannot be set per-push.
   */
  stack<SR = unknown, SD = unknown, SC = unknown>(
    component: ComponentType<SC>,
    config?: Omit<DialogConfig<SD, SR>, "closeOnNavigation">,
  ): DrawerRef<SR, SC> {
    if (!this.isTop()) {
      throw new Error(
        "DrawerRef.stack() called on a non-top drawer; only the top drawer can stack a child",
      );
    }
    return this.onStack(component, config);
  }

  /** Pop this drawer off the stack, firing the closed observable with the given result. Respects closePredicate. */
  async close(result?: R, _options?: DialogCloseOptions): Promise<DialogCloseRef> {
    if (this._isClosed) {
      return { closed: false };
    }
    if (!this.isTop()) {
      // Only the top drawer in the stack can be closed via its ref. Stacked refs
      // must be closed in LIFO order; closing a buried ref would orphan the refs
      // above it. Use drawerService.closeAll() or close from the top down.
      this.logService?.error(
        "DrawerRef.close() called on a non-top drawer; close from the top of the stack",
      );
      return { closed: false };
    }
    if (this.closePredicate) {
      // Temporarily clear so an async predicate that itself opens a dialog can't re-enter close().
      const predicate = this.closePredicate;
      this.closePredicate = undefined;
      try {
        const canClose = await predicate(result);
        if (!canClose) {
          this.closePredicate = predicate; // Restore — drawer stays open.
          return { closed: false };
        }
      } catch (err) {
        this.logService?.error(err);
      }
    }
    this._isClosed = true;
    this._closedSubject.next(result);
    this._closedSubject.complete();
    this.onClose();
    return { closed: true };
  }

  /**
   * Force-close this drawer, bypassing any closePredicate.
   * Used by DrawerService.closeAll() to tear down the entire stack.
   */
  _forceClose(result?: R): void {
    if (this._isClosed) {
      return;
    }
    this._isClosed = true;
    this._closedSubject.next(result);
    this._closedSubject.complete();
    this.onClose();
  }

  componentInstance: C | null = null;
}

/**
 * DialogRef that delegates functionality to the CDK implementation
 **/
export class CdkDialogRef<R = unknown, C = unknown> implements DialogRef<R, C> {
  readonly isDrawer = false;

  closePredicate?: (result?: R) => Promise<boolean>;

  constructor(
    private readonly logService?: LogService | null,
    closePredicate?: (result?: R) => Promise<boolean>,
  ) {
    this.closePredicate = closePredicate;
  }

  /** This is not available until after construction, @see DialogService.open. */
  cdkDialogRefBase!: CdkDialogRefBase<R, C>;

  // --- Delegated to CdkDialogRefBase ---

  async close(result?: R, options?: DialogCloseOptions): Promise<DialogCloseRef> {
    if (this.closePredicate) {
      try {
        const canClose = await this.closePredicate(result);
        if (!canClose) {
          return { closed: false };
        }
      } catch (err) {
        this.logService?.error(err);
      }
    }
    this.cdkDialogRefBase.close(result, options);
    return { closed: true };
  }

  get closed(): Observable<R | undefined> {
    return this.cdkDialogRefBase.closed;
  }

  get disableClose(): boolean | undefined {
    return this.cdkDialogRefBase.disableClose;
  }
  set disableClose(value: boolean | undefined) {
    this.cdkDialogRefBase.disableClose = value;
  }

  get componentInstance(): C | null {
    return this.cdkDialogRefBase.componentInstance;
  }
}
