import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";

import { CipherFormContainer } from "../../cipher-form-container";

@Component({
  selector: "vault-sshkey-section",
  templateUrl: "./sshkey-section.component.html",
  standalone: true,
  imports: [
    CardComponent,
    SectionComponent,
    TypographyModule,
    FormFieldModule,
    ReactiveFormsModule,
    SelectModule,
    SectionHeaderComponent,
    IconButtonModule,
    JslibModule,
    CommonModule,
  ],
})
export class SshKeySectionComponent implements OnInit {
  /** The original cipher */
  @Input() originalCipherView: CipherView;

  /** True when all fields should be disabled */
  @Input() disabled: boolean;

  /**
   * All form fields associated with the ssh key
   *
   * Note: `as` is used to assert the type of the form control,
   * leaving as just null gets inferred as `unknown`
   */
  sshKeyForm = this.formBuilder.group({
    privateKey: null as string | null,
    publicKey: null as string | null,
    keyFingerprint: null as string | null,
  });

  constructor(
    private cipherFormContainer: CipherFormContainer,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
  ) {}

  ngOnInit() {
    if (this.originalCipherView?.card) {
      this.setInitialValues();
    }

    this.sshKeyForm.disable();
  }

  /** Set form initial form values from the current cipher */
  private setInitialValues() {
    const { privateKey, publicKey, keyFingerprint } = this.originalCipherView.sshKey;

    this.sshKeyForm.setValue({
      privateKey,
      publicKey,
      keyFingerprint,
    });
  }
}
