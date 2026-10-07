import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
} from "@angular/forms";
import { startWith } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  RadioButtonModule,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  OPENSHELL_MAX_DESCRIPTION_CHARS,
  OPENSHELL_MAX_NAME_CHARS,
  OpenShellEnvironment,
  OpenShellSaveEnvironmentRequest,
  OpenShellSecretRef,
  OpenShellSecretSet,
} from "../models/openshell-environments";
import {
  isOpenShellCpuQuantity,
  isOpenShellImageReference,
  isOpenShellMemoryQuantity,
  isOpenShellResourceName,
  OpenShellManagementError,
} from "../models/openshell-management";

import { OpenShellSandboxSource } from "./agent-access-openshell-create-sandbox-dialog.component";

/** The "secrets" choice values that are not a set id. */
export const ENV_SECRETS_NONE = "";
export const ENV_SECRETS_INLINE = "inline";

export interface AgentAccessOpenShellEnvironmentDialogParams {
  /** The environment being edited; absent for a new one. */
  environment?: OpenShellEnvironment;
  sets: OpenShellSecretSet[];
  /**
   * Secrets that come with the dialog instead of a saved set: a sandbox's current secrets ("Save
   * as environment"), or an edited environment's own inline refs.
   */
  inlineSecrets?: OpenShellSecretRef[];
  /** Credentials of the sandbox that could not be captured (not created by this app). */
  skippedSecrets?: number;
  /** Values to start a new environment from (the sandbox page cannot know its image or size). */
  prefill?: Partial<Pick<OpenShellEnvironment, "name" | "description">>;
}

/**
 * Creates or edits an environment: a named preset of image or template, resources and the secrets
 * a sandbox starts with (agent-access-architecture.md, §M8.20 rule 17). Everything is validated
 * again in main. Closes with the saved environment, or `undefined` when cancelled.
 */
@Component({
  selector: "app-agent-access-openshell-environment-dialog",
  templateUrl: "agent-access-openshell-environment-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    FormFieldModule,
    I18nPipe,
    RadioButtonModule,
    ReactiveFormsModule,
    SelectModule,
    TypographyModule,
  ],
})
export class AgentAccessOpenShellEnvironmentDialogComponent {
  private readonly params = inject<AgentAccessOpenShellEnvironmentDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<OpenShellEnvironment | undefined>>(DialogRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18nService = inject(I18nService);

  protected readonly editing = this.params.environment != null;
  protected readonly sets = this.params.sets;
  protected readonly inlineSecrets = this.params.inlineSecrets ?? [];
  protected readonly skippedSecrets = this.params.skippedSecrets ?? 0;
  protected readonly ENV_SECRETS_NONE = ENV_SECRETS_NONE;
  protected readonly ENV_SECRETS_INLINE = ENV_SECRETS_INLINE;
  protected readonly maxName = OPENSHELL_MAX_NAME_CHARS;
  protected readonly maxDescription = OPENSHELL_MAX_DESCRIPTION_CHARS;
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.formBuilder.group({
    name: [
      this.params.environment?.name ?? this.params.prefill?.name ?? "",
      (control: AbstractControl) => this.validateName(control),
    ],
    description: [this.params.environment?.description ?? this.params.prefill?.description ?? ""],
    source: this.formBuilder.nonNullable.control<OpenShellSandboxSource>(this.initialSource()),
    sourceValue: [
      this.params.environment?.from ?? this.params.environment?.template ?? "",
      (control: AbstractControl) => this.validateSourceValue(control),
    ],
    cpu: [
      this.params.environment?.cpu ?? "",
      this.optional(isOpenShellCpuQuantity, "agentAccessOsCreateCpuInvalid"),
    ],
    memory: [
      this.params.environment?.memory ?? "",
      this.optional(isOpenShellMemoryQuantity, "agentAccessOsCreateMemoryInvalid"),
    ],
    secrets: [this.initialSecrets()],
  });

  protected readonly source = toSignal(
    this.form.controls.source.valueChanges.pipe(startWith(this.initialSource())),
    { initialValue: this.initialSource() },
  );

  static open(dialogService: DialogService, params: AgentAccessOpenShellEnvironmentDialogParams) {
    return dialogService.open<
      OpenShellEnvironment | undefined,
      AgentAccessOpenShellEnvironmentDialogParams
    >(AgentAccessOpenShellEnvironmentDialogComponent, { data: params });
  }

  constructor() {
    this.form.controls.source.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.sourceValue.updateValueAndValidity());
  }

