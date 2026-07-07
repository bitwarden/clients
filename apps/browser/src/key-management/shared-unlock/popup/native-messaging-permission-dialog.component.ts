import { DIALOG_DATA } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  CalloutComponent,
  CenterPositionStrategy,
  DialogModule,
  DialogRef,
  DialogService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";

/**
 * The feature that requires the `nativeMessaging` permission. Determines the description copy
 * shown in the dialog.
 */
export const NativeMessagingPermissionDialogType = Object.freeze({
  Biometrics: "biometrics",
  SharedUnlock: "sharedUnlock",
} as const);
export type NativeMessagingPermissionDialogType =
  (typeof NativeMessagingPermissionDialogType)[keyof typeof NativeMessagingPermissionDialogType];

const DESCRIPTION_KEY_BY_TYPE: Record<NativeMessagingPermissionDialogType, string> = {
  [NativeMessagingPermissionDialogType.Biometrics]: "biometricPermissionDesc",
  [NativeMessagingPermissionDialogType.SharedUnlock]: "sharedUnlockDesktopPermissionDesc",
};

/**
 * Informational dialog shown in the popped-out Account Security page when the user enables
 * a feature requiring the `nativeMessaging` permission. It explains that the browser will
 * prompt for the optional permission and that granting it reloads the extension and locks the vault.
 *
 * When the user continues, the dialog requests the `nativeMessaging` permission and closes with
 * `true` when it was granted and `false` when it was not. Closing without proceeding (via
 * `bitDialogClose`) closes with `undefined`.
 *
 * When the dialog emits `true`, the newly granted `nativeMessaging` permission is not usable until
 * the extension reloads to register the native messaging host. The caller is therefore responsible
 * for reloading the extension (e.g. `messagingService.send("reloadExtension")`) after persisting
 * any state that must survive the reload.
 */
export type NativeMessagingPermissionDialogParams = {
  type: NativeMessagingPermissionDialogType;
};

@Component({
  templateUrl: "./native-messaging-permission-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, CalloutComponent, DialogModule, TypographyModule, I18nPipe],
})
export class NativeMessagingPermissionDialogComponent {
  private readonly dialogRef = inject(DialogRef<boolean>);
  private readonly dialogService = inject(DialogService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly params = inject<NativeMessagingPermissionDialogParams | null>(DIALOG_DATA, {
    optional: true,
  });
  protected readonly descriptionKey =
    DESCRIPTION_KEY_BY_TYPE[
      (this.params?.type as NativeMessagingPermissionDialogType | undefined) ??
        NativeMessagingPermissionDialogType.Biometrics
    ];

  async continue() {
    let granted = false;
    try {
      granted = (await BrowserApi.requestPermission({
        permissions: ["nativeMessaging"],
      })) as boolean;
    } catch {
      if (this.platformUtilsService.isFirefox() && BrowserPopupUtils.inSidebar(window)) {
        await this.dialogService.openSimpleDialog({
          title: { key: "nativeMessaginPermissionSidebarTitle" },
          content: { key: "nativeMessaginPermissionSidebarDesc" },
          acceptButtonText: { key: "ok" },
          cancelButtonText: null,
          type: "info",
        });
      }
    }
    await this.dialogRef.close(granted);
  }

  /**
   * @throws if not called from a popout. Requesting the `nativeMessaging` permission reloads the
   * extension on grant, which would close a popup or sidebar; the flow must be popped out to a
   * stable window first.
   */
  static open(
    dialogService: DialogService,
    params: NativeMessagingPermissionDialogParams,
  ): DialogRef<boolean> {
    if (!BrowserPopupUtils.inPopout(window)) {
      throw new Error(
        "NativeMessagingPermissionDialogComponent must be opened from a popout, so the extension " +
          "can reload after the permission is granted without closing the window.",
      );
    }

    return dialogService.open<boolean>(NativeMessagingPermissionDialogComponent, {
      positionStrategy: new CenterPositionStrategy(),
      data: params,
    });
  }
}
