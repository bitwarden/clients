import { Component } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";

import {
  TypographyModule,
  ButtonModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  CardComponent,
  FormFieldModule,
  SelectModule,
} from "@bitwarden/components";

import { PopupFooterComponent } from "../../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";

@Component({
  imports: [
    ReactiveFormsModule,
    TypographyModule,
    ButtonModule,
    ItemModule,
    SectionComponent,
    SectionHeaderComponent,
    CardComponent,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    FormsModule,
    FormFieldModule,
    SelectModule,
  ],
  standalone: true,
  templateUrl: "./vault-item-visualizer.component.html",
})
export class VaultItemVisualizerComponent {
  headerText: string;

  dataToShare = new FormGroup({
    qrCodeType: new FormControl("Wi-Fi"),
    fieldWithSSID: new FormControl("Username"),
    fieldWithPassword: new FormControl("Password"),
  });
}
