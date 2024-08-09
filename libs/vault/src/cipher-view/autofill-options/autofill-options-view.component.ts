import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import {
  CardComponent,
  FormFieldModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
  IconButtonModule,
} from "@bitwarden/components";

import { TotpCaptureService } from "../../cipher-form";

@Component({
  selector: "app-autofill-options-view",
  templateUrl: "autofill-options-view.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    CardComponent,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    FormFieldModule,
    IconButtonModule,
  ],
})
export class AutofillOptionsViewComponent {
  @Input() loginUris: LoginUriView[];

  constructor(private totpCaptureService: TotpCaptureService) {}

  async openWebsite(selectedUri: string) {
    await this.totpCaptureService.openAutofillNewTab(selectedUri);
  }
}
