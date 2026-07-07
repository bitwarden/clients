import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import {
  AccessRuleRequest,
  AccessRuleResponse,
  AccessCondition,
  ACCESS_RULE_DURATION_PRESETS,
  PamApiService,
  snapToNearestAccessRuleDuration,
} from "@bitwarden/bit-pam";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  BreadcrumbsModule,
  ButtonModule,
  CardComponent,
  CheckboxModule,
  FormFieldModule,
  HeaderComponent,
  LinkModule,
  MultiSelectModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectItemView,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { IpAllowlistEditorComponent } from "../access-rule-editor/ip-allowlist/ip-allowlist-editor.component";

import { AccessRuleTemplateKey } from "./access-rules-empty-state.component";

const NAME_MAX_LENGTH = 256;

/** The "no maximum" option in the max-duration picker; never constrains the default. */
const NO_DURATION_CAP = 0;

/** Admin-selectable maximum extension lengths, in seconds (30m–8h). */
const EXTENSION_DURATION_OPTIONS: ReadonlyArray<{ seconds: number; labelKey: string }> = [
  { seconds: 30 * 60, labelKey: "pamAccessRuleDuration30m" },
  { seconds: 60 * 60, labelKey: "pamAccessRuleDuration1h" },
  { seconds: 2 * 60 * 60, labelKey: "pamAccessRuleDuration2h" },
  { seconds: 4 * 60 * 60, labelKey: "pamAccessRuleDuration4h" },
  { seconds: 8 * 60 * 60, labelKey: "pamAccessRuleDuration8h" },
];

/** Default maximum extension length offered when a rule first enables extensions (1h). */
const DEFAULT_MAX_EXTENSION_DURATION_SECONDS = 60 * 60;

/** Prefill applied to a new rule when a starter template is chosen on the empty state. */
const TEMPLATE_PREFILLS: Record<
  AccessRuleTemplateKey,
  {
    nameKey: string;
    defaultLeaseDurationSeconds: number;
    humanApprovalEnabled: boolean;
    ipAllowlistEnabled: boolean;
  }
> = {
  "just-in-time": {
    nameKey: "pamTemplateJustInTimeName",
    defaultLeaseDurationSeconds: 60 * 60,
    humanApprovalEnabled: false,
    ipAllowlistEnabled: false,
  },
  "approval-required": {
    nameKey: "pamTemplateApprovalRequiredName",
    defaultLeaseDurationSeconds: 60 * 60,
    humanApprovalEnabled: true,
    ipAllowlistEnabled: false,
  },
  "ip-restricted": {
    nameKey: "pamTemplateIpRestrictedName",
    defaultLeaseDurationSeconds: 60 * 60,
    humanApprovalEnabled: false,
    ipAllowlistEnabled: true,
  },
};

function isTemplateKey(value: string | null | undefined): value is AccessRuleTemplateKey {
  return value != null && value in TEMPLATE_PREFILLS;
}

/**
 * Routed page for creating or editing a PAM access rule. Edit mode is entered via the
 * `accessRuleId` route param and fetches the rule with {@link PamApiService.getAccessRule}
 * so the page works on deep-link/refresh; create mode reads an optional `template` query
 * param to prefill from a starter template. Groups the form into card sections
 * (General info / Access duration / Optional conditions) per the design; on save it
 * routes back to the access-rules list.
 */
