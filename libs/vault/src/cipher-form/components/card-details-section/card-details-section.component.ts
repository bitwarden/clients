// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { normalizeExpiryYearFormat } from "@bitwarden/common/autofill/utils";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";

import { CipherFormContainer } from "../../cipher-form-container";

@Component({
  selector: "vault-card-details-section",
  templateUrl: "./card-details-section.component.html",
  imports: [
    CardComponent,
    TypographyModule,
    FormFieldModule,
    ReactiveFormsModule,
    SelectModule,
    SectionHeaderComponent,
    IconButtonModule,
    JslibModule,
    CommonModule,
  ],
})
export class CardDetailsSectionComponent implements OnInit {
  /** The original cipher */
  @Input() originalCipherView: CipherView;

  /** True when all fields should be disabled */
  @Input() disabled: boolean;

  /**
   * All form fields associated with the card details
   *
   * Note: `as` is used to assert the type of the form control,
   * leaving as just null gets inferred as `unknown`
   */
  cardDetailsForm = this.formBuilder.group({
    cardholderName: "",
    number: "",
    brand: "",
    expMonth: "",
    expYear: "" as string | number,
    code: "",
  });

  /** Available Card Brands */
  readonly cardBrands = [
    { name: "-- " + this.i18nService.t("select") + " --", value: "" },
    { name: "Visa", value: "Visa" },
    { name: "Mastercard", value: "Mastercard" },
    { name: "American Express", value: "Amex" },
    { name: "Discover", value: "Discover" },
    { name: "Diners Club", value: "Diners Club" },
    { name: "JCB", value: "JCB" },
    { name: "Maestro", value: "Maestro" },
    { name: "UnionPay", value: "UnionPay" },
    { name: "RuPay", value: "RuPay" },
    { name: this.i18nService.t("other"), value: "Other" },
  ];

  /** Available expiration months */
  readonly expirationMonths = [
    { name: "-- " + this.i18nService.t("select") + " --", value: null },
    { name: "01 - " + this.i18nService.t("january"), value: "1" },
    { name: "02 - " + this.i18nService.t("february"), value: "2" },
    { name: "03 - " + this.i18nService.t("march"), value: "3" },
    { name: "04 - " + this.i18nService.t("april"), value: "4" },
    { name: "05 - " + this.i18nService.t("may"), value: "5" },
    { name: "06 - " + this.i18nService.t("june"), value: "6" },
    { name: "07 - " + this.i18nService.t("july"), value: "7" },
    { name: "08 - " + this.i18nService.t("august"), value: "8" },
    { name: "09 - " + this.i18nService.t("september"), value: "9" },
    { name: "10 - " + this.i18nService.t("october"), value: "10" },
    { name: "11 - " + this.i18nService.t("november"), value: "11" },
    { name: "12 - " + this.i18nService.t("december"), value: "12" },
  ];

  EventType = EventType;

  get initialValues() {
    return this.cipherFormContainer.config.initialValues;
  }

  constructor(
    private cipherFormContainer: CipherFormContainer,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private eventCollectionService: EventCollectionService,
  ) {
    this.cipherFormContainer.registerChildForm("cardDetails", this.cardDetailsForm);

    this.cardDetailsForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(({ cardholderName, number, brand, expMonth, expYear, code }) => {
        this.cipherFormContainer.patchCipher((cipher) => {
          const expirationYear = normalizeExpiryYearFormat(expYear) ?? "";

          cipher.card.cardholderName = cardholderName;
          cipher.card.number = number;
          cipher.card.brand = brand;
          cipher.card.expMonth = expMonth;
          cipher.card.expYear = expirationYear;
          cipher.card.code = code;

          return cipher;
        });
      });

    this.cardDetailsForm.controls.number.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((number) => {
        const brand = CardView.getCardBrandByPatterns(number);

        if (brand) {
          this.cardDetailsForm.controls.brand.setValue(brand);
        }
      });
  }

  ngOnInit() {
    const prefillCipher = this.cipherFormContainer.getInitialCipherView();

    if (prefillCipher) {
      this.initFromExistingCipher(prefillCipher.card);
    } else {
      this.initNewCipher();
    }

    if (this.disabled) {
      this.cardDetailsForm.disable();
    }
  }

  private initFromExistingCipher(existingCard: CardView) {
    this.cardDetailsForm.patchValue({
      cardholderName: this.initialValues?.cardholderName ?? existingCard.cardholderName,
      number: this.initialValues?.number ?? existingCard.number,
      expMonth: this.initialValues?.expMonth ?? existingCard.expMonth,
      expYear: this.initialValues?.expYear ?? existingCard.expYear,
      code: this.initialValues?.code ?? existingCard.code,
    });
  }

  private initNewCipher() {
    this.cardDetailsForm.patchValue({
      cardholderName: this.initialValues?.cardholderName || "",
      number: this.initialValues?.number || "",
      expMonth: this.initialValues?.expMonth || "",
      expYear: this.initialValues?.expYear || "",
      code: this.initialValues?.code || "",
      brand: CardView.getCardBrandByPatterns(this.initialValues?.number) || "",
    });
  }

  /** Get the section heading based on the card brand */
  getSectionHeading(): string {
    const { brand } = this.cardDetailsForm.value;

    if (brand && brand !== "Other") {
      return this.i18nService.t("cardBrandDetails", brand);
    }

    return this.i18nService.t("cardDetails");
  }

  async logCardEvent(hiddenFieldVisible: boolean, event: EventType) {
    const { mode, originalCipher } = this.cipherFormContainer.config;

    const isEdit = ["edit", "partial-edit"].includes(mode);

    if (hiddenFieldVisible && isEdit) {
      await this.eventCollectionService.collect(
        event,
        originalCipher.id,
        false,
        originalCipher.organizationId,
      );
    }
  }
}
