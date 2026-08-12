// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, computed, input, OnInit, Optional } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SshKeyView } from "@bitwarden/common/vault/models/view/ssh-key.view";
import {
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";
import { generate_ssh_key } from "@bitwarden/sdk-internal";

import { SshImportPromptService } from "../../../services/ssh-import-prompt.service";
import { SshAgentDestinationSettingsService } from "../../abstractions/ssh-agent-destination-settings.service";
import { CipherFormContainer } from "../../cipher-form-container";

import {
  normalizeSshAgentDestinationFingerprints,
  sshAgentDestinationFingerprintValidator,
} from "./ssh-agent-destination-fingerprint.util";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
    LinkModule,
    JslibModule,
    CommonModule,
  ],
})
export class SshKeySectionComponent implements OnInit {
  readonly originalCipherView = input<CipherView | null>(null);

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
      // null means a new cipher is being created, which always has edit access
      (this.originalCipherView() == null || this.originalCipherView()!.edit)
    );
  });

  /**
   * Whether the "SSH agent destinations" section should render. Only true on platforms that
   * provide {@link SshAgentDestinationSettingsService} (currently Desktop only).
   */
  readonly showDestinationSettings = this.destinationSettings != null;

  /**
   * Local form for destination host-key fingerprints. Registered with
   * {@link CipherFormContainer.registerChildForm} so an invalid fingerprint blocks Save like any
   * other form section — but its values are never patched into the cipher (no `patchCipher` call
   * here). Destination data is Desktop-local and reaches storage only through
   * {@link SshAgentDestinationSettingsService}, on save, never as part of the synced cipher.
   */
  destinationsForm = this.formBuilder.group({
    fingerprints: new FormArray<FormControl<string>>([]),
  });

  get fingerprints(): FormArray<FormControl<string>> {
    return this.destinationsForm.controls.fingerprints;
  }

  constructor(
    private cipherFormContainer: CipherFormContainer,
    private formBuilder: FormBuilder,
    private sdkService: SdkService,
    private sshImportPromptService: SshImportPromptService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    @Optional() private destinationSettings?: SshAgentDestinationSettingsService,
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

    if (this.destinationSettings) {
      // Registering (not patching) makes an invalid fingerprint block Save via the parent
      // cipherForm's aggregated validity, without the destination values ever entering the
      // synced cipher.
      this.cipherFormContainer.registerChildForm("sshAgentDestinations", this.destinationsForm);

      // Destinations follow the form's own Save/Cancel semantics: edits only touch local form
      // state, and are persisted exactly once per successful save — for a new cipher this is the
      // first time an ID exists; for an existing cipher, every subsequent save persists again.
      // Editing keystrokes never call the agent-destinations service directly, so the native
      // agent's key list isn't reloaded on every keystroke.
      this.cipherFormContainer.cipherSaved$.pipe(takeUntilDestroyed()).subscribe((savedCipher) => {
        if (savedCipher?.id != null) {
          this.persistDestinationFingerprints(savedCipher.id as CipherId);
        }
      });
    }
  }

  async ngOnInit() {
    const prefillCipher = this.cipherFormContainer.getInitialCipherView();
    const sshKeyView = prefillCipher?.sshKey ?? this.originalCipherView()?.sshKey;

    if (sshKeyView) {
      this.setInitialValues(sshKeyView);
    } else {
      await this.generateSshKey();
    }

    if (this.destinationSettings) {
      const cipherId = (prefillCipher?.id ?? this.originalCipherView()?.id) as CipherId | undefined;

      if (cipherId != null) {
        const fingerprints = await firstValueFrom(
          this.destinationSettings.destinationFingerprints$(cipherId),
        );
        fingerprints.forEach((fingerprint) => this.addDestinationRow(fingerprint));
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

  /** Adds a destination fingerprint row. */
  addDestinationRow(value = "") {
    this.fingerprints.push(
      this.formBuilder.control(value, {
        nonNullable: true,
        validators: [
          sshAgentDestinationFingerprintValidator(
            this.i18nService.t("invalidSshAgentDestinationFingerprint"),
          ),
        ],
      }),
    );
  }

  removeDestinationRow(index: number) {
    this.fingerprints.removeAt(index);
  }

  /** Persists the current fingerprint set for `cipherId`, unless a row is invalid. */
  private persistDestinationFingerprints(cipherId: CipherId) {
    if (this.destinationSettings == null || this.fingerprints.invalid) {
      return;
    }

    const normalized = normalizeSshAgentDestinationFingerprints(this.fingerprints.value);
    void this.destinationSettings.setDestinationFingerprints(cipherId, normalized);
  }
}
