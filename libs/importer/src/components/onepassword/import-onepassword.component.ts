import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from "@angular/core";
import {
  AbstractControl,
  ControlContainer,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { CalloutModule, FormFieldModule, SelectModule } from "@bitwarden/components";

import {
  OnePasswordImportSummary,
  OnePasswordSignInDomain,
  onePasswordErrorLogName,
  onePasswordErrorMessageKey,
} from "../../sdk";

import {
  OnePasswordAccount,
  OnePasswordDirectImportService,
} from "./onepassword-direct-import.service";
import { onePasswordSignInDomains } from "./onepassword-sign-in-domains";

/**
 * `Validators.email` against the trimmed value. The form validates on submit and the parent rejects
 * an invalid child group before this component runs, so a padded paste has to pass here or it never
 * reaches the trimming in `credentials()`.
 */
function trimmedEmailValidator(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  return typeof value === "string" ? Validators.email(new FormControl(value.trim())) : null;
}

/** What the parent needs to run the import and show its result. */
export interface OnePasswordImportContext {
  organizationId: OrganizationId | undefined;
  selectedImportTarget: FolderView | CollectionView | undefined;
  canAccessImportExport: boolean;
}

@Component({
  selector: "import-onepassword",
  templateUrl: "import-onepassword.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, CalloutModule, FormFieldModule, ReactiveFormsModule, SelectModule],
  providers: [OnePasswordDirectImportService],
})
export class ImportOnePasswordComponent implements OnInit, OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  private readonly controlContainer = inject(ControlContainer);
  private readonly logService = inject(LogService);
  private readonly i18nService = inject(I18nService);
  private readonly onePasswordDirectImportService = inject(OnePasswordDirectImportService);

  private readonly parentFormGroup = signal<FormGroup | null>(null);

  protected readonly domains = onePasswordSignInDomains;

  protected readonly formGroup = this.formBuilder.group(
    {
      email: this.formBuilder.nonNullable.control("", [Validators.required, trimmedEmailValidator]),
      // An individual account signs in at `my`; a team or business account uses its own name.
      // The SDK normalizes and validates it, so a stricter regex here would only reject pastes the
      // SDK accepts.
      subdomain: this.formBuilder.nonNullable.control("my", Validators.required),
      domain: this.formBuilder.nonNullable.control<OnePasswordSignInDomain>("Global", {
        updateOn: "change",
      }),
    },
    { updateOn: "submit" },
  );

  protected readonly importing = signal(false);
  /** Why the last import failed. An error on a control would make the form invalid, blocking a retry. */
  protected readonly importError = signal<string | undefined>(undefined);

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
   * dialogs along the way. The parent invokes this from its submit handler; 1Password direct has no
   * file fallback to fall through to.
   */
  async submitDirect(
    context: OnePasswordImportContext,
    onImported: (summary: OnePasswordImportSummary) => Promise<void>,
  ): Promise<void> {
    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }

    this.importing.set(true);
    this.importError.set(undefined);
    let summary: OnePasswordImportSummary | undefined;
    try {
      summary = await this.onePasswordDirectImportService.handleImport(
        this.account(),
        context.organizationId,
        context.selectedImportTarget,
        context.canAccessImportExport,
      );
    } catch (error) {
      this.logService.error(`1Password importer error: ${onePasswordErrorLogName(error)}`);
      this.importError.set(
        this.i18nService.t(onePasswordErrorMessageKey(error) ?? "errorOccurred"),
      );
      return;
    } finally {
      this.importing.set(false);
    }

    if (summary != null) {
      await onImported(summary);
    }
  }

  private account(): OnePasswordAccount {
    const { email, subdomain, domain } = this.formGroup.getRawValue();
    return { email: email.trim(), subdomain: subdomain.trim(), domain };
  }
}
