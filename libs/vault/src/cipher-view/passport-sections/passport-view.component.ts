import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input, signal } from "@angular/core";

import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PassportView } from "@bitwarden/common/vault/models/view/passport.view";
import {
  SectionHeaderComponent,
  TypographyModule,
  FormFieldModule,
  IconButtonModule,
  CopyClickDirective,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { CopyCipherFieldDirective } from "../../components/copy-cipher-field.directive";
import { ReadOnlyCipherCardComponent } from "../read-only-cipher-card/read-only-cipher-card.component";

@Component({
  selector: "app-passport-view",
  templateUrl: "passport-view.component.html",
  imports: [
    I18nPipe,
    CopyCipherFieldDirective,
    SectionHeaderComponent,
    ReadOnlyCipherCardComponent,
    TypographyModule,
    FormFieldModule,
    IconButtonModule,
    CopyClickDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PassportViewComponent {
  private readonly eventCollectionService = inject(EventCollectionService);
  private readonly datePipe = inject(DatePipe);

  readonly passport = input.required<PassportView>();
  readonly cipher = input.required<CipherView>();
  readonly revealPassportNumber = signal(false);
  readonly revealNationalIdentificationNumber = signal(false);

  async togglePassportNumberVisible(event: boolean) {
    this.revealPassportNumber.set(event);

    if (event) {
      await this.eventCollectionService.collect(
        EventType.Cipher_ClientToggledPassportNumberVisible,
        this.cipher().id,
        false,
        this.cipher().organizationId,
      );
    }
  }

  toggleNationalIdentificationNumberVisible(event: boolean) {
    this.revealNationalIdentificationNumber.set(event);
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) {
      return "";
    }

    const [year, month, day] = dateStr.split("-");

    if (year && month && day) {
      const date = new Date(+year, +month - 1, +day);
      return this.datePipe.transform(date, "longDate") ?? dateStr;
    }

    if (year && month) {
      const date = new Date(+year, +month - 1, 1);
      return this.datePipe.transform(date, "MMMM y") ?? dateStr;
    }

    return year ?? dateStr;
  }
}
