// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
  inject,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  AsyncActionsModule,
  BitSubmitDirective,
  ButtonComponent,
  ButtonModule,
  CardComponent,
  ItemModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";

import { DownloadAttachmentComponent } from "../../../components/download-attachment/download-attachment.component";

import { DeleteAttachmentComponent } from "./delete-attachment/delete-attachment.component";

type CipherAttachmentForm = FormGroup<{
  file: FormControl<File | null>;
}>;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-cipher-attachments",
  templateUrl: "./cipher-attachments.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CommonModule,
    ItemModule,
    JslibModule,
    ReactiveFormsModule,
    TypographyModule,
    CardComponent,
    DeleteAttachmentComponent,
    DownloadAttachmentComponent,
  ],
})
export class CipherAttachmentsComponent implements OnInit, AfterViewInit {
  /** `id` associated with the form element */
  static attachmentFormID = "attachmentForm";

  /** Reference to the file HTMLInputElement */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("fileInput", { read: ElementRef }) private fileInput: ElementRef<HTMLInputElement>;

  /** Reference to the BitSubmitDirective */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(BitSubmitDirective) bitSubmit: BitSubmitDirective;

  /** The `id` of the cipher in context */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true }) cipherId: CipherId;

  /** The organization ID if this cipher belongs to an organization */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() organizationId?: OrganizationId;

  /** Denotes if the action is occurring from within the admin console */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() admin: boolean = false;

  /** An optional submit button, whose loading/disabled state will be tied to the form state. */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() submitBtn?: ButtonComponent;

  /** Emits after a file has been successfully uploaded */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onUploadSuccess = new EventEmitter<void>();

  /** Emits after a file has been successfully removed */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onRemoveSuccess = new EventEmitter<void>();

  organization: Organization;
  cipher: CipherView;

  attachmentForm: CipherAttachmentForm = this.formBuilder.group({
    file: new FormControl<File>(null, [Validators.required]),
  });

  private cipherDomain: Cipher;
  private activeUserId: UserId;
  private destroy$ = inject(DestroyRef);

  constructor(
    private cipherService: CipherService,
    private i18nService: I18nService,
    private formBuilder: FormBuilder,
    private logService: LogService,
    private toastService: ToastService,
    private accountService: AccountService,
    private apiService: ApiService,
    private organizationService: OrganizationService,
  ) {
    this.attachmentForm.statusChanges.pipe(takeUntilDestroyed()).subscribe((status) => {
      if (!this.submitBtn) {
        return;
      }

      this.submitBtn.disabled.set(status !== "VALID");
    });
  }

  async ngOnInit(): Promise<void> {
    this.activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    // Get the organization to check admin permissions
    this.organization = await this.getOrganization();
    this.cipherDomain = await this.getCipher(this.cipherId);

    this.cipher = await this.cipherService.decrypt(this.cipherDomain, this.activeUserId);

    // Update the initial state of the submit button
    if (this.submitBtn) {
      this.submitBtn.disabled.set(!this.attachmentForm.valid);
    }
  }

  ngAfterViewInit(): void {
    this.bitSubmit.loading$.pipe(takeUntilDestroyed(this.destroy$)).subscribe((loading) => {
      if (!this.submitBtn) {
        return;
      }

      this.submitBtn.loading.set(loading);
    });

    this.bitSubmit.disabled$.pipe(takeUntilDestroyed(this.destroy$)).subscribe((disabled) => {
      if (!this.submitBtn) {
        return;
      }

      this.submitBtn.disabled.set(disabled);
    });
  }

  /** Reference the `id` via the static property */
  get attachmentFormId(): string {
    return CipherAttachmentsComponent.attachmentFormID;
  }

  /** Updates the form value when a file is selected */
  onFileChange(event: Event): void {
    const fileInputEl = event.target as HTMLInputElement;

    if (fileInputEl.files && fileInputEl.files.length > 0) {
      this.attachmentForm.controls.file.setValue(fileInputEl.files[0]);
    }
  }

  /** Save the attachments to the cipher */
  submit = async () => {
    const file = this.attachmentForm.value.file;
    if (file === null) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("selectFile"),
      });
      return;
    }

    if (file.size > 524288000) {
      // 500 MB
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("maxFileSize"),
      });
      return;
    }

    try {
      this.cipherDomain = await this.cipherService.saveAttachmentWithServer(
        this.cipherDomain,
        file,
        this.activeUserId,
        this.organization?.canEditAllCiphers,
      );

      // re-decrypt the cipher to update the attachments
      this.cipher = await this.cipherService.decrypt(this.cipherDomain, this.activeUserId);

      // Reset reactive form and input element
      this.fileInput.nativeElement.value = "";
      this.attachmentForm.controls.file.setValue(null);

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("attachmentSaved"),
      });

      this.onUploadSuccess.emit();
    } catch (e) {
      this.logService.error(e);

      // Extract error message from server response, fallback to generic message
      let errorMessage = this.i18nService.t("unexpectedError");
      if (typeof e === "string") {
        errorMessage = e;
      } else if (e?.message) {
        errorMessage = e.message;
      }

      this.toastService.showToast({
        variant: "error",
        message: errorMessage,
      });
    }
  };

  /** Removes the attachment from the cipher */
  removeAttachment(attachment: AttachmentView) {
    const index = this.cipher.attachments.indexOf(attachment);

    if (index > -1) {
      this.cipher.attachments.splice(index, 1);
    }

    this.onRemoveSuccess.emit();
  }

  /**
   * Gets a cipher using the appropriate method based on user permissions.
   * If the user doesn't have direct access, but has organization admin access,
   * it will retrieve the cipher using the admin endpoint.
   */
  private async getCipher(id: CipherId): Promise<Cipher | null> {
    if (id == null) {
      return null;
    }

    // First try to get the cipher directly with user permissions
    const localCipher = await this.cipherService.get(id, this.activeUserId);

    // If we got the cipher or there's no organization context, return the result
    if (localCipher != null || !this.organizationId) {
      return localCipher;
    }

    // Only try the admin API if the user has admin permissions
    if (this.organization != null && this.organization.canEditAllCiphers) {
      const cipherResponse = await this.apiService.getCipherAdmin(id);
      const cipherData = new CipherData(cipherResponse);
      return new Cipher(cipherData);
    }

    return null;
  }

  /**
   * Gets the organization for the given organization ID
   */
  private async getOrganization(): Promise<Organization | null> {
    if (!this.organizationId) {
      return null;
    }

    const organizations = await firstValueFrom(
      this.organizationService.organizations$(this.activeUserId),
    );

    return organizations.find((o) => o.id === this.organizationId) || null;
  }
}
