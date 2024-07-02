import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  IconButtonModule,
  CardComponent,
  InputModule,
  SectionComponent,
  SectionHeaderComponent,
} from "@bitwarden/components";

@Component({
  selector: "app-additional-information",
  templateUrl: "additional-information.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    CardComponent,
    IconButtonModule,
    InputModule,
    SectionComponent,
    SectionHeaderComponent,
  ],
})
export class AdditionalInformationComponent {
  @Input() notes: string;

  constructor() {}
}
