// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogModule } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { TwoFactorAuthDuoComponent as TwoFactorAuthDuoBaseComponent } from "../../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-duo.component";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { AsyncActionsModule } from "../../../../../libs/components/src/async-actions";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { ButtonModule } from "../../../../../libs/components/src/button";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { FormFieldModule } from "../../../../../libs/components/src/form-field";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { LinkModule } from "../../../../../libs/components/src/link";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { TypographyModule } from "../../../../../libs/components/src/typography";

@Component({
  standalone: true,
  selector: "app-two-factor-auth-duo",
  templateUrl:
    "../../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-duo.component.html",
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    ButtonModule,
    LinkModule,
    TypographyModule,
    ReactiveFormsModule,
    FormFieldModule,
    AsyncActionsModule,
    FormsModule,
  ],
  providers: [I18nPipe],
})
export class TwoFactorAuthDuoComponent
  extends TwoFactorAuthDuoBaseComponent
  implements OnInit, OnDestroy
{
  async ngOnInit(): Promise<void> {
    await super.ngOnInit();
  }

  private duoResultChannel: BroadcastChannel;

  protected override setupDuoResultListener() {
    if (!this.duoResultChannel) {
      this.duoResultChannel = new BroadcastChannel("duoResult");
      this.duoResultChannel.addEventListener("message", this.handleDuoResultMessage);
    }
  }

  private handleDuoResultMessage = async (msg: { data: { code: string; state: string } }) => {
    this.token.emit(msg.data.code + "|" + msg.data.state);
  };

  async ngOnDestroy() {
    if (this.duoResultChannel) {
      // clean up duo listener if it was initialized.
      this.duoResultChannel.removeEventListener("message", this.handleDuoResultMessage);
      this.duoResultChannel.close();
    }
  }
}
