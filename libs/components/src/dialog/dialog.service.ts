import {
  Dialog as CdkDialog,
  DialogRef as CdkDialogRefBase,
  DIALOG_DATA,
} from "@angular/cdk/dialog";
import { ComponentType, GlobalPositionStrategy, ScrollStrategy } from "@angular/cdk/overlay";
import { ComponentPortal } from "@angular/cdk/portal";
import { Injectable, Injector, TemplateRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { filter, firstValueFrom, map, switchMap, take } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogService } from "@bitwarden/logging";

import { isAtOrLargerThanBreakpoint } from "../utils/responsive-utils";

import { CdkDialogRef, DialogConfig, DialogRef, DrawerRef } from "./dialog-ref";
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

@Injectable()
export class DialogService {
  private dialog = inject(CdkDialog);
  private drawerService = inject(DrawerService);
  private injector = inject(Injector);
  private router = inject(Router);
  private authService = inject(AuthService, { optional: true });
  private logService = inject(LogService, { optional: true });

  private backDropClasses = ["tw-fixed", "tw-bg-bg-overlay", "tw-inset-0"];
  private defaultScrollStrategy = new CustomBlockScrollStrategy();

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
  }

  open<R = unknown, D = unknown, C = unknown>(
    componentOrTemplateRef: ComponentType<C> | TemplateRef<C>,
    config?: DialogConfig<D, R>,
  ): DialogRef<R, C> {
    // We need to split out our async closePredicate here because the CDK's closePredicate is sync
    const { closePredicate, ...otherConfig } = config ?? {};

    /**
     * This is a bit circular in nature:
     * We need the DialogRef instance for the DI injector that is passed *to* `Dialog.open`,
     * but we get the base CDK DialogRef instance *from* `Dialog.open`.
     *
     * To break the circle, we define CDKDialogRef as a wrapper for the CDKDialogRefBase.
     * This allows us to create the class instance and provide the base instance later, almost like "deferred inheritance".
     **/
    const ref = new CdkDialogRef<R, C>(this.logService, closePredicate);
    const injector = this.createInjector({
      data: config?.data,
      dialogRef: ref,
    });

    // Merge the custom config with the default config
    const _config = {
      backdropClass: this.backDropClasses,
      scrollStrategy: this.defaultScrollStrategy,
      positionStrategy: config?.positionStrategy ?? new ResponsivePositionStrategy(),
      closeOnNavigation: config?.closeOnNavigation,
      injector,
      ...otherConfig,
    };

    ref.cdkDialogRefBase = this.dialog.open<R, D, C>(componentOrTemplateRef, _config);

    if (config?.restoreFocus === undefined) {
      this.setRestoreFocusEl<R, C>(ref);
    }

    return ref;
  }

  /**
   * Opens a dialog in the side drawer, replacing any currently open drawer stack.
   * Returns undefined if the root drawer's closePredicate prevented it from closing.
   *
   * To stack a new drawer over an existing one, use `DrawerRef.stack`
   **/
  async openDrawer<R = unknown, D = unknown, C = unknown>(
    component: ComponentType<C>,
    config?: DialogConfig<D, R>,
  ): Promise<DrawerRef<R, C> | undefined> {
    if (!(await this.drawerService.closeAll())) {
      return undefined;
    }
    return this.stackDrawer(component, config, config?.closeOnNavigation ?? false);
  }

  /**
   * Create a DrawerRef, wire up its portal, push it onto the stack, and open it.
   * Used by openDrawer() (for the root) and DrawerRef.stack() (for subsequent entries).
   */
  private stackDrawer<R, D, C>(
    component: ComponentType<C>,
    config?: Omit<DialogConfig<D, R>, "closeOnNavigation">,
    closeOnNavigation = false,
  ): DrawerRef<R, C> {
    /**
     * Circular: we need the ref for the injector before we have the portal,
     * and we need the portal to complete the ref. Solved with mutability (same
     * pattern as openDialog / CdkDialogRef).
     */
    const ref: DrawerRef<R, C> = new DrawerRef<R, C>(
      () => this.drawerService.pop(),
      () => this.drawerService.isTop(ref),
      (component, config) => this.stackDrawer(component, config),
      closeOnNavigation,
      config?.closePredicate,
      this.logService,
    );
    const portal = new ComponentPortal(
      component,
      null,
      this.createInjector({ data: config?.data, dialogRef: ref, drawerRef: ref }),
    );
    ref.portal = portal;
    this.drawerService.push(ref);
    return ref;
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

  /** Close all open dialogs and drawers. Note that this will ignore any and all closePredicates */
  closeAll(): void {
    this.drawerService.forceCloseAll();
    this.dialog.closeAll();
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
  private createInjector(opts: {
    data: unknown;
    dialogRef: DialogRef<any, any>;
    drawerRef?: DrawerRef<any, any>;
  }): Injector {
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
        ...(opts.drawerRef ? [{ provide: DrawerRef, useValue: opts.drawerRef }] : []),
      ],
      parent: this.injector,
    });
  }
}
