import { CommonModule, DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input, signal } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DriversLicenseView } from "@bitwarden/common/vault/models/view/drivers-license.view";
import {
  FormFieldModule,
  IconButtonModule,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { CopyCipherFieldDirective } from "../../components/copy-cipher-field.directive";
import { ReadOnlyCipherCardComponent } from "../read-only-cipher-card/read-only-cipher-card.component";

@Component({
  selector: "app-drivers-license-view",
  templateUrl: "drivers-license-view.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DatePipe],
  imports: [
    CommonModule,
    JslibModule,
    SectionHeaderComponent,
    ReadOnlyCipherCardComponent,
    TypographyModule,
    FormFieldModule,
    IconButtonModule,
    CopyCipherFieldDirective,
  ],
})
export class DriversLicenseViewComponent {
  private readonly eventCollectionService = inject(EventCollectionService);
  private readonly datePipe = inject(DatePipe);

  readonly driversLicense = input.required<DriversLicenseView>();
  readonly cipher = input.required<CipherView>();
  readonly revealLicenseNumber = signal(false);

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) {
      return "";
    }

    const [year, month, day] = dateStr.split("-");

    if (year && month && day) {
      const date = new Date(+year, +month - 1, +day);
      return this.datePipe.transform(date, "longDate") ?? "";
    }

    return dateStr;
  }

  async toggleLicenseNumberVisible(visible: boolean) {
    this.revealLicenseNumber.set(visible);
    if (visible) {
      await this.eventCollectionService.collect(
        EventType.Cipher_ClientToggledLicenseNumberVisible,
        this.cipher().id,
        false,
        this.cipher().organizationId,
      );
    }
  }
}
