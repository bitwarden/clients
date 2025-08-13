import { Pipe, PipeTransform } from "@angular/core";

import { BillingAddress } from "../types";

@Pipe({
  name: "address",
})
export class AddressPipe implements PipeTransform {
  transform(address: Omit<BillingAddress, "taxId">): string {
    const parts: string[] = [];

    if (address.line1) {
      parts.push(address.line1);
    }

    if (address.line2) {
      parts.push(address.line2);
    }

    if (address.city) {
      parts.push(address.city);
    }

    if (address.state) {
      parts.push(address.state);
    }

    parts.push(address.postalCode, address.country);

    return parts.join(", ");
  }
}
