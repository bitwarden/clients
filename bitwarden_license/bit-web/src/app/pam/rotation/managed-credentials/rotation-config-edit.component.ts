import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { OrgCiphersService } from "../org-ciphers.service";
import { RotationConfigAccountRequest } from "../requests/rotation-config-account.request";
import { RotationConfigCreateRequest } from "../requests/rotation-config-create.request";
import { RotationConfigSettingsRequest } from "../requests/rotation-config-settings.request";
import { RotationConfigDetailsResponse } from "../responses/rotation-config-details.response";
import { TargetSystemMethod, TargetSystemStatus } from "../rotation";
import { RotationApiService } from "../rotation-api.service";
import { RotationScheduleInputComponent } from "../rotation-schedule-input.component";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { RotationHistoryComponent } from "./rotation-history.component";

const ACCOUNT_IDENTITY_MAX_LENGTH = 500;

/**
 * Routed page for creating or editing a PAM rotation config.
 *
 * **Create mode** (no `configId` param): loads available target systems, available
 * ciphers, and existing configs (to exclude already-configured cipherIds). Form submits
 * to POST /configs and navigates back.
 *
 * **Edit mode** (`configId` param): fetches the full config via getRotationConfig; renders
 * cipher + target as read-only labels. Two separate save cards — settings (schedule + trigger)
 * and account (identity + session termination). The account card is disabled while
 * `hasActiveJob` is true. Below the cards shows the rotation job history.
 *
 * **Providers**: `[OrgCiphersService]` — this page is a sibling of the shell and therefore
 * outside the shell's DI scope; it provides its own OrgCiphersService and
 * TargetSystemsService (page-scoped instances, independent of the shell's).
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
    TypographyModule,
    I18nPipe,
  ],
})
export class RotationConfigEditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly rotationApi = inject(RotationApiService);
  private readonly targetSystemsService = inject(TargetSystemsService);
  private readonly orgCiphersService = inject(OrgCiphersService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  private readonly organizationId = this.route.snapshot.params.organizationId as OrganizationId;
  private readonly configId = this.route.snapshot.params.configId as string | undefined;

  protected readonly editing = this.configId != null;

  protected readonly loading = signal(true);
  protected readonly existingConfig = signal<RotationConfigDetailsResponse | null>(null);

  protected readonly titleText = computed(() =>
    this.i18nService.t(
      this.editing ? "pamRotationConfigEditTitle" : "pamRotationConfigCreateTitle",
    ),
  );

  // --- All target systems (for create mode picker) ---
  private readonly allTargetSystems = toSignal(this.targetSystemsService.systems$, {
    initialValue: [],
  });

  /** Active target systems only — the create picker should only show these. */
  protected readonly activeTargetSystems = computed(() =>
    this.allTargetSystems().filter((s) => s.status === TargetSystemStatus.Active),
  );

  // --- Available ciphers (for create mode picker) ---
  private readonly allCiphers = toSignal(this.orgCiphersService.ciphers$, {
    initialValue: [],
  });

  /** CipherIds already configured — excluded from the create picker. */
  private readonly configuredCipherIds = signal<Set<string>>(new Set());

  /** Ciphers eligible for a new config (Login type, not deleted, not already configured). */
  protected readonly availableCiphers = computed(() =>
    this.allCiphers().filter((c) => !this.configuredCipherIds().has(c.id)),
  );

  // --- Create form ---
  protected readonly createForm = this.formBuilder.nonNullable.group({
    cipherId: ["", [Validators.required]],
    targetSystemId: ["", [Validators.required]],
    accountIdentity: ["", [Validators.required, Validators.maxLength(ACCOUNT_IDENTITY_MAX_LENGTH)]],
    terminateSessions: [false],
    scheduleCron: [null as string | null],
    rotateOnAccessEnd: [false],
  });

  // --- Edit — settings form ---
  protected readonly settingsForm = this.formBuilder.nonNullable.group({
    scheduleCron: [null as string | null],
    rotateOnAccessEnd: [false],
  });

  // --- Edit — account form ---
  protected readonly accountForm = this.formBuilder.nonNullable.group({
    accountIdentity: ["", [Validators.required, Validators.maxLength(ACCOUNT_IDENTITY_MAX_LENGTH)]],
    terminateSessions: [false],
  });

  /** Whether the account form should be disabled (a rotation job is in progress). */
  protected readonly accountFormLocked = computed(
    () => this.existingConfig()?.hasActiveJob ?? false,
  );

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
    const [configsResponse] = await Promise.all([
      this.rotationApi.listRotationConfigs(this.organizationId),
      this.targetSystemsService.load(this.organizationId),
      this.orgCiphersService.load(this.organizationId),
    ]);
    this.configuredCipherIds.set(new Set(configsResponse.data.map((c) => c.cipherId)));
  }

  private async initializeEditMode(): Promise<void> {
    const [config] = await Promise.all([
      this.loadConfig(),
      this.targetSystemsService.load(this.organizationId),
    ]);
    if (config == null) {
      return; // loadConfig already toasted + navigated away
    }
    this.existingConfig.set(config);
    this.settingsForm.patchValue({
      scheduleCron: config.scheduleCron,
      rotateOnAccessEnd: config.rotateOnAccessEnd,
    });
    this.accountForm.patchValue({
      accountIdentity: config.accountIdentity,
      terminateSessions: config.terminateSessions,
    });
  }

  private async loadConfig(): Promise<RotationConfigDetailsResponse | null> {
    try {
      return await this.rotationApi.getRotationConfig(this.organizationId, this.configId!);
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
   * Couple the terminateSessions checkbox to the selected targetSystemId:
   * disable + reset when the selected target is not Automatic or doesn't support
   * session termination.
   *
   * Mirrors the coupleDurationBounds pattern in access-rule-edit.component.ts.
   */
  private coupleTerminateSessions(): void {
    const targetControl = this.createForm.controls.targetSystemId;
    const terminateControl = this.createForm.controls.terminateSessions;

    targetControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((targetId) => {
      const target = this.activeTargetSystems().find((s) => s.id === targetId);
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
    const request = new RotationConfigCreateRequest({
      cipherId: value.cipherId,
      targetSystemId: value.targetSystemId,
      accountIdentity: value.accountIdentity,
      terminateSessions: value.terminateSessions,
      scheduleCron: value.scheduleCron,
      rotateOnAccessEnd: value.rotateOnAccessEnd,
    });
    try {
      await this.rotationApi.createRotationConfig(this.organizationId, request);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamRotationConfigCreated"),
      });
      await this.navigateBack();
    } catch (e) {
      this.showError(e);
    }
  };

  protected readonly submitSettings = async (): Promise<void> => {
    this.settingsForm.markAllAsTouched();
    if (this.settingsForm.invalid) {
      return;
    }
    const value = this.settingsForm.getRawValue();
    const request = new RotationConfigSettingsRequest({
      scheduleCron: value.scheduleCron,
      rotateOnAccessEnd: value.rotateOnAccessEnd,
    });
    try {
      await this.rotationApi.updateRotationConfigSettings(
        this.organizationId,
        this.configId!,
        request,
      );
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamRotationConfigSettingsUpdated"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  protected readonly submitAccount = async (): Promise<void> => {
    this.accountForm.markAllAsTouched();
    if (this.accountForm.invalid) {
      return;
    }
    const value = this.accountForm.getRawValue();
    const request = new RotationConfigAccountRequest({
      accountIdentity: value.accountIdentity,
      terminateSessions: value.terminateSessions,
    });
    try {
      await this.rotationApi.updateRotationConfigAccount(
        this.organizationId,
        this.configId!,
        request,
      );
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamRotationConfigAccountUpdated"),
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
    const config = this.existingConfig();
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
      await this.rotationApi.deleteRotationConfig(this.organizationId, this.configId!);
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
