import {
  Component,
  DestroyRef,
  effect,
  ElementRef,
  OnInit,
  signal,
  ViewChild,
  WritableSignal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

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

import { generateWiFiQRCode } from "../../../../../../../../libs/vault/src/utils/visual-vault-items";
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
export class VaultItemVisualizerComponent implements OnInit {
  constructor(
    private destroyRef: DestroyRef,
    private sanitizer: DomSanitizer,
  ) {
    effect(async () => {
      const values = this.dataToShareValues();
      if (typeof values !== "undefined") {
        const wiFiQRCode = await generateWiFiQRCode(values.fieldWithPassword, values.fieldWithSSID);
        this.wiFiQRCode.set(wiFiQRCode);
      }
    });
  }

  // TODO strings + translations
  headerText: string;
  private wiFiQRCode: WritableSignal<string> = signal("");

  dataToShareForm = new FormGroup({
    qrCodeType: new FormControl(""),
    fieldWithSSID: new FormControl(""),
    fieldWithPassword: new FormControl(""),
  });

  dataToShareValues = toSignal(this.dataToShareForm.valueChanges);

  sanitizeSVG(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.wiFiQRCode());
  }

  async ngOnInit() {
    // Set values in init triggers the QR Code generation effect
    this.dataToShareForm.setValue({
      qrCodeType: "Wi-Fi",
      fieldWithSSID: "Username",
      fieldWithPassword: "Password",
    });
  }
}
