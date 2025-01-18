import { DialogModule } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";

import { TwoFactorAuthEmailComponent as TwoFactorAuthEmailBaseComponent } from "@bitwarden/angular/auth/components/two-factor-auth/two-factor-auth-email.component";
import { JslibModule } from "@bitwarden/angular/jslib.module";

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { AsyncActionsModule } from "../../../../../libs/components/src/async-actions";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { ButtonModule } from "../../../../../libs/components/src/button";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { DialogService } from "../../../../../libs/components/src/dialog";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { FormFieldModule } from "../../../../../libs/components/src/form-field";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { LinkModule } from "../../../../../libs/components/src/link";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
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
