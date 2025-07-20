import { NgIf } from "@angular/common";
import { Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  FormFieldModule,
  IconButtonModule,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { ReadOnlyCipherCardComponent } from "../read-only-cipher-card/read-only-cipher-card.component";

@Component({
  selector: "app-view-identity-sections",
  templateUrl: "./view-identity-sections.component.html",
  imports: [
    NgIf,
    JslibModule,
    SectionHeaderComponent,
    TypographyModule,
    FormFieldModule,
    IconButtonModule,
    ReadOnlyCipherCardComponent,
  ],
})
export class ViewIdentitySectionsComponent {
  @Input({ required: true }) cipher: CipherView | null = null;

  /** Returns all populated address fields */
  get addressFields(): string {
    if (!this.cipher) {
      return "";
    }

    const { address1, address2, address3, fullAddressPart2, country } = this.cipher.identity;
    return [address1, address2, address3, fullAddressPart2, country].filter(Boolean).join("\n");
  }

  /** Returns the number of "rows" that should be assigned to the address textarea */
  get addressRows(): number {
    return this.addressFields.split("\n").length;
  }

  /** Returns true when any of the "personal detail" attributes are populated */
  get hasPersonalDetails(): boolean {
    if (!this.cipher) {
      return false;
    }

    const { username, company, fullName } = this.cipher.identity;
    return Boolean(fullName || username || company);
  }

  /** Returns true when any of the "identification detail" attributes are populated */
  get hasIdentificationDetails(): boolean {
    if (!this.cipher) {
      return false;
    }

    const { ssn, passportNumber, licenseNumber } = this.cipher.identity;
    return Boolean(ssn || passportNumber || licenseNumber);
  }

  /** Returns true when any of the "contact detail" attributes are populated */
  get hasContactDetails(): boolean {
    if (!this.cipher) {
      return false;
    }

    const { email, phone } = this.cipher.identity;

    return Boolean(email || phone || this.addressFields);
  }
}
