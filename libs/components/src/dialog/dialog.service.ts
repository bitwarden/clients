import {
  Dialog as CdkDialog,
  DialogConfig as CdkDialogConfig,
  DialogRef as CdkDialogRefBase,
  DIALOG_DATA,
  DialogCloseOptions,
} from "@angular/cdk/dialog";
import { ComponentType, ScrollStrategy } from "@angular/cdk/overlay";
import { ComponentPortal, Portal } from "@angular/cdk/portal";
import { Injectable, Injector, TemplateRef, inject } from "@angular/core";
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

export abstract class DialogRef<R = unknown, C = unknown>
  implements Pick<CdkDialogRef<R, C>, "close" | "closed" | "disableClose" | "componentInstance">
{
  abstract readonly isDrawer?: boolean;

  // --- From CdkDialogRef ---
  abstract close(result?: R, options?: DialogCloseOptions): void;
  abstract readonly closed: Observable<R | undefined>;
  abstract disableClose: boolean | undefined;
  /**
   * @deprecated
   * Does not work with drawer dialogs.
   **/
  abstract componentInstance: C | null;
}

export type DialogConfig<D = unknown, R = unknown> = Pick<
  CdkDialogConfig<D, R>,
  "data" | "disableClose" | "ariaModal" | "positionStrategy" | "height" | "width"
>;

class DrawerDialogRef<R = unknown, C = unknown> implements DialogRef<R, C> {
  readonly isDrawer = true;

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

/**
 * DialogRef that delegates functionality to the CDK implementation
 **/
export class CdkDialogRef<R = unknown, C = unknown> implements DialogRef<R, C> {
  readonly isDrawer = false;

  /** This is not available until after construction, @see DialogService.open. */
  cdkDialogRefBase!: CdkDialogRefBase<R, C>;

  // --- Delegated to CdkDialogRefBase ---

  close(result?: R, options?: DialogCloseOptions): void {
    this.cdkDialogRefBase.close(result, options);
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
  private router = inject(Router, { optional: true });
  private authService = inject(AuthService, { optional: true });
  private i18nService = inject(I18nService);

  private backDropClasses = ["tw-fixed", "tw-bg-black", "tw-bg-opacity-30", "tw-inset-0"];
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
  }

  open<R = unknown, D = unknown, C = unknown>(
    componentOrTemplateRef: ComponentType<C> | TemplateRef<C>,
    config?: DialogConfig<D, DialogRef<R, C>>,
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
    const injector = this.createInjector({
      data: config?.data,
      dialogRef: ref,
    });

    // Merge the custom config with the default config
    const _config = {
      backdropClass: this.backDropClasses,
      scrollStrategy: this.defaultScrollStrategy,
      injector,
      ...config,
    };

    ref.cdkDialogRefBase = this.dialog.open<R, D, C>(componentOrTemplateRef, _config);
    return ref;
  }

  /** Opens a dialog in the side drawer */
  openDrawer<R = unknown, D = unknown, C = unknown>(
    component: ComponentType<C>,
    config?: DialogConfig<D, DialogRef<R, C>>,
  ): DialogRef<R, C> {
    this.activeDrawer?.close();
    /**
     * This is also circular. When creating the DrawerDialogRef, we do not yet have a portal instance to provide to the injector.
     * Similar to `this.open`, we get around this with mutability.
     */
    this.activeDrawer = new DrawerDialogRef(this.drawerService);
    const portal = new ComponentPortal(
      component,
      null,
      this.createInjector({ data: config?.data, dialogRef: this.activeDrawer }),
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
