import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  BreadcrumbsModule,
  ButtonModule,
  CalloutModule,
  CardComponent,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  HeaderComponent,
  IconModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  SpinnerComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import type { CipherId } from "@bitwarden/sdk-internal";
import { I18nPipe } from "@bitwarden/ui-common";

import { OrgCiphersService } from "../org-ciphers.service";
import {
  RotationConfigCreateRequest,
  RotationConfigDetail,
  RotationConfigId,
  RotationConfigUpdateRequest,
  TargetSystemId,
  TargetSystemMethod,
  TargetSystemStatus,
} from "../rotation";
import { RotationScheduleInputComponent } from "../rotation-schedule-input.component";
import { RotationSdkService } from "../rotation-sdk.service";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { RotationHistoryComponent } from "./rotation-history.component";

const ACCOUNT_IDENTITY_MAX_LENGTH = 500;

/**
 * Routed page for creating or editing a PAM rotation config.
 *
 * Create mode (no `configId`) picks target system, cipher and schedule. Edit mode renders
 * cipher + target as read-only and splits settings from account into two save cards; the
 * account card disables while `hasActiveJob` is true.
 *
 * Provides its own `OrgCiphersService` and `TargetSystemsService`, page-scoped, since this page
 * is a sibling of the shell rather than a child, outside the shell's DI scope.
 */
