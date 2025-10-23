import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  IconButtonModule,
  CardComponent,
  InputModule,
  SectionHeaderComponent,
  TypographyModule,
  FormFieldModule,
} from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-additional-options",
  templateUrl: "additional-options.component.html",
  imports: [
    CommonModule,
    JslibModule,
    CardComponent,
    IconButtonModule,
    InputModule,
    SectionHeaderComponent,
    TypographyModule,
    FormFieldModule,
  ],
})
export class AdditionalOptionsComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() notes: string = "";
}
