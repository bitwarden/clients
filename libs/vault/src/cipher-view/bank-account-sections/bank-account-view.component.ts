import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from "@angular/core";

import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BankAccountType,
  BankAccountTypeI18nKeys,
} from "@bitwarden/common/vault/enums/bank-account-type";
import { BankAccountView } from "@bitwarden/common/vault/models/view/bank-account.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  SectionHeaderComponent,
  TypographyModule,
  FormFieldModule,
  IconButtonModule,
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
  readonly revealSwiftCode = signal(false);
  readonly revealIban = signal(false);

  readonly localizedAccountType = computed(() => {
    const accountType = this.bankAccount().accountType;
    if (!accountType) {
      return undefined;
    }

    const i18nKey = BankAccountTypeI18nKeys[accountType as BankAccountType];
    return i18nKey ? this.i18nService.t(i18nKey) : accountType;
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

  async toggleSwiftCodeVisible(visible: boolean) {
    this.revealSwiftCode.set(visible);
    if (visible) {
      await this.eventCollectionService.collect(
        EventType.Cipher_ClientToggledSwiftCodeVisible,
        this.cipher().id,
        false,
        this.cipher().organizationId,
      );
    }
  }

  async toggleIbanVisible(visible: boolean) {
    this.revealIban.set(visible);
    if (visible) {
      await this.eventCollectionService.collect(
        EventType.Cipher_ClientToggledIbanVisible,
        this.cipher().id,
        false,
        this.cipher().organizationId,
      );
    }
  }
}
