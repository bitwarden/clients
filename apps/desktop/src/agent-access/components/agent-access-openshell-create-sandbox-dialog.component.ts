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
  DialogModule,
  DialogRef,
  DialogService,
  DisclosureComponent,
  DisclosureTriggerForDirective,
  FormFieldModule,
  IconComponent,
  RadioButtonModule,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { OpenShellEnvironment, OpenShellSecretSet } from "../models/openshell-environments";
import {
  isOpenShellCpuQuantity,
  isOpenShellImageReference,
  isOpenShellMemoryQuantity,
  isOpenShellResourceName,
  OpenShellCreateSandboxRequest,
  OpenShellManagementError,
} from "../models/openshell-management";
import {
  applyOpenShellSecretRefs,
  OpenShellSecretFailure,
  secretRefsOfEnvironment,
} from "../utils/openshell-environments.util";

export type OpenShellSandboxSource = "default" | "image" | "template";

/**
 * Creates an OpenShell sandbox (agent-access-architecture.md, §M8.20). Everything is optional: an
 * empty form creates a sandbox with the gateway's defaults. Credentials are not chosen here; they
 * are added to the sandbox once it exists, from the page's detail panel.
 *
 * Closes with the created sandbox's name on success and with `undefined` when cancelled. Every value
 * is validated again in main; the checks here only save a round trip.
 */
