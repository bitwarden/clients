// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  DEFAULT_DIALOG_CONFIG,
  Dialog,
  DialogConfig,
  DialogRef,
  DIALOG_SCROLL_STRATEGY,
} from "@angular/cdk/dialog";
import {
  ComponentType,
  GlobalPositionStrategy,
  Overlay,
  OverlayContainer,
  ScrollStrategy,
} from "@angular/cdk/overlay";
import {
  Inject,
  Injectable,
  Injector,
  OnDestroy,
  Optional,
  SkipSelf,
  TemplateRef,
} from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { filter, firstValueFrom, Subject, switchMap, takeUntil } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SimpleConfigurableDialogComponent } from "./simple-dialog/simple-configurable-dialog/simple-configurable-dialog.component";
import { SimpleDialogOptions, Translation } from "./simple-dialog/types";

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
  onResizeListener: () => void | null = null;

  /**
   * The previous breakpoint to avoid unnecessary updates.
   * `null` means no previous breakpoint has been set.
   */
  prevBreakpoint: "small" | "large" | null = null;

  constructor() {
    super();
    this.onResizeListener = this.updatePosition.bind(this);
    this.updatePosition(); // Initial position update
    window.addEventListener("resize", this.onResizeListener);
  }

  override dispose() {
    window.removeEventListener("resize", this.onResizeListener);
    this.onResizeListener = null;
    super.dispose();
  }

  updatePosition() {
    const isSmallScreen = window.matchMedia("(max-width: 768px)").matches;
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

@Injectable()
export class DialogService extends Dialog implements OnDestroy {
  private _destroy$ = new Subject<void>();

  private backDropClasses = ["tw-fixed", "tw-bg-black", "tw-bg-opacity-30", "tw-inset-0"];

  private defaultScrollStrategy = new CustomBlockScrollStrategy();

  constructor(
    /** Parent class constructor */
    _overlay: Overlay,
    _injector: Injector,
    @Optional() @Inject(DEFAULT_DIALOG_CONFIG) _defaultOptions: DialogConfig,
    @Optional() @SkipSelf() _parentDialog: Dialog,
    _overlayContainer: OverlayContainer,
    @Inject(DIALOG_SCROLL_STRATEGY) scrollStrategy: any,

    /** Not in parent class */
    @Optional() router: Router,
    @Optional() authService: AuthService,

    protected i18nService: I18nService,
  ) {
    super(_overlay, _injector, _defaultOptions, _parentDialog, _overlayContainer, scrollStrategy);

    /** Close all open dialogs if the vault locks */
    if (router && authService) {
      router.events
        .pipe(
          filter((event) => event instanceof NavigationEnd),
          switchMap(() => authService.getAuthStatus()),
          filter((v) => v !== AuthenticationStatus.Unlocked),
          takeUntil(this._destroy$),
        )
        .subscribe(() => this.closeAll());
    }
  }

  override ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    super.ngOnDestroy();
  }

  override open<R = unknown, D = unknown, C = unknown>(
    componentOrTemplateRef: ComponentType<C> | TemplateRef<C>,
    config?: DialogConfig<D, DialogRef<R, C>>,
  ): DialogRef<R, C> {
    const responsive = config?.responsive ?? true;

    config = {
      backdropClass: this.backDropClasses,
      scrollStrategy: this.defaultScrollStrategy,
      positionStrategy: responsive
        ? new ResponsivePositionStrategy()
        : new GlobalPositionStrategy().centerHorizontally().centerVertically(),
      ...config,
    };

    return super.open(componentOrTemplateRef, config);
  }

  /**
   * Opens a simple dialog, returns true if the user accepted the dialog.
   *
   * @param {SimpleDialogOptions} simpleDialogOptions - An object containing options for the dialog.
   * @returns `boolean` - True if the user accepted the dialog, false otherwise.
   */
  async openSimpleDialog(simpleDialogOptions: SimpleDialogOptions): Promise<boolean> {
    const dialogRef = this.openSimpleDialogRef(simpleDialogOptions);

    return firstValueFrom(dialogRef.closed);
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
      responsive: false,
    });
  }

  protected translate(translation: string | Translation, defaultKey?: string): string {
    if (translation == null && defaultKey == null) {
      return null;
    }

    if (translation == null) {
      return this.i18nService.t(defaultKey);
    }

    // Translation interface use implies we must localize.
    if (typeof translation === "object") {
      return this.i18nService.t(translation.key, ...(translation.placeholders ?? []));
    }

    return translation;
  }
}
