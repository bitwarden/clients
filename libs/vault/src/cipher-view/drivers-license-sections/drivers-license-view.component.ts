import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, signal } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DriversLicenseView } from "@bitwarden/common/vault/models/view/drivers-license.view";
import {
  CopyClickDirective,
  FormFieldModule,
  IconButtonModule,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { ReadOnlyCipherCardComponent } from "../read-only-cipher-card/read-only-cipher-card.component";

@Component({
  selector: "app-drivers-license-view",
  templateUrl: "drivers-license-view.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    JslibModule,
    SectionHeaderComponent,
    ReadOnlyCipherCardComponent,
    TypographyModule,
    FormFieldModule,
    IconButtonModule,
    CopyClickDirective,
  ],
})
export class DriversLicenseViewComponent {
  readonly driversLicense = input.required<DriversLicenseView>();
  readonly revealLicenseNumber = signal(false);
}
