import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, CanDeactivateFn, Router } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  CardComponent,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  HeaderComponent,
  LinkModule,
  SectionComponent,
  SectionHeaderComponent,
  SkeletonComponent,
  SkeletonTextComponent,
  TabsModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import type { CipherId } from "@bitwarden/sdk-internal";
import { I18nPipe } from "@bitwarden/ui-common";

import { discardConfirmOptions } from "../../helpers/discard-confirm";
import {
  TARGET_SYSTEM_QUERY_PARAM,
  THEN_MANAGED_CREDENTIAL,
  THEN_QUERY_PARAM,
} from "../create-flow";
import { DetailBreadcrumbComponent } from "../detail-breadcrumb.component";
import { tabFromSegment } from "../detail-tab";
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
import { ROTATION_TABS, rotationLink } from "../rotation-links";
import { RotationLoadErrorComponent } from "../rotation-load-error.component";
import { RotationLoadingAnnouncerComponent } from "../rotation-loading-announcer.component";
import { RotationScheduleInputComponent } from "../rotation-schedule-input.component";
import { RotationSdkService } from "../rotation-sdk.service";
import { showSkeletonWhile } from "../skeleton-delay";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { RotationHistorySkeletonComponent } from "./rotation-history-skeleton.component";
import { RotationHistoryComponent } from "./rotation-history.component";

const ACCOUNT_IDENTITY_MAX_LENGTH = 500;

const ROTATION_CONFIG_EDIT_TABS = ["configuration", "history"] as const;

export type RotationConfigEditTab = (typeof ROTATION_CONFIG_EDIT_TABS)[number];

/**
 * Create and edit page for a rotation config. It provides its own `OrgCiphersService` and
 * `TargetSystemsService`, since the shell route's providers don't reach a sibling page.
 */
