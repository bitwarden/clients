// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import {
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

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
  @Input() cipherId: string;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private cipherService: CipherService,
  ) {}

  async openWebsite(selectedUri: string) {
    await this.cipherService.updateLastLaunchedDate(this.cipherId);
    this.platformUtilsService.launchUri(selectedUri);
  }
}
