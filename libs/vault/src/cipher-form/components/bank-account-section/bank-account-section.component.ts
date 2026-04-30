import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BankAccountType } from "@bitwarden/common/vault/enums/bank-account-type";
import { BankAccountView } from "@bitwarden/common/vault/models/view/bank-account.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { CipherFormContainer } from "../../cipher-form-container";

@Component({
  selector: "vault-bank-account-section",
  templateUrl: "./bank-account-section.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    TypographyModule,
    FormFieldModule,
    ReactiveFormsModule,
    SelectModule,
    SectionHeaderComponent,
    IconButtonModule,
    I18nPipe,
  ],
})
export class BankAccountSectionComponent implements OnInit {
  readonly originalCipherView = input<CipherView | null>(null);
  readonly disabled = input(false);

  readonly bankAccountForm = this.formBuilder.group({
    bankName: [""],
    nameOnAccount: [""],
    accountType: [""],
    accountNumber: [""],
    routingNumber: [""],
    branchNumber: [""],
    pin: [""],
    swiftCode: [""],
    iban: [""],
    bankContactPhone: [""],
  });

  readonly accountTypeOptions: { label: string; value: string }[];

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly cipherFormContainer: CipherFormContainer,
    private readonly formBuilder: FormBuilder,
    private readonly i18nService: I18nService,
  ) {
    this.accountTypeOptions = [
      { label: "-- " + this.i18nService.t("bankAccountType") + " --", value: "" },
      { label: this.i18nService.t("bankAccountTypeChecking"), value: BankAccountType.Checking },
      { label: this.i18nService.t("bankAccountTypeSavings"), value: BankAccountType.Savings },
      {
        label: this.i18nService.t("bankAccountTypeCertificateOfDeposit"),
        value: BankAccountType.CertificateOfDeposit,
      },
      {
        label: this.i18nService.t("bankAccountTypeLineOfCredit"),
        value: BankAccountType.LineOfCredit,
      },
      {
        label: this.i18nService.t("bankAccountTypeInvestmentBrokerage"),
        value: BankAccountType.InvestmentBrokerage,
      },
      {
        label: this.i18nService.t("bankAccountTypeMoneyMarket"),
        value: BankAccountType.MoneyMarket,
      },
      { label: this.i18nService.t("bankAccountTypeOther"), value: BankAccountType.Other },
    ];

    this.cipherFormContainer.registerChildForm("bankAccountDetails", this.bankAccountForm);
    this.bankAccountForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const data = new BankAccountView();
      data.bankName = value.bankName ?? undefined;
      data.nameOnAccount = value.nameOnAccount ?? undefined;
      data.accountType = value.accountType ?? undefined;
      data.accountNumber = value.accountNumber ?? undefined;
      data.routingNumber = value.routingNumber ?? undefined;
      data.branchNumber = value.branchNumber ?? undefined;
      data.pin = value.pin ?? undefined;
      data.swiftCode = value.swiftCode ?? undefined;
      data.iban = value.iban ?? undefined;
      data.bankContactPhone = value.bankContactPhone ?? undefined;
      this.cipherFormContainer.patchCipher((cipher) => {
        cipher.bankAccount = data;
        return cipher;
      });
    });
  }

  ngOnInit() {
    const prefillCipher = this.cipherFormContainer.getInitialCipherView();
    const bankAccountView = prefillCipher?.bankAccount ?? this.originalCipherView()?.bankAccount;

    if (bankAccountView) {
      this.setInitialValues(bankAccountView);
    }

    if (this.disabled()) {
      this.bankAccountForm.disable();
    }

    this.cipherFormContainer.formStatusChange$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => {
        if (status === "disabled" || this.disabled()) {
          this.bankAccountForm.disable();
        } else {
          this.bankAccountForm.enable();
        }
      });
  }

  private setInitialValues(bankAccountView: BankAccountView) {
    this.bankAccountForm.setValue({
      bankName: bankAccountView.bankName || "",
      nameOnAccount: bankAccountView.nameOnAccount || "",
      accountType: bankAccountView.accountType || "",
      accountNumber: bankAccountView.accountNumber || "",
      routingNumber: bankAccountView.routingNumber || "",
      branchNumber: bankAccountView.branchNumber || "",
      pin: bankAccountView.pin || "",
      swiftCode: bankAccountView.swiftCode || "",
      iban: bankAccountView.iban || "",
      bankContactPhone: bankAccountView.bankContactPhone || "",
    });
  }
}
