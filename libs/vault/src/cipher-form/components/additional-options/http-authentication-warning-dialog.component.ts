import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  CenterPositionStrategy,
  DialogModule,
  DialogRef,
  DialogService,
  LinkComponent,
} from "@bitwarden/components";

const HTTP_AUTHENTICATION_HELP_ARTICLE_URL = "https://bitwarden.com/help/basic-auth-autofill/";

/**
 * Warns about malicious sites before the browser login pop-up prompt setting is turned on.
 * Closes with `true` when the user chooses to turn the setting on.
 */
@Component({
  templateUrl: "http-authentication-warning-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, DialogModule, JslibModule, LinkComponent],
})
export class HTTPAuthenticationWarningDialogComponent {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  protected turnOn() {
    void this.dialogRef.close(true);
  }

  protected cancel() {
    void this.dialogRef.close(false);
  }

  protected openHelpArticle(event: Event) {
    event.preventDefault();
    this.platformUtilsService.launchUri(HTTP_AUTHENTICATION_HELP_ARTICLE_URL);
  }

  /**
   * Opens the dialog. Escape and clicking outside close it without a result, which leaves the
   * setting off.
   */
  static open(dialogService: DialogService): DialogRef<boolean> {
    return dialogService.open<boolean>(HTTPAuthenticationWarningDialogComponent, {
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}