  protected readonly submit = async () => {
    this.errorMessage.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const result = await ipc.agentAccess.saveOpenShellEnvironment(this.buildRequest());
    if (!result.ok) {
      this.errorMessage.set(result.message?.trim() || this.fallbackMessage(result.error));
      return;
    }
    await this.dialogRef.close(result.data);
  };

  private buildRequest(): OpenShellSaveEnvironmentRequest {
    const value = this.form.getRawValue();
    const request: OpenShellSaveEnvironmentRequest = {
      name: (value.name ?? "").trim(),
      description: (value.description ?? "").trim(),
    };
    if (this.params.environment != null) {
      request.id = this.params.environment.id;
    }
    const sourceValue = (value.sourceValue ?? "").trim();
    if (value.source === "image" && sourceValue) {
      request.from = sourceValue;
    } else if (value.source === "template" && sourceValue) {
      request.template = sourceValue;
    }
    const cpu = (value.cpu ?? "").trim();
    const memory = (value.memory ?? "").trim();
    if (cpu) {
      request.cpu = cpu;
    }
    if (memory) {
      request.memory = memory;
    }
    if (value.secrets === ENV_SECRETS_INLINE) {
      request.secrets = this.inlineSecrets;
    } else if (value.secrets !== ENV_SECRETS_NONE) {
      request.secretSetId = value.secrets;
    }
    return request;
  }

  private initialSource(): OpenShellSandboxSource {
    const environment = this.params.environment;
    return environment?.from != null
      ? "image"
      : environment?.template != null
        ? "template"
        : "default";
  }

  /** An environment keeps its set (if it still exists) or its inline refs; a new one with refs starts with them. */
  private initialSecrets(): string {
    const environment = this.params.environment;
    if (environment?.secretSetId != null) {
      return this.params.sets.some((set) => set.id === environment.secretSetId)
        ? environment.secretSetId
        : ENV_SECRETS_NONE;
    }
    return (this.params.inlineSecrets ?? []).length > 0 ? ENV_SECRETS_INLINE : ENV_SECRETS_NONE;
  }

  private fallbackMessage(error: OpenShellManagementError): string {
    switch (error) {
      case "alreadyExists":
        return this.i18nService.t("agentAccessOsEnvErrorNameTaken");
      case "notFound":
        return this.i18nService.t("agentAccessOsEnvErrorNotFound");
      case "unsupported":
        return this.i18nService.t("agentAccessOsPageErrorUnsupported");
      default:
        return this.i18nService.t("agentAccessOsEnvErrorSave");
    }
  }

  private validateName(control: AbstractControl): ValidationErrors | null {
    return typeof control.value === "string" && control.value.trim() !== ""
      ? null
      : { required: true };
  }

  /** Empty is fine; anything else must satisfy the contract validator. */
  private optional(isValid: (value: unknown) => boolean, messageKey: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = typeof control.value === "string" ? control.value.trim() : "";
      if (value === "" || isValid(value)) {
        return null;
      }
      return { openShellValue: { message: this.i18nService.t(messageKey) } };
    };
  }

  private validateSourceValue(control: AbstractControl): ValidationErrors | null {
    const source = control.parent?.get("source")?.value as OpenShellSandboxSource | undefined;
    if (source == null || source === "default") {
      return null;
    }
    const value = typeof control.value === "string" ? control.value.trim() : "";
    if (value === "") {
      return { required: true };
    }
    const valid =
      source === "image" ? isOpenShellImageReference(value) : isOpenShellResourceName(value);
    return valid
      ? null
      : {
          openShellValue: {
            message: this.i18nService.t(
              source === "image"
                ? "agentAccessOsCreateImageInvalid"
                : "agentAccessOsCreateTemplateInvalid",
            ),
          },
        };
  }
}
