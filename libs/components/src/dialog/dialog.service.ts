import {
  Dialog as CdkDialog,
  DialogConfig as CdkDialogConfig,
  DialogRef as CdkDialogRefBase,
  DIALOG_DATA,
  DialogCloseOptions,
} from "@angular/cdk/dialog";
import { ComponentType, GlobalPositionStrategy, ScrollStrategy } from "@angular/cdk/overlay";
import { ComponentPortal, Portal } from "@angular/cdk/portal";
import { Injectable, Injector, TemplateRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import {
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  startWith,
  Subject,
  switchMap,
  take,
} from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import { isAtOrLargerThanBreakpoint } from "../utils/responsive-utils";

import { DrawerService } from "./drawer.service";
import { SimpleConfigurableDialogComponent } from "./simple-dialog/simple-configurable-dialog/simple-configurable-dialog.component";
import { SimpleDialogOptions } from "./simple-dialog/types";

/**
 * The default `BlockScrollStrategy` does not work well with virtual scrolling.
 *
 * https://github.com/angular/components/issues/7390
 */
class CustomBlockScrollStrategy implements ScrollStrategy {
  enable() {
    document.body.classList.add("tw-overflow-hidden");
  }

  disable() {
    document.body.classList.remove("tw-overflow-hidden");
  }

  /** Noop */
  attach() {}

  /** Noop */
  detach() {}
}

export type BeforeCloseEvent<R = unknown> = {
  /** The result passed to close() */
  result: R | undefined;
  /** Call this synchronously to prevent the close */
  cancel(): void;
};

export abstract class DialogRef<R = unknown, C = unknown> implements Pick<
  CdkDialogRef<R, C>,
  "closed" | "disableClose" | "componentInstance"
> {
  abstract readonly isDrawer?: boolean;

  // --- From CdkDialogRef ---
  abstract close(result?: R, options?: DialogCloseOptions): DialogCloseRef;
  abstract readonly closed: Observable<R | undefined>;
  abstract disableClose: boolean | undefined;
  /**
   * @deprecated
   * Does not work with drawer dialogs.
   **/
  abstract componentInstance: C | null;

  /**
   * Emits before the dialog closes. Subscribers may call event.cancel() to prevent the close.
   */
  abstract readonly beforeClose$: Observable<BeforeCloseEvent<R>>;
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
>;

export type DialogCloseRef = {
  /** A boolean indicating whether the close succeeded */
  closed: boolean;
};

/**
 * A responsive position strategy that adjusts the dialog position based on the screen size.
 */
class ResponsivePositionStrategy extends GlobalPositionStrategy {
  private abortController: AbortController | null = null;

  /**
   * The previous breakpoint to avoid unnecessary updates.
   * `null` means no previous breakpoint has been set.
   */
  private prevBreakpoint: "small" | "large" | null = null;

  constructor() {
    super();
    if (typeof window !== "undefined") {
      this.abortController = new AbortController();
      this.updatePosition(); // Initial position update
      window.addEventListener("resize", this.updatePosition.bind(this), {
        signal: this.abortController.signal,
      });
    }
  }

  override dispose() {
    this.abortController?.abort();
    this.abortController = null;
    super.dispose();
  }

  updatePosition() {
    const isSmallScreen = !isAtOrLargerThanBreakpoint("md");
    const currentBreakpoint = isSmallScreen ? "small" : "large";
    if (this.prevBreakpoint === currentBreakpoint) {
      return; // No change in breakpoint, no need to update position
    }
    this.prevBreakpoint = currentBreakpoint;
    if (isSmallScreen) {
      this.bottom().centerHorizontally();
    } else {
      this.centerVertically().centerHorizontally();
    }
    this.apply();
  }
}

/**
 * Position strategy that centers dialogs regardless of screen size.
 * Use this for simple dialogs and custom dialogs that should not use
 * the responsive bottom-sheet behavior on mobile.
 *
 * @example
 * dialogService.open(MyComponent, {
 *   positionStrategy: new CenterPositionStrategy()
 * });
 */
export class CenterPositionStrategy extends GlobalPositionStrategy {
  constructor() {
    super();
    this.centerHorizontally().centerVertically();
  }
}

class DrawerDialogRef<R = unknown, C = unknown> implements DialogRef<R, C> {
  readonly isDrawer = true;

  private readonly _beforeClose$ = new Subject<BeforeCloseEvent<R>>();
  readonly beforeClose$ = this._beforeClose$.asObservable();

  private _closed = new Subject<R | undefined>();
  closed = this._closed.asObservable();
  disableClose = false;

  /** The portal containing the drawer */
  portal?: Portal<unknown>;

  constructor(
    private drawerService: DrawerService,
    readonly config?: DialogConfig<unknown, R>,
  ) {}

  close(result?: R, _options?: DialogCloseOptions): DialogCloseRef {
    if (this.disableClose && result === undefined) {
      return { closed: false };
    }

    let cancelled = false;
    this._beforeClose$.next({
      result,
      cancel: () => {
        cancelled = true;
      },
    });
    if (cancelled) {
      return { closed: false };
    }

    this.drawerService.close(this.portal!);
    this._closed.next(result);
    this._closed.complete();
    return { closed: true };
  }

  componentInstance: C | null = null;
}

/**
 * DialogRef that delegates functionality to the CDK implementation
 **/
export class CdkDialogRef<R = unknown, C = unknown> implements DialogRef<R, C> {
  readonly isDrawer = false;

  private readonly _beforeClose$ = new Subject<BeforeCloseEvent<R>>();
  readonly beforeClose$ = this._beforeClose$.asObservable();

  /**
   * Tracked independently from cdkDialogRefBase.disableClose because we always
   * set disableClose: true on the CDK level to intercept backdrop/Escape ourselves.
   */
  disableClose: boolean | undefined = undefined;

  constructor() {}

  /** This is not available until after construction, @see DialogService.open. */
  cdkDialogRefBase!: CdkDialogRefBase<R, C>;

  // --- Delegated to CdkDialogRefBase ---

  close(result?: R, options?: DialogCloseOptions): DialogCloseRef {
    if (this.disableClose && result === undefined) {
      return { closed: false };
    }

    let cancelled = false;
    this._beforeClose$.next({
      result,
      cancel: () => {
        cancelled = true;
      },
    });
    if (cancelled) {
      return { closed: false };
    }

    this.cdkDialogRefBase.close(result, options);
    return { closed: true };
  }

  get closed(): Observable<R | undefined> {
    return this.cdkDialogRefBase.closed;
  }

  // Delegate the `componentInstance` property to the CDK DialogRef
  get componentInstance(): C | null {
    return this.cdkDialogRefBase.componentInstance;
  }
}

@Injectable()
export class DialogService {
  private dialog = inject(CdkDialog);
  private drawerService = inject(DrawerService);
  private injector = inject(Injector);
  private router = inject(Router);
  private authService = inject(AuthService, { optional: true });

  private backDropClasses = ["tw-fixed", "tw-bg-bg-overlay", "tw-inset-0"];
  private defaultScrollStrategy = new CustomBlockScrollStrategy();
  private activeDrawer: DrawerDialogRef<any, any> | null = null;

  constructor() {
    /**
     * TODO: This logic should exist outside of `libs/components`.
     * @see https://bitwarden.atlassian.net/browse/CL-657
     **/
    /** Close all open dialogs if the vault locks */
    if (this.router && this.authService) {
      this.router.events
        .pipe(
          filter((event) => event instanceof NavigationEnd),
          switchMap(() => this.authService!.getAuthStatus()),
          filter((v) => v !== AuthenticationStatus.Unlocked),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.closeAll());
    }

    /**
     * Close the active drawer on route navigation if configured.
     * Note: CDK dialogs have their own `closeOnNavigation` config option,
     * but drawers use a custom implementation that requires manual cleanup.
     */
    if (this.router) {
      this.router.events
        .pipe(
          filter((event): event is NavigationEnd => event instanceof NavigationEnd),
          map((event) => event.urlAfterRedirects.split("?")[0]),
          startWith(this.router.url.split("?")[0]),
          distinctUntilChanged(),
          filter(() => this.activeDrawer?.config?.closeOnNavigation === true),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.closeDrawer());
    }
  }

  open<R = unknown, D = unknown, C = unknown>(
    componentOrTemplateRef: ComponentType<C> | TemplateRef<C>,
    config?: DialogConfig<D, R>,
  ): DialogRef<R, C> {
    /**
     * This is a bit circular in nature:
     * We need the DialogRef instance for the DI injector that is passed *to* `Dialog.open`,
     * but we get the base CDK DialogRef instance *from* `Dialog.open`.
     *
     * To break the circle, we define CDKDialogRef as a wrapper for the CDKDialogRefBase.
     * This allows us to create the class instance and provide the base instance later, almost like "deferred inheritance".
     **/
    const ref = new CdkDialogRef<R, C>();
    ref.disableClose = config?.disableClose;
    const injector = this.createInjector({
      data: config?.data,
      dialogRef: ref,
    });

    // Merge the custom config with the default config.
    // We always set disableClose: true on the CDK level so the CDK never closes the dialog
    // itself via backdrop click or Escape. We intercept those events below and route them
    // through our close() so beforeClose$ always fires. When disableClose is true, the CDK
    // suppresses the events and our close() returns early, preserving the same behaviour.
    const _config = {
      backdropClass: this.backDropClasses,
      scrollStrategy: this.defaultScrollStrategy,
      positionStrategy: config?.positionStrategy ?? new ResponsivePositionStrategy(),
      closeOnNavigation: config?.closeOnNavigation,
      injector,
      ...config,
      disableClose: true,
    };

    ref.cdkDialogRefBase = this.dialog.open<R, D, C>(componentOrTemplateRef, _config);

    // Only intercept backdrop clicks when disableClose is falsy. When true, CDK already
    // suppresses backdrop clicks natively via the disableClose: true config above.
    if (!ref.disableClose) {
      ref.cdkDialogRefBase.backdropClick.subscribe(() => {
        ref.close();
      });
    }

    if (config?.restoreFocus === undefined) {
      this.setRestoreFocusEl<R, C>(ref);
    }

    return ref;
  }

  /** Opens a dialog in the side drawer. Returns `undefined` if a `beforeClose$` subscriber
   * prevented the current drawer from closing, otherwise a DialogRef for the newly opened drawer. */
  openDrawer<R = unknown, D = unknown, C = unknown>(
    component: ComponentType<C>,
    config?: DialogConfig<D, R>,
  ): DialogRef<R, C> | undefined {
    const closeResult = this.activeDrawer?.close();
    // We only want to abort here if we have an active drawer that has failed to close. We
    // specifically check for false instead of falsy values to avoid false (ha) positives.
    if (closeResult?.closed === false) {
      return;
    }
    /**
     * This is also circular. When creating the DrawerDialogRef, we do not yet have a portal instance to provide to the injector.
     * Similar to `this.open`, we get around this with mutability.
     */
    this.activeDrawer = new DrawerDialogRef(this.drawerService, config);
    const portal = new ComponentPortal(
      component,
      null,
      this.createInjector({ data: config?.data, dialogRef: this.activeDrawer }),
    );
    this.activeDrawer.portal = portal;
    this.activeDrawer.closed.subscribe({
      complete: () => {
        this.activeDrawer = null;
      },
    });
    this.drawerService.open(portal);
    return this.activeDrawer;
  }

  /**
   * Opens a simple dialog, returns true if the user accepted the dialog.
   *
   * @param {SimpleDialogOptions} simpleDialogOptions - An object containing options for the dialog.
   * @returns `boolean` - True if the user accepted the dialog, false otherwise.
   */
  openSimpleDialog(simpleDialogOptions: SimpleDialogOptions): Promise<boolean> {
    const dialogRef = this.openSimpleDialogRef(simpleDialogOptions);
    return firstValueFrom(dialogRef.closed.pipe(map((v: boolean | undefined) => !!v)));
  }

  /**
   * Opens a simple dialog.
   *
   * You should probably use `openSimpleDialog` instead, unless you need to programmatically close the dialog.
   *
   * @param {SimpleDialogOptions} simpleDialogOptions - An object containing options for the dialog.
   * @returns `DialogRef` - The reference to the opened dialog.
   * Contains a closed observable which can be subscribed to for determining which button
   * a user pressed
   */
  openSimpleDialogRef(simpleDialogOptions: SimpleDialogOptions): DialogRef<boolean> {
    return this.open<boolean, SimpleDialogOptions>(SimpleConfigurableDialogComponent, {
      data: simpleDialogOptions,
      disableClose: simpleDialogOptions.disableClose,
      positionStrategy: new CenterPositionStrategy(),
    });
  }

  /** Close all open dialogs. Note that this will ignore any and all beforeClose$ subscribers */
  closeAll(): void {
    return this.dialog.closeAll();
  }

  /** Close the open drawer */
  closeDrawer(): DialogCloseRef {
    return this.activeDrawer?.close() ?? { closed: true };
  }

  /**
   * Configure the dialog to return focus to the previous active element upon closing.
   * @param ref CdkDialogRef
   *
   * The cdk dialog already has the optional directive `cdkTrapFocusAutoCapture` to capture the
   * current active element and return focus to it upon close. However, it does not have a way to
   * delay the capture of the element. We need this delay in some situations, where the active
   * element may be changing as the dialog is opening, and we want to wait for that to settle.
   *
   * For example -- the menu component often contains menu items that open dialogs. When the dialog
   * opens, the menu is closing and is setting focus back to the menu trigger since the menu item no
   * longer exists. We want to capture the menu trigger as the active element, not the about-to-be-
   * nonexistent menu item. If we wait a tick, we can let the menu finish that focus move.
   */
  private setRestoreFocusEl<R = unknown, C = unknown>(ref: CdkDialogRef<R, C>) {
    /**
     * First, capture the current active el with no delay so that we can support normal use cases
     * where we are not doing manual focus management
     */
    const activeEl = document.activeElement;

    const restoreFocusTimeout = setTimeout(() => {
      let restoreFocusEl = activeEl;

      /**
       * If the original active element is no longer connected, it's because we purposely removed it
       * from the DOM and have moved focus. Select the new active element instead.
       */
      if (!restoreFocusEl?.isConnected) {
        restoreFocusEl = document.activeElement;
      }

      if (restoreFocusEl instanceof HTMLElement) {
        ref.cdkDialogRefBase.config.restoreFocus = restoreFocusEl;
      }
    }, 0);

    ref.closed.pipe(take(1)).subscribe(() => {
      clearTimeout(restoreFocusTimeout);
    });
  }

  /** The injector that is passed to the opened dialog */
  private createInjector(opts: { data: unknown; dialogRef: DialogRef }): Injector {
    return Injector.create({
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: opts.data,
        },
        {
          provide: DialogRef,
          useValue: opts.dialogRef,
        },
        {
          provide: CdkDialogRefBase,
          useValue: opts.dialogRef,
        },
      ],
      parent: this.injector,
    });
  }
}