@Component({
  selector: "app-agent-access-openshell-create-sandbox-dialog",
  templateUrl: "agent-access-openshell-create-sandbox-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    DisclosureComponent,
    DisclosureTriggerForDirective,
    FormFieldModule,
    I18nPipe,
    IconComponent,
    RadioButtonModule,
    ReactiveFormsModule,
    SelectModule,
    TypographyModule,
  ],
})
export class AgentAccessOpenShellCreateSandboxDialogComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18nService = inject(I18nService);
  private readonly dialogRef = inject<DialogRef<string | undefined>>(DialogRef);

  /** Shown when the gateway or main refuses the request. Scrubbed text, rendered as text. */
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly advancedOpen = signal(false);

  /** Saved environments the dialog can start from; empty when none or when they can't be read. */
  protected readonly environments = signal<OpenShellEnvironment[]>([]);
  private readonly sets = signal<OpenShellSecretSet[]>([]);
  /** Set once the sandbox exists but some of its environment's secrets could not be added. */
  protected readonly partial = signal<{
    name: string;
    total: number;
    failures: OpenShellSecretFailure[];
  } | null>(null);

  protected readonly createForm = this.formBuilder.group({
    /** An environment id, or `""` for none. */
    environment: [""],
    name: ["", this.optional(isOpenShellResourceName, "agentAccessOsCreateNameInvalid")],
    source: this.formBuilder.nonNullable.control<OpenShellSandboxSource>("default"),
    sourceValue: ["", (control: AbstractControl) => this.validateSourceValue(control)],
    cpu: ["", this.optional(isOpenShellCpuQuantity, "agentAccessOsCreateCpuInvalid")],
    memory: ["", this.optional(isOpenShellMemoryQuantity, "agentAccessOsCreateMemoryInvalid")],
  });

  protected readonly source = toSignal(
    this.createForm.controls.source.valueChanges.pipe(startWith("default" as const)),
    { initialValue: "default" as OpenShellSandboxSource },
  );

  static open(dialogService: DialogService) {
    return dialogService.open<string | undefined>(AgentAccessOpenShellCreateSandboxDialogComponent);
  }

  constructor() {
    this.createForm.controls.source.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.createForm.controls.sourceValue.updateValueAndValidity());
    this.createForm.controls.environment.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((id) => this.applyEnvironment(id));
    void this.loadEnvironments();
  }

  /** The chosen environment, or `null` for none (or one that has since been deleted). */
  private selectedEnvironment(): OpenShellEnvironment | null {
    const id = this.createForm.controls.environment.value;
    return id ? (this.environments().find((environment) => environment.id === id) ?? null) : null;
  }

  /** Fills image or template and resources from the environment; the user can still change them. */
  private applyEnvironment(id: string | null): void {
    const environment = id ? this.environments().find((e) => e.id === id) : undefined;
    if (environment == null) {
      return;
    }
    const controls = this.createForm.controls;
    controls.source.setValue(
      environment.from != null ? "image" : environment.template != null ? "template" : "default",
    );
    controls.sourceValue.setValue(environment.from ?? environment.template ?? "");
    controls.cpu.setValue(environment.cpu ?? "");
    controls.memory.setValue(environment.memory ?? "");
    if (environment.cpu != null || environment.memory != null) {
      this.advancedOpen.set(true);
    }
  }

  /** Best effort: without environments the dialog is the plain create dialog. */
  private async loadEnvironments(): Promise<void> {
    try {
      const [environments, sets] = await Promise.all([
        ipc.agentAccess.listOpenShellEnvironments(),
        ipc.agentAccess.listOpenShellSecretSets(),
      ]);
      if (environments.ok) {
        this.environments.set(environments.data);
      }
      if (sets.ok) {
        this.sets.set(sets.data);
      }
    } catch {
      // Environments are optional.
    }
  }

  /** Closes after a partial result: the sandbox exists, so the page opens it. */
  protected openCreated(): void {
    void this.dialogRef.close(this.partial()?.name);
  }

  protected readonly submit = async () => {
    this.errorMessage.set(null);
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid) {
      // The cpu and memory fields live in the disclosure; show the reason if one is hidden.
      const { cpu, memory } = this.createForm.controls;
      if (cpu.invalid || memory.invalid) {
        this.advancedOpen.set(true);
      }
      return;
    }

    const request = this.buildRequest();
    const result = await ipc.agentAccess.createOpenShellSandbox(request);
    if (!result.ok) {
      this.errorMessage.set(result.message?.trim() || this.fallbackMessage(result.error));
      return;
    }
    const refs = this.environmentSecrets();
    if (refs == null) {
      // The environment's set was deleted after the list was read: nothing to add, and say so.
      this.partial.set({ name: result.data.name, total: 0, failures: [this.missingSetFailure()] });
      return;
    }
    if (refs.length > 0) {
      // One at a time (a failure doesn't stop the rest); each is reported plainly.
      const applied = await applyOpenShellSecretRefs(result.data.name, refs);
      if (applied.failures.length > 0) {
        this.partial.set({
          name: result.data.name,
          total: refs.length,
          failures: applied.failures,
        });
        return;
      }
    }
    await this.dialogRef.close(result.data.name);
  };

  /** The refs to add after creation: `[]` for none, `null` when the environment's set is gone. */
  private environmentSecrets() {
    const environment = this.selectedEnvironment();
    return environment == null ? [] : secretRefsOfEnvironment(environment, this.sets());
  }

  private missingSetFailure(): OpenShellSecretFailure {
    return {
      label: this.i18nService.t("agentAccessOsEnvSetMissing"),
      error: "notFound",
    };
  }

  /** Only the fields the user filled in, trimmed. An empty request means "gateway defaults". */
  private buildRequest(): OpenShellCreateSandboxRequest {
    const value = this.createForm.getRawValue();
    const request: OpenShellCreateSandboxRequest = {};
    const name = value.name?.trim();
    const sourceValue = value.sourceValue?.trim();
    const cpu = value.cpu?.trim();
    const memory = value.memory?.trim();
    if (name) {
      request.name = name;
    }
    if (value.source === "image" && sourceValue) {
      request.from = sourceValue;
    } else if (value.source === "template" && sourceValue) {
      request.template = sourceValue;
    }
    if (cpu) {
      request.cpu = cpu;
    }
    if (memory) {
      request.memory = memory;
    }
    return request;
  }

  private fallbackMessage(error: OpenShellManagementError): string {
    switch (error) {
      case "alreadyExists":
        return this.i18nService.t("agentAccessOsCreateErrorExists");
      case "cliMissing":
        return this.i18nService.t("agentAccessOsPageErrorCliMissing");
      case "gatewayUnreachable":
        return this.i18nService.t("agentAccessOsPageErrorGatewayUnreachable");
      case "unsupported":
        return this.i18nService.t("agentAccessOsPageErrorUnsupported");
      default:
        return this.i18nService.t("agentAccessOsCreateErrorGeneric");
    }
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
    if (valid) {
      return null;
    }
    return {
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
