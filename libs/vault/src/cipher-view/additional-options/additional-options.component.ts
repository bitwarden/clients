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
  @Input() notes: string = "";
}
