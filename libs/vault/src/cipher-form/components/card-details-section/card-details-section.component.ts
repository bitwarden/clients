import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";

import { CipherFormContainer } from "../../cipher-form-container";

type CardDetailsForm = {
  cardholderName: CardView["cardholderName"];
  number: CardView["number"];
  brand: CardView["brand"];
  expMonth: CardView["expMonth"];
  expYear: CardView["expYear"];
  code: CardView["code"];
};

@Component({
  selector: "vault-card-details-section",
  templateUrl: "./card-details-section.component.html",
  standalone: true,
  imports: [
    CardComponent,
    SectionComponent,
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

  /** All form fields associated with the card details */
  cardDetailsForm = this.formBuilder.group<CardDetailsForm>({
    cardholderName: null,
    number: null,
    brand: null,
    expMonth: null,
    expYear: null,
    code: null,
  });

  /** Available Card Brands */
  readonly cardBrands = [
    { name: "-- " + this.i18nService.t("select") + " --", value: null },
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

  /** Local CardView, either created empty or set to the existing card instance  */
  private cardView: CardView;

  constructor(
    private cipherFormContainer: CipherFormContainer,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
  ) {
    this.cipherFormContainer.registerChildForm("cardDetails", this.cardDetailsForm);

    this.cardDetailsForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(({ cardholderName, number, brand, expMonth, expYear, code }) => {
        // The input[type="number"] is returning a number, convert it to a string
        // An empty field returns null, avoid casting `"null"` to a string
        const expirationYear = expYear !== null ? `${expYear}` : null;

        const patchedCard = Object.assign(this.cardView, {
          cardholderName,
          number,
          brand,
          expMonth,
          expYear: expirationYear,
          code,
        });

        this.cipherFormContainer.patchCipher({
          card: patchedCard,
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
    // If the original cipher has a card, use it. Otherwise, create a new card instance
    this.cardView = this.originalCipherView?.card ?? new CardView();

    if (this.originalCipherView?.card) {
      this.setInitialValues();
    }
  }

  /** Set form initial form values from the current cipher */
  private setInitialValues() {
    const { cardholderName, number, brand, expMonth, expYear, code } = this.originalCipherView.card;

    this.cardDetailsForm.setValue({
      cardholderName: cardholderName,
      number: number,
      brand: brand,
      expMonth: expMonth,
      expYear: expYear,
      code: code,
    });
  }
}
