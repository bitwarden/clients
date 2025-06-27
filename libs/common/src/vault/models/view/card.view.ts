// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { CardView as SdkCardView } from "@bitwarden/sdk-internal";

import { normalizeExpiryYearFormat } from "../../../autofill/utils";
import { CardLinkedId as LinkedId } from "../../enums";
import { linkedFieldOption } from "../../linked-field-option.decorator";

import { ItemView } from "./item.view";

export class CardView extends ItemView implements SdkCardView {
  @linkedFieldOption(LinkedId.CardholderName, { sortPosition: 0 })
  cardholderName: string = null;
  @linkedFieldOption(LinkedId.ExpMonth, { sortPosition: 3, i18nKey: "expirationMonth" })
  expMonth: string = null;
  @linkedFieldOption(LinkedId.ExpYear, { sortPosition: 4, i18nKey: "expirationYear" })
  expYear: string = null;
  @linkedFieldOption(LinkedId.Code, { sortPosition: 5, i18nKey: "securityCode" })
  code: string = null;

  private _brand: string = null;
  private _number: string = null;
  private _subTitle: string = null;

  get maskedCode(): string {
    return this.code != null ? "•".repeat(this.code.length) : null;
  }

  get maskedNumber(): string {
    return this.number != null ? "•".repeat(this.number.length) : null;
  }

  @linkedFieldOption(LinkedId.Brand, { sortPosition: 2 })
  get brand(): string {
    return this._brand;
  }
  set brand(value: string) {
    this._brand = value;
    this._subTitle = null;
  }

  @linkedFieldOption(LinkedId.Number, { sortPosition: 1 })
  get number(): string {
    return this._number;
  }
  set number(value: string) {
    this._number = value;
    this._subTitle = null;
  }

  get subTitle(): string {
    if (this._subTitle == null) {
      this._subTitle = this.brand;
      if (this.number != null && this.number.length >= 4) {
        if (this._subTitle != null && this._subTitle !== "") {
          this._subTitle += ", ";
        } else {
          this._subTitle = "";
        }

        // Show last 5 on amex, last 4 for all others
        const count =
          this.number.length >= 5 && this.number.match(new RegExp("^3[47]")) != null ? 5 : 4;
        this._subTitle += "*" + this.number.substr(this.number.length - count);
      }
    }
    return this._subTitle;
  }

  get expiration(): string {
    const normalizedYear = normalizeExpiryYearFormat(this.expYear);

    if (!this.expMonth && !normalizedYear) {
      return null;
    }

    let exp = this.expMonth != null ? ("0" + this.expMonth).slice(-2) : "__";
    exp += " / " + (normalizedYear || "____");

    return exp;
  }

  static fromJSON(obj: Partial<Jsonify<CardView>>): CardView {
    return Object.assign(new CardView(), obj);
  }

  // ref https://stackoverflow.com/a/5911300
  static getCardBrandByPatterns(cardNum: string): string {
    if (cardNum == null || typeof cardNum !== "string" || cardNum.trim() === "") {
      return null;
    }

    // Visa
    let re = new RegExp("^4");
    if (cardNum.match(re) != null) {
      return "Visa";
    }

    // Mastercard
    // Updated for Mastercard 2017 BINs expansion
    if (
      /^(5[1-5][0-9]{14}|2(22[1-9][0-9]{12}|2[3-9][0-9]{13}|[3-6][0-9]{14}|7[0-1][0-9]{13}|720[0-9]{12}))$/.test(
        cardNum,
      )
    ) {
      return "Mastercard";
    }

    // AMEX
    re = new RegExp("^3[47]");
    if (cardNum.match(re) != null) {
      return "Amex";
    }

    // Discover
    re = new RegExp(
      "^(6011|622(12[6-9]|1[3-9][0-9]|[2-8][0-9]{2}|9[0-1][0-9]|92[0-5]|64[4-9])|65)",
    );
    if (cardNum.match(re) != null) {
      return "Discover";
    }

    // Diners
    re = new RegExp("^36");
    if (cardNum.match(re) != null) {
      return "Diners Club";
    }

    // Diners - Carte Blanche
    re = new RegExp("^30[0-5]");
    if (cardNum.match(re) != null) {
      return "Diners Club";
    }

    // JCB
    re = new RegExp("^35(2[89]|[3-8][0-9])");
    if (cardNum.match(re) != null) {
      return "JCB";
    }

    // Visa Electron
    re = new RegExp("^(4026|417500|4508|4844|491(3|7))");
    if (cardNum.match(re) != null) {
      return "Visa";
    }

    return null;
  }

  /**
   * Converts an SDK CardView to a CardView.
   */
  static fromSdkCardView(obj: SdkCardView): CardView | undefined {
    if (obj == null) {
      return undefined;
    }

    const cardView = new CardView();

    cardView.cardholderName = obj.cardholderName ?? null;
    cardView.brand = obj.brand ?? null;
    cardView.number = obj.number ?? null;
    cardView.expMonth = obj.expMonth ?? null;
    cardView.expYear = obj.expYear ?? null;
    cardView.code = obj.code ?? null;

    return cardView;
  }

  /**
   * Converts the CardView to an SDK CardView.
   * The view implements the SdkView so we can safely return `this`
   */
  toSdkCardView(): SdkCardView {
    return this;
  }
}
