// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  SectionHeaderComponent,
  TypographyModule,
  FormFieldModule,
  IconButtonModule,
} from "@bitwarden/components";

import { ReadOnlyCipherCardComponent } from "../read-only-cipher-card/read-only-cipher-card.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-card-details-view",
  templateUrl: "card-details-view.component.html",
  imports: [
    CommonModule,
    JslibModule,
    SectionHeaderComponent,
    TypographyModule,
    FormFieldModule,
    IconButtonModule,
    ReadOnlyCipherCardComponent,
  ],
})
export class CardDetailsComponent implements OnChanges {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() cipher: CipherView;
  EventType = EventType;

  revealCardNumber: boolean = false;
  revealCardCode: boolean = false;

  constructor(
    private i18nService: I18nService,
    private eventCollectionService: EventCollectionService,
  ) {}

  get card() {
    return this.cipher.card;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["cipher"]) {
      this.revealCardNumber = false;
      this.revealCardCode = false;
    }
  }

  get setSectionTitle() {
    if (this.card.brand && this.card.brand !== "Other") {
      return this.i18nService.t("cardBrandDetails", this.card.brand);
    }
    return this.i18nService.t("cardDetails");
  }

  async logCardEvent(conditional: boolean, event: EventType) {
    if (event === EventType.Cipher_ClientToggledCardNumberVisible) {
      this.revealCardNumber = conditional;
    } else if (event === EventType.Cipher_ClientToggledCardCodeVisible) {
      this.revealCardCode = conditional;
    }
    if (conditional) {
      await this.eventCollectionService.collect(
        event,
        this.cipher.id,
        false,
        this.cipher.organizationId,
      );
    }
  }
}