@Component({
  templateUrl: "./access-rule-edit.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    BreadcrumbsModule,
    ButtonModule,
    CardComponent,
    CheckboxModule,
    FormFieldModule,
    HeaderComponent,
    IpAllowlistEditorComponent,
    LinkModule,
    MultiSelectModule,
    RouterLink,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    I18nPipe,
  ],
})
export class AccessRuleEditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly pamApi = inject(PamApiService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly accountService = inject(AccountService);
  private readonly collectionAdminService = inject(CollectionAdminService);

  private readonly organizationId = this.route.snapshot.params.organizationId as OrganizationId;
  private readonly accessRuleId = this.route.snapshot.params.accessRuleId as string | undefined;

  protected readonly editing = this.accessRuleId != null;
  protected readonly durationOptions = ACCESS_RULE_DURATION_PRESETS;
  protected readonly extensionDurationOptions = EXTENSION_DURATION_OPTIONS;
  protected readonly noDurationCap = NO_DURATION_CAP;

  /** The rule being edited, loaded in edit mode; null while loading or in create mode. */
  protected readonly existing = signal<AccessRuleResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly titleText = computed(() =>
    this.i18nService.t(this.editing ? "pamAccessRuleEditTitle" : "pamAccessRuleCreateTitle"),
  );

  protected readonly formGroup = this.formBuilder.nonNullable.group({
    name: ["", [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)]],
    description: [""],
    collections: [[] as SelectItemView[], [Validators.required]],
    defaultLeaseDurationSeconds: [
      snapToNearestAccessRuleDuration(undefined),
      [Validators.required],
    ],
    // Hard ceiling on any single lease's duration. NO_DURATION_CAP (the first
    // option) means "no cap"; otherwise the lease window is clamped to this at start.
    maxLeaseDurationSeconds: [NO_DURATION_CAP as number],
    singleActiveLease: [false],
    enabled: [true],
    allowsExtensions: [false],
    // Only meaningful when allowsExtensions is on; the longest a single extension may run.
    maxExtensionDurationSeconds: [DEFAULT_MAX_EXTENSION_DURATION_SECONDS],
    humanApprovalEnabled: [false],
    ipAllowlistEnabled: [false],
    // Bound to the IP allowlist editor (a ControlValueAccessor + Validator) when the
    // condition is enabled; the editor owns its own row-level validation.
    ipAllowlistCidrs: [[] as string[]],
  });

  private readonly allCollections = signal<{ id: string; name: string }[]>([]);
  protected readonly collectionsLoading = signal(true);

  protected readonly collectionOptions = computed<SelectItemView[]>(() =>
    this.allCollections().map((c) => ({
      id: c.id,
      listName: c.name,
      labelName: c.name,
      icon: "bwi-collection-shared",
    })),
  );

  constructor() {
    this.coupleDurationBounds();
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const rule = this.editing ? await this.loadRule() : null;
      if (this.editing && rule == null) {
        return; // loadRule already toasted + navigated away
      }
      if (rule != null) {
        this.existing.set(rule);
        this.applyRule(rule);
      } else {
        this.applyTemplate();
      }
      await this.loadCollections(rule);
    } finally {
      this.loading.set(false);
    }
  }

  /** Fetch the rule under edit; on a stale/inaccessible id, toast and route back. */
  private async loadRule(): Promise<AccessRuleResponse | null> {
    try {
      return await this.pamApi.getAccessRule(this.organizationId, this.accessRuleId!);
    } catch {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamAccessRuleNotFound"),
      });
      await this.navigateToList();
      return null;
    }
  }

  private applyRule(rule: AccessRuleResponse): void {
    this.formGroup.patchValue({
      name: rule.name,
      description: rule.description ?? "",
      defaultLeaseDurationSeconds: snapToNearestAccessRuleDuration(
        rule.defaultLeaseDurationSeconds,
      ),
      maxLeaseDurationSeconds: rule.maxLeaseDurationSeconds ?? NO_DURATION_CAP,
      singleActiveLease: rule.singleActiveLease,
      enabled: rule.enabled,
      allowsExtensions: rule.allowsExtensions,
      maxExtensionDurationSeconds:
        rule.maxExtensionDurationSeconds ?? DEFAULT_MAX_EXTENSION_DURATION_SECONDS,
      humanApprovalEnabled: hasKind(rule.conditions, "human_approval"),
      ipAllowlistEnabled: hasKind(rule.conditions, "ip_allowlist"),
      ipAllowlistCidrs: findCidrs(rule.conditions),
    });
  }

  private applyTemplate(): void {
    const key = this.route.snapshot.queryParams.template as string | undefined;
    if (!isTemplateKey(key)) {
      return;
    }
    const prefill = TEMPLATE_PREFILLS[key];
    this.formGroup.patchValue({
      name: this.i18nService.t(prefill.nameKey),
      defaultLeaseDurationSeconds: snapToNearestAccessRuleDuration(
        prefill.defaultLeaseDurationSeconds,
      ),
      humanApprovalEnabled: prefill.humanApprovalEnabled,
      ipAllowlistEnabled: prefill.ipAllowlistEnabled,
    });
  }

  private async loadCollections(rule: AccessRuleResponse | null): Promise<void> {
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const collections = await firstValueFrom(
        this.collectionAdminService.collectionAdminViews$(this.organizationId, userId),
      );
      this.allCollections.set(collections.map((c) => ({ id: c.id, name: c.name })));

      // Map the rule's stored collection IDs onto the now-loaded options so the
      // chips render with real names rather than raw UUIDs.
      const optionsById = new Map(this.collectionOptions().map((c) => [c.id, c]));
      const selected = (rule?.collections ?? [])
        .map((id) => optionsById.get(id))
        .filter((c): c is SelectItemView => c != null);
      this.formGroup.controls.collections.setValue(selected);
    } finally {
      this.collectionsLoading.set(false);
    }
  }

  /**
   * Keep the default duration at or below the max: when the user moves one picker
   * past the other, drag the other along so the pair stays consistent. A max of
   * {@link NO_DURATION_CAP} ("no maximum") never constrains the default. Mutations
   * use `emitEvent: false` so the paired control updates without re-triggering this.
   */
  private coupleDurationBounds(): void {
    const defaultControl = this.formGroup.controls.defaultLeaseDurationSeconds;
    const maxControl = this.formGroup.controls.maxLeaseDurationSeconds;

    defaultControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (maxControl.value !== NO_DURATION_CAP && value > maxControl.value) {
        maxControl.setValue(value, { emitEvent: false });
      }
    });

    maxControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value !== NO_DURATION_CAP && value < defaultControl.value) {
        defaultControl.setValue(value, { emitEvent: false });
      }
    });
  }

  protected readonly submit = async (): Promise<void> => {
    this.formGroup.markAllAsTouched();
    // markAllAsTouched doesn't re-run the IP allowlist editor's validator, so nudge it
    // to surface its inline errors on a blind submit before checking overall validity.
    this.formGroup.controls.ipAllowlistCidrs.updateValueAndValidity();
    if (this.formGroup.invalid) {
      return;
    }

    const value = this.formGroup.getRawValue();
    const conditions: AccessCondition[] = [];

    if (value.humanApprovalEnabled) {
      conditions.push({
        kind: "human_approval",
        approvers: { mode: "collection_managers" },
      });
    }

    if (value.ipAllowlistEnabled) {
      conditions.push({
        kind: "ip_allowlist",
        cidrs: value.ipAllowlistCidrs.filter((c) => c !== ""),
      });
    }

    const request = new AccessRuleRequest({
      name: value.name,
      description: value.description.length === 0 ? null : value.description,
      conditions,
      collections: value.collections.map((i) => i.id),
      defaultLeaseDurationSeconds: value.defaultLeaseDurationSeconds,
      maxLeaseDurationSeconds:
        value.maxLeaseDurationSeconds === NO_DURATION_CAP ? null : value.maxLeaseDurationSeconds,
      singleActiveLease: value.singleActiveLease,
      enabled: value.enabled,
      allowsExtensions: value.allowsExtensions,
      maxExtensionDurationSeconds: value.allowsExtensions
        ? value.maxExtensionDurationSeconds
        : null,
    });

    try {
      const existing = this.existing();
      if (existing != null) {
        await this.pamApi.updateAccessRule(this.organizationId, existing.id, request);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessRuleUpdated"),
        });
      } else {
        await this.pamApi.createAccessRule(this.organizationId, request);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessRuleCreated"),
        });
      }
      await this.navigateToList();
    } catch (e) {
      const message =
        e instanceof ErrorResponse
          ? (e.message ?? this.i18nService.t("unexpectedError"))
          : this.i18nService.t("unexpectedError");
      this.toastService.showToast({ variant: "error", message });
    }
  };

  protected readonly cancel = (): Promise<boolean> => this.navigateToList();

  /** Return to the access-rules list (the parent of both the `new` and `:id` routes). */
  private navigateToList(): Promise<boolean> {
    return this.router.navigate([".."], { relativeTo: this.route });
  }
}

function hasKind(
  conditions: AccessCondition[] | undefined,
  kind: AccessCondition["kind"],
): boolean {
  return conditions?.some((c) => c.kind === kind) ?? false;
}

function findCidrs(conditions: AccessCondition[]): string[] {
  const ip = conditions.find(
    (c): c is Extract<AccessCondition, { kind: "ip_allowlist" }> => c.kind === "ip_allowlist",
  );
  return ip?.cidrs ?? [];
}
