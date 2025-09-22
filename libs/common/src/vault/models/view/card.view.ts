import { Jsonify } from "type-fest";

import { CardView as SdkCardView } from "@bitwarden/sdk-internal";

import { normalizeExpiryYearFormat } from "../../../autofill/utils";
import { CardLinkedId as LinkedId } from "../../enums";
import { linkedFieldOption } from "../../linked-field-option.decorator";

import { ItemView } from "./item.view";

export class CardView extends ItemView implements SdkCardView {
  @linkedFieldOption(LinkedId.CardholderName, { sortPosition: 0 })
  cardholderName: string | undefined;
  @linkedFieldOption(LinkedId.ExpMonth, { sortPosition: 3, i18nKey: "expirationMonth" })
  expMonth: string | undefined;
  @linkedFieldOption(LinkedId.ExpYear, { sortPosition: 4, i18nKey: "expirationYear" })
  expYear: string | undefined;
  @linkedFieldOption(LinkedId.Code, { sortPosition: 5, i18nKey: "securityCode" })
  code: string | undefined;

  private _brand?: string;
  private _number?: string;
  private _subTitle?: string;

  get maskedCode(): string | undefined {
    return this.code != null ? "•".repeat(this.code.length) : undefined;
  }

  get maskedNumber(): string | undefined {
    return this.number != null ? "•".repeat(this.number.length) : undefined;
  }

  @linkedFieldOption(LinkedId.Brand, { sortPosition: 2 })
  get brand(): string | undefined {
    return this._brand;
  }
  set brand(value: string | undefined) {
    this._brand = value;
    this._subTitle = undefined;
  }

  @linkedFieldOption(LinkedId.Number, { sortPosition: 1 })
  get number(): string | undefined {
    return this._number;
  }
  set number(value: string | undefined) {
    this._number = value;
    this._subTitle = undefined;
  }

  get subTitle(): string | undefined {
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

  get expiration(): string | undefined {
    const normalizedYear = this.expYear ? normalizeExpiryYearFormat(this.expYear) : undefined;

    if (!this.expMonth && !normalizedYear) {
      return undefined;
    }

    let exp = this.expMonth != null ? ("0" + this.expMonth).slice(-2) : "__";
    exp += " / " + (normalizedYear || "____");

    return exp;
  }

  static fromJSON(obj: Partial<Jsonify<CardView>> | undefined): CardView {
    return Object.assign(new CardView(), obj);
  }

  // ref https://stackoverflow.com/a/5911300
  static getCardBrandByPatterns(cardNum: string | undefined | null): string | undefined {
    if (cardNum == null || typeof cardNum !== "string" || cardNum.trim() === "") {
      return undefined;
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

    return undefined;
  }

  /**
   * Converts an SDK CardView to a CardView.
   */
  static fromSdkCardView(obj: SdkCardView): CardView {
    const cardView = new CardView();

    cardView.cardholderName = obj.cardholderName;
    cardView.brand = obj.brand;
    cardView.number = obj.number;
    cardView.expMonth = obj.expMonth;
    cardView.expYear = obj.expYear;
    cardView.code = obj.code;

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
