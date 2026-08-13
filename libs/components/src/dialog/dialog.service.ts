import {
  Dialog as CdkDialog,
  DialogRef as CdkDialogRefBase,
  DIALOG_DATA,
} from "@angular/cdk/dialog";
import { ComponentType, GlobalPositionStrategy, ScrollStrategy } from "@angular/cdk/overlay";
import { ComponentPortal } from "@angular/cdk/portal";
import {
  DestroyableInjector,
  Injectable,
  Injector,
  Provider,
  TemplateRef,
  afterNextRender,
  inject,
} from "@angular/core";
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

/**
 * Wrap `injector.destroy()` so it can safely be called from more than one teardown path:
 * `R3Injector.destroy()` throws `NG0205` if it runs a second time.
 */
function destroyOnce(injector: DestroyableInjector): () => void {
  let destroyed = false;
  return () => {
    if (destroyed) {
      return;
    }
    destroyed = true;
    injector.destroy();
  };
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
    // We need to split out our async closePredicate here because the CDK's closePredicate is sync.
    // `providers` is ours too — it goes into the injector we build below, not into the CDK config.
    const { closePredicate, providers, ...otherConfig } = config ?? {};

    /**
     * This is a bit circular in nature:
     * We need the DialogRef instance for the DI injector that is passed *to* `Dialog.open`,
     * but we get the base CDK DialogRef instance *from* `Dialog.open`.
     *
     * To break the circle, we define CDKDialogRef as a wrapper for the CDKDialogRefBase.
     * This allows us to create the class instance and provide the base instance later, almost like "deferred inheritance".
     **/
    const ref = new CdkDialogRef<R, C>(this.logService, closePredicate);
    const { injector, destroyProviders } = this.createInjector({
      data: config?.data,
      dialogRef: ref,
      providers,
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

    try {
      ref.cdkDialogRefBase = this.dialog.open<R, D, C>(componentOrTemplateRef, _config);
    } catch (err) {
      /**
       * The dialog is half-open. `Dialog.open` attaches the overlay before it creates the component
       * and only records the dialog in `openDialogs` afterwards, so a component constructor that
       * throws leaves an attached `cdk-dialog-container`, the enabled block-scroll strategy (the
       * body keeps `tw-overflow-hidden`) and the `ResponsivePositionStrategy` resize listener
       * behind, none of it reachable by `closeAll()`. That is a pre-existing CDK-side leak and not
       * something we can clean up from here.
       *
       * What we can clean up is the providers injector: `ref` never receives a CDK ref to delegate
       * to, so `closed` never emits and no other teardown path will ever run. Anything the dialog
       * component's constructor resolved before throwing is destroyed here or never.
       */
      destroyProviders?.();
      throw err;
    }

    if (destroyProviders) {
      this.destroyProvidersWithDialog(ref.cdkDialogRefBase, destroyProviders);
    }

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
      () => this.drawerService.pop(ref),
      () => this.drawerService.isTop(ref),
      (component, config) => this.stackDrawer(component, config),
      closeOnNavigation,
      config?.closePredicate,
      this.logService,
    );
    const { injector, destroyProviders } = this.createInjector({
      data: config?.data,
      dialogRef: ref,
      drawerRef: ref,
      providers: config?.providers,
    });
    ref.portal = new ComponentPortal(component, null, injector);
    if (destroyProviders) {
      this.destroyProvidersWithDrawer(ref, destroyProviders);
    }
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

  /**
   * Destroy the injector holding a dialog's own `providers` once the dialog component is gone.
   *
   * `ComponentRef.onDestroy` is the precise hook: Angular runs a view's directive `ngOnDestroy`
   * hooks before the callbacks registered on the view, so a provided service is destroyed strictly
   * after the component that injected it. It also fires for every way a CDK dialog can go away —
   * `close()`, the backdrop, escape, `closeAll()`, the vault-lock subscription, overlay detachment
   * and `Dialog.ngOnDestroy` — and does not fire when a `closePredicate` keeps the dialog open.
   */
  private destroyProvidersWithDialog<R, C>(
    cdkRef: CdkDialogRefBase<R, C> | undefined,
    destroyProviders: () => void,
  ) {
    /** There is always a CDK ref at runtime; unit tests that stub `Dialog.open` return none. */
    if (cdkRef == null) {
      return;
    }

    if (cdkRef.componentRef) {
      cdkRef.componentRef.onDestroy(destroyProviders);
      return;
    }

    /**
     * `TemplateRef` dialogs never get a `componentRef`. `closed` is the next best hook — the CDK
     * disposes the overlay, which destroys the dialog's view, before it emits.
     */
    cdkRef.closed.subscribe({ complete: destroyProviders });
  }

  /**
   * Destroy the injector holding a drawer's own `providers` once the drawer component is gone.
   *
   * Drawers are the mirror image of dialogs: `closed` emits *before* the component is destroyed,
   * because closing only pops the drawer stack and the component dies when the layout's
   * `cdkPortalOutlet` picks up the new top-of-stack portal on the next change detection pass.
   * `afterNextRender` lands the teardown after that pass, so a provided service is never destroyed
   * while the drawer that injected it is still on screen.
   *
   * Keying off `closed` rather than the component's destruction is also what makes
   * `DrawerRef.stack()` work: burying a drawer destroys its component but keeps its ref, its
   * portal, and therefore this injector alive for when the child pops and the drawer is re-created.
   */
  private destroyProvidersWithDrawer<R, C>(ref: DrawerRef<R, C>, destroyProviders: () => void) {
    ref.closed.subscribe({
      complete: () => afterNextRender(destroyProviders, { injector: this.injector }),
    });
  }

  /**
   * Build the injector that is passed to the opened dialog or drawer.
   *
   * A caller's `providers` go into their own injector, nested *below* the dialog's built-in tokens
   * so they can inject `DIALOG_DATA` / `DialogRef` and still shadow anything from the environment
   * injector. Returns a `destroyProviders` callback when — and only when — such an injector exists;
   * dialogs that declare no providers get exactly the injector they always got, and nothing new to
   * tear down.
   *
   * Isolating the caller's providers also keeps `R3Injector.destroy()` away from the built-in
   * tokens: it calls `ngOnDestroy()` on every instance it handed out, `useValue` ones included, so
   * a caller `data` object that happens to have an `ngOnDestroy` must not live in the injector
   * being destroyed.
   *
   * `createEnvironmentInjector` also accepts `Provider[]`, but it registers itself under the
   * `EnvironmentInjector` token — which `DomPortalOutlet` reads to choose the environment injector
   * for the whole overlay subtree. That would give every dialog open its own `StandaloneService`,
   * and so its own standalone-component injector cache. `Injector.create`'s object overload takes
   * `Provider[]` just as happily and returns a `DestroyableInjector`.
   */
  private createInjector(opts: {
    data: unknown;
    dialogRef: DialogRef<any, any>;
    drawerRef?: DrawerRef<any, any>;
    providers?: Provider[];
  }): { injector: Injector; destroyProviders?: () => void } {
    const dialogInjector = Injector.create({
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

    if (!opts.providers?.length) {
      return { injector: dialogInjector };
    }

    const providersInjector = Injector.create({
      providers: opts.providers,
      parent: dialogInjector,
    });

    return {
      injector: providersInjector,
      destroyProviders: destroyOnce(providersInjector),
    };
  }
}