@Component({
  templateUrl: "./rotation-config-edit.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [OrgCiphersService, TargetSystemsService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    DetailBreadcrumbComponent,
    FormFieldModule,
    ButtonModule,
    CalloutModule,
    CardComponent,
    CheckboxModule,
    HeaderComponent,
    LinkModule,
    RotationHistoryComponent,
    RotationHistorySkeletonComponent,
    RotationLoadErrorComponent,
    RotationLoadingAnnouncerComponent,
    RotationScheduleInputComponent,
    SectionComponent,
    SectionHeaderComponent,
    SkeletonComponent,
    SkeletonTextComponent,
    TabsModule,
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

  /**
   * A target chosen before this page opened (`?targetSystemId=`), from the target-systems tab's
   * "Add managed credential" action or from the round trip through target-system creation.
   */
  private readonly preselectedTargetSystemId: string | undefined =
    this.route.snapshot.queryParams?.[TARGET_SYSTEM_QUERY_PARAM];

  protected readonly editing = this.configId != null;

  /** Route to the Managed credentials list, behind the breadcrumb, Cancel, and every exit. */
  protected readonly credentialsListRoute = rotationLink(
    this.organizationId,
    ROTATION_TABS.managedCredentials,
  );

  protected readonly configurationTabRoute = [
    ...this.credentialsListRoute,
    this.configId,
    "configuration",
  ];
  protected readonly historyTabRoute = [...this.credentialsListRoute, this.configId, "history"];

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(
      map((params) => tabFromSegment(params.get("tab"), ROTATION_CONFIG_EDIT_TABS)),
    ),
    {
      initialValue: tabFromSegment(
        this.route.snapshot.params.tab as string | undefined,
        ROTATION_CONFIG_EDIT_TABS,
      ),
    },
  );

  protected readonly loading = signal(true);

  /** Whether the placeholder is drawn, which trails {@link loading} by the skeleton delay. */
  protected readonly showSkeleton = showSkeletonWhile(this.loading);

  protected readonly loadingVisible = computed(() => this.loading() || this.showSkeleton());

  protected readonly loadError = signal<unknown | null>(null);

  /** Four blocks, the rough depth of the card each of these pages opens with. */
  protected readonly skeletonFields = [0, 1, 2, 3];

  protected readonly existingConfig = signal<RotationConfigDetail | null>(null);

  private readonly config = computed(() => this.existingConfig()?.config ?? null);

  protected readonly titleText = computed(() =>
    this.i18nService.t(
      this.editing ? "pamRotationConfigEditTitle" : "pamRotationConfigCreateTitle",
    ),
  );

  private readonly allTargetSystems = toSignal(this.targetSystemsService.systems$, {
    initialValue: [],
  });

  /** The create picker offers only active targets; the server rejects an inactive one. */
  protected readonly activeTargetSystems = computed(() =>
    this.allTargetSystems().filter((s) => s.status === TargetSystemStatus.Active),
  );

  protected readonly hasActiveTargetSystems = computed(() => this.activeTargetSystems().length > 0);

  private readonly allCiphers = toSignal(this.orgCiphersService.ciphers$, {
    initialValue: [],
  });

  /** A cipher can have only one rotation config, so configured ones leave the create picker. */
  private readonly configuredCipherIds = signal<Set<CipherId>>(new Set());

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
   * The two edit cards as one form, since the server takes schedule and account in one write.
   * Separate groups let the account half disable alone while a job runs.
   */
  protected readonly editForm = this.formBuilder.group({
    settings: this.settingsForm,
    account: this.accountForm,
  });

  protected readonly accountFormLocked = computed(() => this.config()?.hasActiveJob ?? false);

  constructor() {
    this.coupleTerminateSessions();
    void this.initialize();
  }

  /** Whether the operator has asked for a retry, which decides where focus lands on a re-render. */
  protected readonly retried = signal(false);

  protected readonly retryLoad = (): Promise<void> => {
    this.retried.set(true);
    return this.initialize();
  };

  private async initialize(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      if (this.editing) {
        await this.initializeEditMode();
      } else {
        await this.initializeCreateMode();
      }
    } catch (e) {
      this.loadError.set(e);
    } finally {
      this.loading.set(false);
      this.markSaved();
    }
  }

  private async initializeCreateMode(): Promise<void> {
    const [configs] = await Promise.all([
      this.rotationSdk.listConfigs(this.organizationId),
      this.targetSystemsService.load(this.organizationId),
      this.orgCiphersService.load(this.organizationId),
    ]);
    await this.throwIfTargetSystemsFailed();
    this.configuredCipherIds.set(new Set(configs.map((c) => c.cipherId)));
    this.applyPreselectedTargetSystem();
  }

  /**
   * `TargetSystemsService.load` resolves even on failure, so this checks `loadError$` to tell a
   * failed read from an org with no targets.
   */
  private async throwIfTargetSystemsFailed(): Promise<void> {
    const error = await firstValueFrom(this.targetSystemsService.loadError$);
    if (error != null) {
      throw error;
    }
  }

  /** Selects {@link preselectedTargetSystemId} only if the picker offers it. */
  private applyPreselectedTargetSystem(): void {
    const preselected = this.preselectedTargetSystemId;
    if (
      preselected == null ||
      !this.activeTargetSystems().some((system) => String(system.id) === preselected)
    ) {
      return;
    }
    this.createForm.patchValue({ targetSystemId: preselected });
  }

  private async initializeEditMode(): Promise<void> {
    const [detail] = await Promise.all([
      this.rotationSdk.getConfig(this.organizationId, this.configId!),
      this.targetSystemsService.load(this.organizationId),
    ]);
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

  /** The server rejects `terminateSessions` unless the target is automatic and supports it. */
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
      scheduleCron: value.scheduleCron ?? undefined,
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
   * Sends the account with the schedule, since the server takes both in one write. The server
   * rejects the write while a job is in flight.
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
      scheduleCron: settings.scheduleCron ?? undefined,
      rotateOnAccessEnd: settings.rotateOnAccessEnd,
    };
    try {
      const updated = await this.rotationSdk.updateConfig(
        this.organizationId,
        this.configId!,
        request,
      );
      this.existingConfig.set(updated);
      this.markSaved();
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamRotationConfigSaved"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  /**
   * Removes rotation management; the cipher stays in the vault. Blocked while a job is in flight,
   * which the server also rejects.
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

  /** The target-system create page returns here with the new target selected. */
  protected readonly createTargetSystem = (): Promise<boolean> => {
    this.markSaved();
    return this.router.navigate(["target-systems", "new"], {
      relativeTo: this.route.parent,
      queryParams: { [THEN_QUERY_PARAM]: THEN_MANAGED_CREDENTIAL },
    });
  };

  private liveForm(): AbstractControl {
    return this.editing ? this.editForm : this.createForm;
  }

  /** The live form's value as the admin was last shown it, serialized. */
  private readonly savedValue = signal("");

  private markSaved(): void {
    this.savedValue.set(JSON.stringify(this.liveForm().getRawValue()));
  }

  /**
   * Called by Cancel and by the CanDeactivate guard, which a `:tab` change doesn't trigger. Exits
   * while loading pass, since `savedValue` has no snapshot until `initialize()` settles.
   */
  async confirmDiscard(): Promise<boolean> {
    if (this.loading()) {
      return true;
    }

    if (JSON.stringify(this.liveForm().getRawValue()) === this.savedValue()) {
      return true;
    }

    return await this.dialogService.openSimpleDialog(
      discardConfirmOptions({
        editing: this.editing,
        createTitleKey: "pamRotationConfigDiscardTitle",
      }),
    );
  }

  protected readonly cancel = async (): Promise<void> => {
    if (!(await this.confirmDiscard())) {
      return;
    }

    await this.navigateBack();
  };

  private navigateBack(): Promise<boolean> {
    this.markSaved();
    return this.router.navigate(this.credentialsListRoute);
  }

  private showError(e: unknown): void {
    const message =
      e instanceof ErrorResponse
        ? (e.message ?? this.i18nService.t("unexpectedError"))
        : this.i18nService.t("unexpectedError");
    this.toastService.showToast({ variant: "error", message });
  }
}

export const rotationConfigEditDiscardGuard: CanDeactivateFn<RotationConfigEditComponent> = (
  component,
) => component.confirmDiscard();
