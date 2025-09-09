// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, DestroyRef, inject, Input, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ClientType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SshKeyView } from "@bitwarden/common/vault/models/view/ssh-key.view";
import {
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";
import { generate_ssh_key } from "@bitwarden/sdk-internal";

import { SshImportPromptService } from "../../../services/ssh-import-prompt.service";
import { CipherFormContainer } from "../../cipher-form-container";

@Component({
  selector: "vault-sshkey-section",
  templateUrl: "./sshkey-section.component.html",
  imports: [
    CardComponent,
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
    privateKey: [""],
    publicKey: [""],
    keyFingerprint: [""],
  });

  showImport = false;
  private destroyRef = inject(DestroyRef);

  constructor(
    private cipherFormContainer: CipherFormContainer,
    private formBuilder: FormBuilder,
    private sdkService: SdkService,
    private sshImportPromptService: SshImportPromptService,
    private platformUtilsService: PlatformUtilsService,
  ) {
    this.cipherFormContainer.registerChildForm("sshKeyDetails", this.sshKeyForm);
    this.sshKeyForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const data = new SshKeyView();
      data.privateKey = value.privateKey;
      data.publicKey = value.publicKey;
      data.keyFingerprint = value.keyFingerprint;
      this.cipherFormContainer.patchCipher((cipher) => {
        cipher.sshKey = data;
        return cipher;
      });
    });
  }

  async ngOnInit() {
    if (this.originalCipherView?.sshKey) {
      this.setInitialValues();
    } else {
      await this.generateSshKey();
    }

    this.sshKeyForm.disable();

    // Web does not support clipboard access
    if (this.platformUtilsService.getClientType() !== ClientType.Web) {
      this.showImport = true;
    }

    // Disable the form if the cipher form container is enabled
    // to prevent user interaction
    this.cipherFormContainer.formStatusChange$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => {
        if (status === "enabled") {
          this.sshKeyForm.disable();
        }
      });
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

  async importSshKeyFromClipboard() {
    const key = await this.sshImportPromptService.importSshKeyFromClipboard();
    if (key != null) {
      this.sshKeyForm.setValue({
        privateKey: key.privateKey,
        publicKey: key.publicKey,
        keyFingerprint: key.keyFingerprint,
      });
    }
  }

  private async generateSshKey() {
    await firstValueFrom(this.sdkService.client$);
    const sshKey = generate_ssh_key("Ed25519");
    this.sshKeyForm.setValue({
      privateKey: sshKey.privateKey,
      publicKey: sshKey.publicKey,
      keyFingerprint: sshKey.fingerprint,
    });
  }
}
