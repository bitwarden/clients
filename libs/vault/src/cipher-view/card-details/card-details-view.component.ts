// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CardComponent,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
  FormFieldModule,
  IconButtonModule,
} from "@bitwarden/components";

import { ReadOnlyCipherCardComponent } from "../read-only-cipher-card/read-only-cipher-card.component";

@Component({
  selector: "app-card-details-view",
  templateUrl: "card-details-view.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    CardComponent,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    FormFieldModule,
    IconButtonModule,
    ReadOnlyCipherCardComponent,
  ],
})
export class CardDetailsComponent {
  @Input() cipher: CipherView;
  EventType = EventType;

  constructor(
    private i18nService: I18nService,
    private eventCollectionService: EventCollectionService,
  ) {}

  get card() {
    return this.cipher.card;
  }

  get setSectionTitle() {
    if (this.card.brand && this.card.brand !== "Other") {
      return this.i18nService.t("cardBrandDetails", this.card.brand);
    }
    return this.i18nService.t("cardDetails");
  }

  async logCardEvent(conditional: boolean, event: EventType) {
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
