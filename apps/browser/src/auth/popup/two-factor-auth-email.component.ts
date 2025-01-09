import { DialogModule } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";

import { TwoFactorAuthEmailComponent as TwoFactorAuthEmailBaseComponent } from "@bitwarden/angular/auth/components/two-factor-auth/two-factor-auth-email.component";
import { JslibModule } from "@bitwarden/angular/jslib.module";

import { AsyncActionsModule } from "../../../../../libs/components/src/async-actions";
import { ButtonModule } from "../../../../../libs/components/src/button";
import { DialogService } from "../../../../../libs/components/src/dialog";
import { FormFieldModule } from "../../../../../libs/components/src/form-field";
import { LinkModule } from "../../../../../libs/components/src/link";
import { I18nPipe } from "../../../../../libs/components/src/shared/i18n.pipe";
import { TypographyModule } from "../../../../../libs/components/src/typography";
import BrowserPopupUtils from "../../platform/popup/browser-popup-utils";

@Component({
  standalone: true,
  selector: "app-two-factor-auth-email",
  templateUrl:
    "../../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-email.component.html",
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
export class TwoFactorAuthEmailComponent extends TwoFactorAuthEmailBaseComponent implements OnInit {
  private dialogService = inject(DialogService);

  async ngOnInit(): Promise<void> {
    if (BrowserPopupUtils.inPopup(window)) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "warning" },
        content: { key: "popup2faCloseMessage" },
        type: "warning",
      });
      if (confirmed) {
        await BrowserPopupUtils.openCurrentPagePopout(window);
        return;
      }
    }

    await super.ngOnInit();
  }
}
