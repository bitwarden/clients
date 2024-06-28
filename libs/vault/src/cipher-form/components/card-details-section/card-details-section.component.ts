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
  cardholderName: string;
  number: string;
  brand: string;
  expMonth: string;
  expYear: string;
  code: string;
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

  readonly cardBrands = [
    { name: " ", value: null },
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
        const patchedCard = Object.assign(this.cardView, {
          cardholderName,
          number,
          brand,
          expMonth,
          expYear,
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
