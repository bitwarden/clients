import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from "@angular/core";
import {
  ControlContainer,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { FormFieldModule, SelectModule, ToastService } from "@bitwarden/components";

import {
  OnePasswordImportSummary,
  OnePasswordSignInDomain,
  onePasswordErrorLogName,
} from "../../sdk";

import {
  OnePasswordAccount,
  OnePasswordDirectImportService,
} from "./onepassword-direct-import.service";
import { onePasswordSignInDomains } from "./onepassword-sign-in-domains";
import {
  requiredWithMessage,
  subdomainWithMessage,
  trimmedEmailWithMessage,
} from "./onepassword-validators";

/** What the parent needs to run the import and show its result. */
export interface OnePasswordImportContext {
  organizationId: OrganizationId | undefined;
  selectedImportTarget: FolderView | CollectionView | undefined;
  canAccessImportExport: boolean;
}

/** A value 1Password refused, marked on its field until it is changed. */
interface Rejection {
  control: "email" | "subdomain";
  value: string;
  message: string;
}

@Component({
  selector: "import-onepassword",
  templateUrl: "import-onepassword.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, FormFieldModule, ReactiveFormsModule, SelectModule],
  providers: [OnePasswordDirectImportService],
})
export class ImportOnePasswordComponent implements OnInit, OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  private readonly controlContainer = inject(ControlContainer);
  private readonly logService = inject(LogService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly onePasswordDirectImportService = inject(OnePasswordDirectImportService);

  private readonly parentFormGroup = signal<FormGroup | null>(null);

  protected readonly domains = onePasswordSignInDomains;

  private readonly rejection = signal<Rejection | undefined>(undefined);

  protected readonly formGroup = this.formBuilder.group(
    {
      email: this.formBuilder.nonNullable.control("", [
        requiredWithMessage(this.i18nService.t("emailIsRequired")),
        Validators.required,
        trimmedEmailWithMessage(this.i18nService.t("enterValidEmailAddress")),
        this.rejectionValidator("email"),
      ]),
      // An individual account signs in at `my`; a team or business account uses its own name.
      subdomain: this.formBuilder.nonNullable.control("my", [
        requiredWithMessage(this.i18nService.t("signInAddressIsRequired")),
        Validators.required,
        subdomainWithMessage(this.i18nService.t("enterValidSignInAddress")),
        this.rejectionValidator("subdomain"),
      ]),
      domain: this.formBuilder.nonNullable.control<OnePasswordSignInDomain>("Global", {
        updateOn: "change",
      }),
    },
    { updateOn: "submit" },
  );

  ngOnInit(): void {
    this.parentFormGroup.set(this.controlContainer.control as FormGroup);
    this.parentFormGroup()!.addControl("onepasswordOptions", this.formGroup);
  }

  ngOnDestroy(): void {
    this.parentFormGroup()?.removeControl("onepasswordOptions");
  }

  /**
   * Signs in to 1Password through the SDK, which downloads, decrypts and submits the account, then
   * hands the summary to `onImported`. The Secret Key, password and two-factor code are asked for in
   * dialogs along the way, which show the import's progress. A refused email or sign-in address is
   * marked on its field, and any other failure is shown in a toast. The parent invokes this from its
   * submit handler; 1Password direct has no file fallback to fall through to.
   */
  async submitDirect(
    context: OnePasswordImportContext,
    onImported: (summary: OnePasswordImportSummary) => Promise<void>,
  ): Promise<void> {
    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }

    const account = this.account();
    let summary: OnePasswordImportSummary | undefined;
    try {
      summary = await this.onePasswordDirectImportService.handleImport(
        account,
        context.organizationId,
        context.selectedImportTarget,
        context.canAccessImportExport,
      );
    } catch (error) {
      this.logService.error(`1Password importer error: ${onePasswordErrorLogName(error)}`);
      this.showError(error, account);
      return;
    }

    if (summary != null) {
      await onImported(summary);
    }
  }

  private showError(error: unknown, account: OnePasswordAccount): void {
    const { field, message } = this.onePasswordDirectImportService.describeError(
      error,
      account.domain,
    );
    if (field === "email" || field === "signInAddress") {
      const control = field === "email" ? "email" : "subdomain";
      this.rejection.set({ control, value: this.formGroup.controls[control].value, message });
      this.formGroup.controls[control].updateValueAndValidity();
      this.formGroup.controls[control].markAsTouched();
      return;
    }
    this.toastService.showToast({ variant: "error", message });
  }

  private rejectionValidator(control: Rejection["control"]): ValidatorFn {
    return ({ value }) => {
      const rejection = this.rejection();
      return rejection?.control === control && value === rejection.value
        ? { rejected: { message: rejection.message } }
        : null;
    };
  }

  private account(): OnePasswordAccount {
    const { email, subdomain, domain } = this.formGroup.getRawValue();
    return { email: email.trim(), subdomain: subdomain.trim(), domain };
  }
}
