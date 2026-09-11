import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, CanDeactivateFn, Router } from "@angular/router";
import { map } from "rxjs";

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

/** The edit page's two tabs, each with a URL of its own. Configuration, the first, is the default. */
const ROTATION_CONFIG_EDIT_TABS = ["configuration", "history"] as const;

export type RotationConfigEditTab = (typeof ROTATION_CONFIG_EDIT_TABS)[number];

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

  /** The tab the URL names, as {@link tabFromSegment} reads it. */
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

  /** Whether the loading branch is on screen. */
  protected readonly loadingVisible = computed(() => this.loading() || this.showSkeleton());

  /** The error that stopped this page being filled in, or null. */
  protected readonly loadError = signal<unknown | null>(null);

  /** Four blocks, the rough depth of the card each of these pages opens with. */
  protected readonly skeletonFields = [0, 1, 2, 3];

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

  /** Whether the picker has anything to offer. */
  protected readonly hasActiveTargetSystems = computed(() => this.activeTargetSystems().length > 0);

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
    this.configuredCipherIds.set(new Set(configs.map((c) => c.cipherId)));
    this.applyPreselectedTargetSystem();
  }

  /** Select {@link preselectedTargetSystemId} if it names a target the picker actually offers. */
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
   * Edit mode: one save for the account and the schedule together, since the server takes
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

  /**
   * Leave for the target-system create page, marked so that page returns here with the target it
   * creates already selected instead of landing on the target-systems list.
   */
  protected readonly createTargetSystem = (): Promise<boolean> =>
    this.router.navigate(["target-systems", "new"], {
      relativeTo: this.route.parent,
      queryParams: { [THEN_QUERY_PARAM]: THEN_MANAGED_CREDENTIAL },
    });

  private liveForm(): AbstractControl {
    return this.editing ? this.editForm : this.createForm;
  }

  /** The live form's value as the admin was last shown it, serialized. */
  private readonly savedValue = signal("");

  private markSaved(): void {
    this.savedValue.set(JSON.stringify(this.liveForm().getRawValue()));
  }

  /**
   * Confirm before unsaved input is thrown away. Called both by Cancel and by the route's
   * CanDeactivate guard, which covers the breadcrumb and browser back/forward. A tab switch is not
   * an exit: the route keeps the guard off a `:tab` change, and the reused component keeps the
   * input.
   *
   * While the page is still loading there is nothing to discard: `savedValue` is only filled by
   * `markSaved()` once `initialize()` settles, so until then it holds no snapshot to compare
   * against and every exit would be prompted. `initialize()` clears `loading` and marks saved back
   * to back in the same `finally`, so no window is left where one is done and the other is not.
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

  /** Return to the managed-credentials tab. */
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
