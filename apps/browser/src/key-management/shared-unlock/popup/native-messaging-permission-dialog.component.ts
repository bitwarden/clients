import { DIALOG_DATA } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  ButtonModule,
  CalloutComponent,
  CenterPositionStrategy,
  DialogModule,
  DialogRef,
  DialogService,
  TypographyModule,
} from "@bitwarden/components";

/**
 * Informational dialog shown in the popped-out Account Security page when the user enables
 * a feature requiring the `nativeMessaging` permission. It explains that the browser will
 * prompt for the optional permission and that granting it reloads the extension and locks the vault.
 *
 * Closes with `true` when the user chooses to continue, and `undefined` (via `bitDialogClose`)
 * when the user closes without proceeding.
 */
export type NativeMessagingPermissionDialogParams = {
  descriptionKey?: string;
};

@Component({
  templateUrl: "./native-messaging-permission-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, CalloutComponent, DialogModule, TypographyModule, JslibModule],
})
export class NativeMessagingPermissionDialogComponent {
  private readonly dialogRef = inject(DialogRef<boolean>);
  private readonly params = inject<NativeMessagingPermissionDialogParams | null>(DIALOG_DATA, {
    optional: true,
  });
  protected readonly descriptionKey =
    this.params?.descriptionKey ?? "sharedUnlockDesktopPermissionDesc";

  continue() {
    void this.dialogRef.close(true);
  }

  static open(
    dialogService: DialogService,
    params?: NativeMessagingPermissionDialogParams,
  ): DialogRef<boolean> {
    return dialogService.open<boolean>(NativeMessagingPermissionDialogComponent, {
      positionStrategy: new CenterPositionStrategy(),
      data: params,
    });
  }
}