@Component({
  templateUrl: "./rotation-config-edit.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [OrgCiphersService, TargetSystemsService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    BreadcrumbsModule,
    FormFieldModule,
    ButtonModule,
    CalloutModule,
    CardComponent,
    CheckboxModule,
    FormFieldModule,
    HeaderComponent,
    IconModule,
    RotationHistoryComponent,
    RotationScheduleInputComponent,
    SectionComponent,
    SectionHeaderComponent,
    SelectModule,
    SpinnerComponent,
    TypographyModule,
    I18nPipe,
  ],
})
export class RotationConfigEditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly rotationSdk = inject(RotationSdkService);
  private readonly targetSystemsService = inject(TargetSystemsService);
  private readonly orgCiphersService = inject(OrgCiphersService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  private readonly organizationId = this.route.snapshot.params.organizationId as OrganizationId;
  private readonly configId: RotationConfigId | undefined =
    this.route.snapshot.params.configId == null
      ? undefined
      : asUuid<RotationConfigId>(this.route.snapshot.params.configId);

  protected readonly editing = this.configId != null;

  protected readonly loading = signal(true);
  protected readonly existingConfig = signal<RotationConfigDetail | null>(null);

  /** The config itself; the detail's other half is its job history. */
  private readonly config = computed(() => this.existingConfig()?.config ?? null);

  protected readonly titleText = computed(() =>
    this.i18nService.t(
      this.editing ? "pamRotationConfigEditTitle" : "pamRotationConfigCreateTitle",
    ),
  );

  private readonly allTargetSystems = toSignal(this.targetSystemsService.systems$, {
    initialValue: [],
  });

  /** Active target systems only — the create picker should only show these. */
  protected readonly activeTargetSystems = computed(() =>
    this.allTargetSystems().filter((s) => s.status === TargetSystemStatus.Active),
  );

  private readonly allCiphers = toSignal(this.orgCiphersService.ciphers$, {
    initialValue: [],
  });

  /** CipherIds already configured — excluded from the create picker. */
  private readonly configuredCipherIds = signal<Set<CipherId>>(new Set());

  /** Ciphers eligible for a new config (Login type, not deleted, not already configured). */
  protected readonly availableCiphers = computed(() =>
    this.allCiphers().filter((c) => !this.configuredCipherIds().has(asUuid<CipherId>(c.id))),
  );

  protected readonly createForm = this.formBuilder.nonNullable.group({
    cipherId: ["", [Validators.required]],
    targetSystemId: ["", [Validators.required]],
    accountIdentity: ["", [Validators.required, Validators.maxLength(ACCOUNT_IDENTITY_MAX_LENGTH)]],
    terminateSessions: [false],
    scheduleCron: [null as string | null],
    rotateOnAccessEnd: [false],
  });

  protected readonly settingsForm = this.formBuilder.nonNullable.group({
    scheduleCron: [null as string | null],
    rotateOnAccessEnd: [false],
  });

  protected readonly accountForm = this.formBuilder.nonNullable.group({
    accountIdentity: ["", [Validators.required, Validators.maxLength(ACCOUNT_IDENTITY_MAX_LENGTH)]],
    terminateSessions: [false],
  });

  /**
   * The two edit cards as one form, since the server takes the schedule and the account in a
   * single write.
   *
   * Stay separate groups rather than a flat one, since the account half disables on its own
   * while a job is in flight; the parent group is what lets one `<form>` and one Save span both.
   */
  protected readonly editForm = this.formBuilder.group({
    settings: this.settingsForm,
    account: this.accountForm,
  });

  /** Whether the account form should be disabled (a rotation job is in progress). */
  protected readonly accountFormLocked = computed(() => this.config()?.hasActiveJob ?? false);

  constructor() {
    this.coupleTerminateSessions();
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      if (this.editing) {
        await this.initializeEditMode();
      } else {
        await this.initializeCreateMode();
      }
    } finally {
      this.loading.set(false);
    }
  }

  private async initializeCreateMode(): Promise<void> {
    const [configs] = await Promise.all([
      this.rotationSdk.listConfigs(this.organizationId),
      this.targetSystemsService.load(this.organizationId),
      this.orgCiphersService.load(this.organizationId),
    ]);
    this.configuredCipherIds.set(new Set(configs.map((c) => c.cipherId)));
  }

  private async initializeEditMode(): Promise<void> {
    const [detail] = await Promise.all([
      this.loadConfig(),
      this.targetSystemsService.load(this.organizationId),
    ]);
    if (detail == null) {
      return; // loadConfig already toasted + navigated away
    }
    this.existingConfig.set(detail);
    this.settingsForm.patchValue({
      scheduleCron: detail.config.scheduleCron,
      rotateOnAccessEnd: detail.config.rotateOnAccessEnd,
    });
    this.accountForm.patchValue({
      accountIdentity: detail.config.accountIdentity,
      terminateSessions: detail.config.terminateSessions,
    });
  }

  private async loadConfig(): Promise<RotationConfigDetail | null> {
    try {
      return await this.rotationSdk.getConfig(this.organizationId, this.configId!);
    } catch {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamRotationConfigNotFound"),
      });
      await this.navigateBack();
      return null;
    }
  }

  /**
   * Disables and resets terminateSessions for a target that isn't Automatic or doesn't support
   * session termination. Mirrors the coupleDurationBounds pattern in access-rule-edit.component.ts.
   */
  private coupleTerminateSessions(): void {
    const targetControl = this.createForm.controls.targetSystemId;
    const terminateControl = this.createForm.controls.terminateSessions;

    targetControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((targetId) => {
      const target = this.activeTargetSystems().find((s) => String(s.id) === targetId);
      const allowed =
        target != null &&
        target.method === TargetSystemMethod.Automatic &&
        target.supportsSessionTermination === true;

      if (!allowed) {
        terminateControl.setValue(false, { emitEvent: false });
        terminateControl.disable({ emitEvent: false });
      } else {
        terminateControl.enable({ emitEvent: false });
      }
    });
  }

  protected readonly submitCreate = async (): Promise<void> => {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid) {
      return;
    }
    const value = this.createForm.getRawValue();
    const request: RotationConfigCreateRequest = {
      cipherId: asUuid<CipherId>(value.cipherId),
      targetSystemId: asUuid<TargetSystemId>(value.targetSystemId),
      accountIdentity: value.accountIdentity,
      terminateSessions: value.terminateSessions,
      scheduleCron: value.scheduleCron,
      rotateOnAccessEnd: value.rotateOnAccessEnd,
    };
    try {
      await this.rotationSdk.createConfig(this.organizationId, request);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamRotationConfigCreated"),
      });
      await this.navigateBack();
    } catch (e) {
      this.showError(e);
    }
  };

  /**
   * Edit mode: one save for the account and the schedule together, since the server now takes
   * both in a single write — a caller changing only the schedule still sends the current
   * account identity.
   *
   * The account identity is locked while a job is in flight; the server rejects the write
   * regardless.
   */
  protected readonly submitEdit = async (): Promise<void> => {
    this.settingsForm.markAllAsTouched();
    this.accountForm.markAllAsTouched();
    if (this.settingsForm.invalid || this.accountForm.invalid) {
      return;
    }
    const settings = this.settingsForm.getRawValue();
    const account = this.accountForm.getRawValue();
    const request: RotationConfigUpdateRequest = {
      accountIdentity: account.accountIdentity,
      terminateSessions: account.terminateSessions,
      scheduleCron: settings.scheduleCron,
      rotateOnAccessEnd: settings.rotateOnAccessEnd,
    };
    try {
      const updated = await this.rotationSdk.updateConfig(
        this.organizationId,
        this.configId!,
        request,
      );
      this.existingConfig.set(updated);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamRotationConfigSaved"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  /**
   * Remove the rotation configuration (not the credential itself). Blocked while a rotation job is
   * in progress — the server rejects it, and we also disable the action in the template. The cipher
   * stays in the vault; only rotation management is removed.
   */
  protected readonly removeRotation = async (): Promise<void> => {
    const config = this.config();
    if (config == null || config.hasActiveJob) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamRotationConfigDeleteConfirmTitle" },
      content: { key: "pamRotationConfigDeleteConfirmContent" },
      acceptButtonText: { key: "remove" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.rotationSdk.deleteConfig(this.organizationId, this.configId!);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamRotationConfigDeleteSuccess"),
      });
      await this.navigateBack();
    } catch (e) {
      this.showError(e);
    }
  };

  protected readonly cancel = (): Promise<boolean> => this.navigateBack();

  /** Return to the managed-credentials tab. */
  private navigateBack(): Promise<boolean> {
    return this.router.navigate([".."], { relativeTo: this.route });
  }

  private showError(e: unknown): void {
    const message =
      e instanceof ErrorResponse
        ? (e.message ?? this.i18nService.t("unexpectedError"))
        : this.i18nService.t("unexpectedError");
    this.toastService.showToast({ variant: "error", message });
  }
}
