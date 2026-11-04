import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import {
  ButtonModule,
  CenterPositionStrategy,
  DIALOG_DATA,
  DialogModule,
  DialogService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import type { BrowserSession } from "./native-webauthn";

/**
 * Shown while a WebAuthn request continues in the user's browser, where the app can't tell whether
 * the browser was opened, focused or closed. Closes when the request ends. Closing it otherwise
 * cancels the request.
 */
@Component({
  templateUrl: "webauthn-browser-session-dialog.component.html",
  imports: [I18nPipe, ButtonModule, DialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebAuthnBrowserSessionDialogComponent {
  protected readonly data = inject<BrowserSession>(DIALOG_DATA);

  static open(dialogService: DialogService, session: BrowserSession) {
    const dialogRef = dialogService.open<void, BrowserSession>(
      WebAuthnBrowserSessionDialogComponent,
      { data: session, positionStrategy: new CenterPositionStrategy() },
    );
    let ended = false;
    void session.ended.then(() => {
      ended = true;
      void dialogRef.close();
    });
    void firstValueFrom(dialogRef.closed).then(() => {
      if (!ended) {
        session.cancel();
      }
    });
    return dialogRef;
  }
}
