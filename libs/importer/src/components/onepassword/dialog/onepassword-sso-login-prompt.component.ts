import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SsoKeyIcon } from "@bitwarden/assets/svg";
import {
  DIALOG_DATA,
  DialogRef,
  ButtonModule,
  DialogModule,
  DialogService,
  IconButtonModule,
  SvgModule,
  TypographyModule,
} from "@bitwarden/components";

export interface OnePasswordSsoLoginPromptData {
  email: string;
  /** Brings the sign-in to the front. */
  openWindow: () => void;
}

/**
 * Waits while the user signs in with the identity provider of a 1Password account in a window of
 * its own, which it can bring back. Closes with `undefined`, whether the user cancels or the opener
 * closes it once the sign-in is over.
 */
@Component({
  templateUrl: "onepassword-sso-login-prompt.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, DialogModule, ButtonModule, IconButtonModule, SvgModule, TypographyModule],
})
export class OnePasswordSsoLoginPromptComponent {
  private readonly dialogRef = inject(DialogRef<undefined>);
  protected readonly data = inject<OnePasswordSsoLoginPromptData>(DIALOG_DATA);
  protected readonly icon = SsoKeyIcon;

  protected cancel(): void {
    void this.dialogRef.close(undefined);
  }

  static open(
    dialogService: DialogService,
    data: OnePasswordSsoLoginPromptData,
  ): DialogRef<undefined> {
    // Only Cancel and the close button call the sign-in off, never a click outside or Escape.
    return dialogService.open<undefined, OnePasswordSsoLoginPromptData>(
      OnePasswordSsoLoginPromptComponent,
      { data, disableClose: true },
    );
  }
}
