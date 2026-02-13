// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, computed, DestroyRef, inject, input, OnInit, signal } from "@angular/core";
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
  CheckboxModule,
  FormFieldModule,
  IconButtonModule,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";
import { generate_ssh_key } from "@bitwarden/sdk-internal";

import { SshImportPromptService } from "../../../services/ssh-import-prompt.service";
import { SshAgentKeySettings } from "../../abstractions/ssh-agent-settings";
import { CipherFormContainer } from "../../cipher-form-container";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-sshkey-section",
  templateUrl: "./sshkey-section.component.html",
  imports: [
    CardComponent,
    CheckboxModule,
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
  readonly originalCipherView = input<CipherView | null>(null);

  readonly disabled = input(false);

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

  readonly showImport = computed(() => {
    return (
      // Web does not support clipboard access
      this.platformUtilsService.getClientType() !== ClientType.Web &&
      this.originalCipherView()?.edit
    );
  });

  private sshAgentKeySettings = inject(SshAgentKeySettings, { optional: true });
  readonly showSshAgentToggle = signal(false);
  readonly sshAgentEnabled = signal(false);

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
    const prefillCipher = this.cipherFormContainer.getInitialCipherView();
    const sshKeyView = prefillCipher?.sshKey ?? this.originalCipherView()?.sshKey;

    if (sshKeyView) {
      this.setInitialValues(sshKeyView);
    } else {
      await this.generateSshKey();
    }

    this.sshKeyForm.disable();

    // Disable the form if the cipher form container is enabled
    // to prevent user interaction
    this.cipherFormContainer.formStatusChange$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => {
        if (status === "enabled") {
          this.sshKeyForm.disable();
        }
      });

    // Initialize SSH agent toggle if the service is available
    if (this.sshAgentKeySettings) {
      this.showSshAgentToggle.set(true);
      const cipherId = this.originalCipherView()?.id;
      if (cipherId) {
        // Existing cipher: load current setting
        this.sshAgentKeySettings
          .isKeyEnabledForAgent$(cipherId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((enabled) => {
            this.sshAgentEnabled.set(enabled);
          });
      } else {
        // New cipher: save the setting after the cipher is created
        this.cipherFormContainer.cipherSaved$
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((savedCipher) => {
            if (savedCipher?.id && this.sshAgentEnabled()) {
              void this.sshAgentKeySettings.setKeyEnabledForAgent(savedCipher.id, true);
            }
          });
      }
    }
  }

  /** Set form initial form values from the current cipher */
  private setInitialValues(sshKeyView: SshKeyView) {
    const { privateKey, publicKey, keyFingerprint } = sshKeyView;

    this.sshKeyForm.setValue({
      privateKey,
      publicKey,
      keyFingerprint,
    });
  }

  async toggleSshAgent() {
    const newValue = !this.sshAgentEnabled();
    this.sshAgentEnabled.set(newValue);
    const cipherId = this.originalCipherView()?.id;
    if (this.sshAgentKeySettings && cipherId) {
      await this.sshAgentKeySettings.setKeyEnabledForAgent(cipherId, newValue);
    }
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
