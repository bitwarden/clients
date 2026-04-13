import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BankAccountType } from "@bitwarden/common/vault/enums/bank-account-type";
import { BankAccountView } from "@bitwarden/common/vault/models/view/bank-account.view";
import {
  CopyClickDirective,
  SectionHeaderComponent,
  TypographyModule,
  FormFieldModule,
  IconButtonModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ReadOnlyCipherCardComponent } from "../read-only-cipher-card/read-only-cipher-card.component";

@Component({
  selector: "app-bank-account-view",
  templateUrl: "bank-account-view.component.html",
  imports: [
    I18nPipe,
    CopyClickDirective,
    SectionHeaderComponent,
    ReadOnlyCipherCardComponent,
    TypographyModule,
    FormFieldModule,
    IconButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankAccountViewComponent {
  private readonly i18nService = inject(I18nService);

  readonly bankAccount = input.required<BankAccountView>();

  readonly revealAccountNumber = false;
  readonly revealPin = false;

  readonly localizedAccountType = computed(() => {
    const accountTypeMap: Record<BankAccountType, string> = {
      [BankAccountType.Checking]: this.i18nService.t("bankAccountTypeChecking"),
      [BankAccountType.Savings]: this.i18nService.t("bankAccountTypeSavings"),
      [BankAccountType.CertificateOfDeposit]: this.i18nService.t(
        "bankAccountTypeCertificateOfDeposit",
      ),
      [BankAccountType.LineOfCredit]: this.i18nService.t("bankAccountTypeLineOfCredit"),
      [BankAccountType.InvestmentBrokerage]: this.i18nService.t(
        "bankAccountTypeInvestmentBrokerage",
      ),
      [BankAccountType.MoneyMarket]: this.i18nService.t("bankAccountTypeMoneyMarket"),
      [BankAccountType.Other]: this.i18nService.t("bankAccountTypeOther"),
    };
    const accountType = this.bankAccount().accountType;

    return accountType
      ? (accountTypeMap[accountType as keyof typeof accountTypeMap] ?? accountType)
      : undefined;
  });
}
