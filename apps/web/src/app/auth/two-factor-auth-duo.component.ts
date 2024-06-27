import { DialogModule } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";

import { TwoFactorAuthDuoComponent as TwoFactorAuthDuoBaseComponent } from "../../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-duo.component";
import { AsyncActionsModule } from "../../../../../libs/components/src/async-actions";
import { ButtonModule } from "../../../../../libs/components/src/button";
import { FormFieldModule } from "../../../../../libs/components/src/form-field";
import { LinkModule } from "../../../../../libs/components/src/link";
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
export class TwoFactorAuthDuoComponent extends TwoFactorAuthDuoBaseComponent {
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
