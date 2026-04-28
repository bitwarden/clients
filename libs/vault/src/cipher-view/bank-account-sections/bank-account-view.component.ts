import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from "@angular/core";

import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BankAccountType } from "@bitwarden/common/vault/enums/bank-account-type";
import { BankAccountView } from "@bitwarden/common/vault/models/view/bank-account.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  SectionHeaderComponent,
  TypographyModule,
  FormFieldModule,
  IconButtonModule,
  CopyClickDirective,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { CopyCipherFieldDirective } from "../../components/copy-cipher-field.directive";
import { ReadOnlyCipherCardComponent } from "../read-only-cipher-card/read-only-cipher-card.component";

@Component({
  selector: "app-bank-account-view",
  templateUrl: "bank-account-view.component.html",
  imports: [
    I18nPipe,
    CopyCipherFieldDirective,
    SectionHeaderComponent,
    ReadOnlyCipherCardComponent,
    TypographyModule,
    FormFieldModule,
    IconButtonModule,
    CopyClickDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankAccountViewComponent {
  private readonly i18nService = inject(I18nService);
  private readonly eventCollectionService = inject(EventCollectionService);

  readonly bankAccount = input.required<BankAccountView>();
  readonly cipher = input.required<CipherView>();

  readonly revealAccountNumber = signal(false);
  readonly revealPin = signal(false);

  readonly localizedAccountType = computed(() => {
    const accountTypeMap: Record<BankAccountType, string> = {
      checking: this.i18nService.t("bankAccountTypeChecking"),
      savings: this.i18nService.t("bankAccountTypeSavings"),
      certificateOfDeposit: this.i18nService.t("bankAccountTypeCertificateOfDeposit"),
      lineOfCredit: this.i18nService.t("bankAccountTypeLineOfCredit"),
      investmentBrokerage: this.i18nService.t("bankAccountTypeInvestmentBrokerage"),
      moneyMarket: this.i18nService.t("bankAccountTypeMoneyMarket"),
      other: this.i18nService.t("bankAccountTypeOther"),
    };
    const accountType = this.bankAccount().accountType;

    return accountType
      ? (accountTypeMap[accountType as keyof typeof accountTypeMap] ?? accountType)
      : undefined;
  });

  async toggleAccountNumberVisible(visible: boolean) {
    this.revealAccountNumber.set(visible);
    if (visible) {
      await this.eventCollectionService.collect(
        EventType.Cipher_ClientToggledBankAccountNumberVisible,
        this.cipher().id,
        false,
        this.cipher().organizationId,
      );
    }
  }

  async togglePinVisible(visible: boolean) {
    this.revealPin.set(visible);
    if (visible) {
      await this.eventCollectionService.collect(
        EventType.Cipher_ClientToggledBankAccountPinVisible,
        this.cipher().id,
        false,
        this.cipher().organizationId,
      );
    }
  }
}
