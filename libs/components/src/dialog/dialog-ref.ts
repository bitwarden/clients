import {
  DialogConfig as CdkDialogConfig,
  DialogRef as CdkDialogRefBase,
  DialogCloseOptions,
} from "@angular/cdk/dialog";
import { ComponentType } from "@angular/cdk/overlay";
import { Portal } from "@angular/cdk/portal";
import { Provider } from "@angular/core";
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

  /**
   * Providers added to the injector the dialog component is created with.
   *
   * Use this so a dialog can declare the services it needs itself, instead of every page that
   * opens it having to provide them. A dialog that reaches for a service which is not
   * `providedIn: "root"` should list it here, typically from its own static `open()`.
   *
   * Note that `@Component({ providers: [...] })` on the *calling* component does not work for
   * this: the dialog's injector is parented to the environment injector `DialogService` was
   * created in, so the caller's node injector is never in the resolution chain.
   *
   * Provide classes directly — `[MyService]`, or `safeProvider(MyService)` — and let Angular read
   * their dependencies from their own `@Injectable` metadata. Do not pass `deps: []` to satisfy
   * the type: Angular treats any `deps` array as authoritative and would construct the service
   * with no dependencies at all.
   *
   * These providers can inject the dialog's own tokens — `DIALOG_DATA`, `DialogRef`, `DrawerRef`.
   *
   * ### Lifetime
   *
   * Each open gets its own instances, and the injector holding them is destroyed when the dialog or
   * drawer closes — after the dialog component itself has been destroyed. Destroying the injector
   * runs `ngOnDestroy` on the instances it actually created, so a service that something injected
   * during the open is destroyed exactly once. A provider listed here that nothing ever injects is
   * never constructed, and therefore never receives `ngOnDestroy` at all. Nothing is destroyed when
   * a `closePredicate` prevents the close, because the dialog is still open.
   *
   * ### Nested dialogs do not inherit them
   *
   * A dialog opened from *inside* this dialog does not see these providers. Every
   * `DialogService.open` builds its injector from the environment injector `DialogService` itself
   * was created in, never from the currently open dialog's injector. A nested dialog that needs the
   * same services must declare them itself, and gets its own instances.
   *
   * ### They win over module and `TestBed` providers
   *
   * These sit closer to the component than any module-level or `TestBed.configureTestingModule`
   * provider, so they shadow them. A test cannot mock one of these services by providing it in the
   * testing module — the dialog would still build the real one. Pass the mock through the dialog
   * config's own `providers` instead, which works because caller entries are merged last and win:
   *
   * ```ts
   * // In the dialog's static open(), so callers can override any of them:
   * providers: [MyService, ...(config.providers ?? [])]
   * ```
   */
  providers?: Provider[];
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

      /**
       * Awaiting the predicate yielded, so everything checked above may since have changed: a
       * second close(), closeAll(), a vault lock, a navigation or a newly stacked child can all
       * have moved this drawer off the top of the stack. Resuming blindly would tear down whatever
       * is on top now instead of this drawer — and would leave that drawer's `closed` observable
       * uncompleted and its providers injector alive with no remaining path to destroy it.
       */
      if (this._isClosed) {
        // Something else already closed this drawer; there is nothing left to do.
        return { closed: false };
      }
      if (!this.isTop()) {
        /**
         * Still open, just no longer on top. Restore the predicate — the pre-await clear is only
         * meant to last for the duration of this call, and dropping it would leave a later
         * legitimate close ungated.
         */
        this.closePredicate = predicate;
        this.logService?.error(
          "DrawerRef.close() resumed on a drawer that is no longer on top; close from the top of the stack",
        );
        return { closed: false };
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
