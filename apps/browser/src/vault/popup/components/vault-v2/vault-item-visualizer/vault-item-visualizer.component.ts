import { Component, DestroyRef, ElementRef, OnInit, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
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
  constructor(private destroyRef: DestroyRef) {}

  @ViewChild("visualizer", { static: true }) canvas: ElementRef<HTMLCanvasElement>;

  ctx: CanvasRenderingContext2D;
  headerText: string;
  wiFiQRCode: string;

  dataToShare = new FormGroup({
    qrCodeType: new FormControl("Wi-Fi"),
    fieldWithSSID: new FormControl("Username"),
    fieldWithPassword: new FormControl("Password"),
  });

  async ngOnInit() {
    // TODO use IMG or ideally SVG (scalable)
    this.ctx = this.canvas.nativeElement.getContext("2d");

    await this.renderVisualization();

    this.dataToShare.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((values) => {
      void this.renderVisualization();
      console.log(values);
    });
  }

  async renderVisualization() {
    this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    // TODO: get the value from the cipher instead of using the form value
    this.wiFiQRCode = await generateWiFiQRCode(
      this.dataToShare.controls.fieldWithSSID.value,
      this.dataToShare.controls.fieldWithPassword.value,
    );
    const img = new Image();
    img.onload = () => {
      this.ctx.drawImage(img, 0, 0);
    };
    img.src = this.wiFiQRCode;
  }
}
