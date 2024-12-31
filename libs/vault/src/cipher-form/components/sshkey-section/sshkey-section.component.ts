// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { lastValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CardComponent,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { SshKeyPasswordPromptComponent } from "@bitwarden/importer/ui";
import { SshKeyImportError, import_ssh_key } from "@bitwarden/sdk-internal";

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
    private toastService: ToastService,
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
    private dialogService: DialogService,
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

  async importSshKeyFromClipboard(password: string = "") {
    const key = await this.platformUtilsService.readFromClipboard();
    try {
      const parsedKey = import_ssh_key(key, password);
      if (parsedKey == null) {
        this.toastService.showToast({
          variant: "error",
          title: "",
          message: this.i18nService.t("invalidSshKey"),
        });
        return;
      }
      this.sshKeyForm.setValue({
        privateKey: parsedKey.private_key,
        publicKey: parsedKey.public_key,
        keyFingerprint: parsedKey.key_fingerprint,
      });

      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("sshKeyPasted"),
      });
    } catch (e) {
      const error = e as SshKeyImportError;
      switch (error.variant) {
        case "ParsingError":
          this.toastService.showToast({
            variant: "error",
            title: "",
            message: this.i18nService.t("invalidSshKey"),
          });
          break;
        case "UnsupportedKeyType":
          this.toastService.showToast({
            variant: "error",
            title: "",
            message: this.i18nService.t("sshKeyTypeUnsupported"),
          });
          break;
        case "PasswordRequired":
        case "WrongPassword":
          if (password !== "") {
            this.toastService.showToast({
              variant: "error",
              title: "",
              message: this.i18nService.t("sshKeyWrongPassword"),
            });
          } else {
            password = await this.getSshKeyPassword();
            await this.importSshKeyFromClipboard(password);
          }
          break;
      }

      this.logService.info("Failed to import SSH key from clipboard", e);
    }
  }

  async getSshKeyPassword(): Promise<string> {
    const dialog = this.dialogService.open<string>(SshKeyPasswordPromptComponent, {
      ariaModal: true,
    });

    return await lastValueFrom(dialog.closed);
  }
}
