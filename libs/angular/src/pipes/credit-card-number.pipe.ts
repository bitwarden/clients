import { Pipe, PipeTransform } from "@angular/core";

interface CardRuleEntry {
  cardLength: number;
  blocks: number[];
}

// See https://baymard.com/checkout-usability/credit-card-patterns for
// all possible credit card spacing patterns. For now, we just handle
// the below.
const numberFormats: Record<string, CardRuleEntry[]> = {
  Visa: [{ cardLength: 16, blocks: [4, 4, 4, 4] }],
  Mastercard: [{ cardLength: 16, blocks: [4, 4, 4, 4] }],
  Maestro: [
    { cardLength: 16, blocks: [4, 4, 4, 4] },
    { cardLength: 13, blocks: [4, 4, 5] },
    { cardLength: 15, blocks: [4, 6, 5] },
    { cardLength: 19, blocks: [4, 4, 4, 4, 3] },
  ],
  Discover: [{ cardLength: 16, blocks: [4, 4, 4, 4] }],
  "Diners Club": [{ cardLength: 14, blocks: [4, 6, 4] }],
  JCB: [{ cardLength: 16, blocks: [4, 4, 4, 4] }],
  UnionPay: [
    { cardLength: 16, blocks: [4, 4, 4, 4] },
    { cardLength: 19, blocks: [6, 13] },
  ],
  Amex: [{ cardLength: 15, blocks: [4, 6, 5] }],
  Other: [{ cardLength: 16, blocks: [4, 4, 4, 4] }],
};

@Pipe({
  name: "creditCardNumber",
  standalone: false,
})
export class CreditCardNumberPipe implements PipeTransform {
  transform(creditCardNumber: string, brand: string): string {
    let rules = numberFormats[brand];

    if (rules == null) {
      rules = numberFormats["Other"];
    }

    const cardLength = creditCardNumber.length;

    let matchingRule = rules.find((r) => r.cardLength == cardLength);
    if (matchingRule == null) {
      matchingRule = rules[0];
    }

    const blocks = matchingRule.blocks;

    const chunks: string[] = [];
    let total = 0;

    blocks.forEach((c) => {
      chunks.push(creditCardNumber.slice(total, total + c));
      total += c;
    });

    // Append the remaining part
    if (cardLength > total) {
      chunks.push(creditCardNumber.slice(total));
    }

    return chunks.join(" ");
  }
}
