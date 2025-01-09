import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  IconButtonModule,
  CardComponent,
  InputModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
  FormFieldModule,
} from "@bitwarden/components";

@Component({
  selector: "app-additional-options",
  templateUrl: "additional-options.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    CardComponent,
    IconButtonModule,
    InputModule,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    FormFieldModule,
  ],
})
export class AdditionalOptionsComponent {
  @Input() notes: string = "";
}
