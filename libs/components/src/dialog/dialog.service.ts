import {
  Dialog as CdkDialog,
  DialogConfig,
  DialogRef as CdkDialogRef,
  DIALOG_DATA,
  DialogCloseOptions,
} from "@angular/cdk/dialog";
import { ComponentType, ScrollStrategy } from "@angular/cdk/overlay";
import { ComponentPortal, Portal } from "@angular/cdk/portal";
import { Injectable, InjectionToken, Injector, TemplateRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { filter, firstValueFrom, map, Observable, Subject, switchMap } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DrawerService } from "../drawer/drawer.service";

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

export const IS_DRAWER_TOKEN = new InjectionToken<boolean>("IS_DRAWER");

export abstract class DialogRef<R = unknown, C = unknown>
  implements Pick<CdkDialogRef<R, C>, "close" | "closed" | "disableClose" | "componentInstance">
{
  abstract close(result?: R, options?: DialogCloseOptions): void;
  abstract closed: Observable<R | undefined>;
  abstract disableClose: boolean | undefined;
  /**
   * @deprecated
   * Does not work with drawer dialogs.
   **/
  abstract componentInstance: C | null;
}

class DrawerDialogRef<R = unknown, C = unknown> implements DialogRef<R, C> {
  private _closed = new Subject<R | undefined>();
  closed = this._closed.asObservable();
  disableClose = false;

  /** The portal containing the drawer */
  portal?: Portal<unknown>;

  constructor(private drawerService: DrawerService) {}

  close(result?: R, _options?: DialogCloseOptions): void {
    if (this.disableClose) {
      return;
    }
    this.drawerService.close(this.portal!);
    this._closed.next(result);
    this._closed.complete();
  }

  componentInstance: C | null = null;
}

@Injectable()
export class DialogService {
  private dialog = inject(CdkDialog);
  private drawerService = inject(DrawerService);
  private injector = inject(Injector);
  private router = inject(Router, { optional: true });
  private authService = inject(AuthService, { optional: true });
  private i18nService = inject(I18nService);

  private backDropClasses = ["tw-fixed", "tw-bg-black", "tw-bg-opacity-30", "tw-inset-0"];
  private defaultScrollStrategy = new CustomBlockScrollStrategy();
  private activeDrawer: DrawerDialogRef<any, any> | null = null;

  constructor() {
    /** TODO: This logic should exist outside of `libs/components`. */
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

  open<R = unknown, D = unknown, C = any>(
    componentOrTemplateRef: ComponentType<C> | TemplateRef<C>,
    config?: DialogConfig<D, CdkDialogRef<R, C>>,
  ): DialogRef<R, C> {
    config = {
      backdropClass: this.backDropClasses,
      scrollStrategy: this.defaultScrollStrategy,
      ...config,
    };

    return this.dialog.open(componentOrTemplateRef, config);
  }

  /** Opens a dialog in the side drawer */
  openDrawer<R = unknown, D = unknown, C = unknown>(
    component: ComponentType<C>,
    config?: DialogConfig<D, DialogRef<R, C>>,
  ): DialogRef<R, C> {
    this.activeDrawer?.close();
    this.activeDrawer = new DrawerDialogRef(this.drawerService);
    const portal = new ComponentPortal(
      component,
      null,
      Injector.create({
        providers: [
          {
            provide: DIALOG_DATA,
            useValue: config?.data,
          },
          {
            provide: CdkDialogRef,
            useValue: this.activeDrawer,
          },
          {
            provide: DialogRef,
            useValue: this.activeDrawer,
          },
          {
            provide: IS_DRAWER_TOKEN,
            useValue: true,
          },
        ],
        parent: this.injector,
      }),
    );
    this.activeDrawer.portal = portal;
    this.drawerService.open(portal);
    return this.activeDrawer;
  }

  /**
   * Opens a simple dialog, returns true if the user accepted the dialog.
   *
   * @param {SimpleDialogOptions} simpleDialogOptions - An object containing options for the dialog.
   * @returns `boolean` - True if the user accepted the dialog, false otherwise.
   */
  async openSimpleDialog(simpleDialogOptions: SimpleDialogOptions): Promise<boolean> {
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
    });
  }

  /** Close all open dialogs */
  closeAll(): void {
    return this.dialog.closeAll();
  }
}
