import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  BreadcrumbsModule,
  ButtonModule,
  CardComponent,
  CheckboxModule,
  FormFieldModule,
  HeaderComponent,
  MultiSelectModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectItemView,
  SelectModule,
  SpinnerComponent,
  ToastService,
  TypographyModule,
  ContainerComponent,
} from "@bitwarden/components";
import type { CollectionId as SdkCollectionId } from "@bitwarden/sdk-internal";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  AccessRuleAddEditRequest,
  AccessRuleView,
  AccessCondition,
  ACCESS_RULE_DURATION_PRESETS,
  AccessRuleSdkService,
  accessRuleErrorMessage,
  isAccessRuleNotFound,
  isHumanApproval,
  isIpAllowlist,
  isKnownAccessCondition,
  snapToNearestAccessRuleDuration,
  snapToNearestDuration,
} from "../..";
import { ACCESS_RULE_TEMPLATES } from "../access-rule-templates";

import { CidrValidationService } from "./ip-allowlist/cidr-validation.service";
import {
  atLeastOneNonEmptyCidrValidator,
  noDuplicateCidrsValidator,
} from "./ip-allowlist/cidr.validator";
import {
  cidrRowControl,
  IpAllowlistEditorComponent,
} from "./ip-allowlist/ip-allowlist-editor.component";

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

/**
 * Routed page for creating or editing a PAM access rule. Edit mode is entered via the
 * `accessRuleId` route param and fetches the rule with {@link AccessRuleSdkService.getAccessRule}
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
    MultiSelectModule,
    SectionComponent,
    SectionHeaderComponent,
    SelectModule,
    SpinnerComponent,
    TypographyModule,
    I18nPipe,
    ContainerComponent,
  ],
})
export class AccessRuleEditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly pamApi = inject(AccessRuleSdkService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly accountService = inject(AccountService);
  private readonly collectionAdminService = inject(CollectionAdminService);
  private readonly cidrValidation = inject(CidrValidationService);

  private readonly organizationId = this.route.snapshot.params.organizationId as OrganizationId;
  private readonly accessRuleId = this.route.snapshot.params.accessRuleId as string | undefined;

  protected readonly editing = this.accessRuleId != null;
  protected readonly durationOptions = ACCESS_RULE_DURATION_PRESETS;
  protected readonly extensionDurationOptions = EXTENSION_DURATION_OPTIONS;
  protected readonly noDurationCap = NO_DURATION_CAP;

  /** The rule being edited, loaded in edit mode; null while loading or in create mode. */
  protected readonly existing = signal<AccessRuleView | null>(null);
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
    // A CIDR-per-row FormArray rendered by the IP allowlist editor. The array-level
    // validators live here (not in the editor) so validity flows through this form;
    // per-row CIDR validation rides on each pushed control. Disabled while the
    // condition is off (see coupleIpAllowlistEnabled) so an empty/blank array doesn't
    // block submit. `getRawValue()` still yields the flat `string[]`.
    ipAllowlistCidrs: this.formBuilder.nonNullable.array<string>(
      [],
      [noDuplicateCidrsValidator(), atLeastOneNonEmptyCidrValidator()],
    ),
  });

  /**
   * Condition kinds this client doesn't model (e.g. the server's `time_of_day`),
   * stashed off the loaded rule so `submit()` can carry them forward unchanged.
   * The checkbox-driven form only rebuilds the known kinds (`human_approval` /
   * `ip_allowlist`); without this, editing any other property of a rule that
   * carries an unrecognised condition would silently drop it on save. Empty for
   * the create flow, where there is no existing rule to preserve conditions from.
   */
  private readonly unknownConditions = signal<AccessCondition[]>([]);

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
    this.coupleIpAllowlistEnabled();
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
    } finally {
      // Reveal the form once the rule (edit mode) is applied; collections then
      // stream into the multi-select behind its own `collectionsLoading` state,
      // so the form isn't blocked on them.
      this.loading.set(false);
    }
    await this.loadCollections(this.existing());
  }

  /** Fetch the rule under edit; on a stale/inaccessible id (or any other failure), toast and route back. */
  private async loadRule(): Promise<AccessRuleView | null> {
    try {
      return await this.pamApi.getAccessRule(this.organizationId, this.accessRuleId!);
    } catch (e) {
      const message = isAccessRuleNotFound(e)
        ? this.i18nService.t("pamAccessRuleNotFound")
        : (accessRuleErrorMessage(e) ?? this.i18nService.t("pamAccessRuleNotFound"));
      this.toastService.showToast({ variant: "error", message });
      await this.navigateToList();
      return null;
    }
  }

  private applyRule(rule: AccessRuleView): void {
    this.unknownConditions.set(rule.conditions?.filter((c) => !isKnownAccessCondition(c)) ?? []);
    this.formGroup.patchValue({
      name: rule.name,
      description: rule.description ?? "",
      defaultLeaseDurationSeconds: snapToNearestAccessRuleDuration(
        rule.defaultLeaseDurationSeconds,
      ),
      // Snap max/extension to their pickers' options too (like the default), so a
      // value persisted outside the option set renders against an option rather
      // than leaving the select blank.
      maxLeaseDurationSeconds:
        rule.maxLeaseDurationSeconds == null
          ? NO_DURATION_CAP
          : snapToNearestAccessRuleDuration(rule.maxLeaseDurationSeconds),
      singleActiveLease: rule.singleActiveLease,
      enabled: rule.enabled,
      allowsExtensions: rule.allowsExtensions,
      maxExtensionDurationSeconds:
        rule.maxExtensionDurationSeconds == null
          ? DEFAULT_MAX_EXTENSION_DURATION_SECONDS
          : snapToNearestDuration(rule.maxExtensionDurationSeconds, EXTENSION_DURATION_OPTIONS),
      humanApprovalEnabled: rule.conditions?.some(isHumanApproval) ?? false,
      ipAllowlistEnabled: rule.conditions?.some(isIpAllowlist) ?? false,
    });
    // Seed the CIDR rows separately: a FormArray can't be resized via patchValue.
    this.setIpAllowlistCidrs(rule.conditions?.find(isIpAllowlist)?.cidrs ?? []);
  }

  private applyTemplate(): void {
    const key = this.route.snapshot.queryParams.template as string | undefined;
    const prefill = ACCESS_RULE_TEMPLATES.find((t) => t.key === key)?.prefill;
    if (prefill == null) {
      return;
    }
    this.formGroup.patchValue({
      name: this.i18nService.t(prefill.nameKey),
      defaultLeaseDurationSeconds: snapToNearestAccessRuleDuration(
        prefill.defaultLeaseDurationSeconds,
      ),
      humanApprovalEnabled: prefill.humanApprovalEnabled,
      ipAllowlistEnabled: prefill.ipAllowlistEnabled,
    });
  }

  private async loadCollections(rule: AccessRuleView | null): Promise<void> {
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const collections = await firstValueFrom(
        this.collectionAdminService.collectionAdminViews$(this.organizationId, userId),
      );
      this.allCollections.set(collections.map((c) => ({ id: c.id, name: c.name })));

      // Map the rule's stored collection IDs onto the now-loaded options so the
      // chips render with real names rather than raw UUIDs.
      const optionsById = new Map(
        this.collectionOptions().map((c): [string, SelectItemView] => [c.id, c]),
      );
      const selected = (rule?.collections ?? [])
        .map((id) => optionsById.get(uuidAsString(id)))
        .filter((c: SelectItemView | undefined): c is SelectItemView => c != null);
      this.formGroup.controls.collections.setValue(selected);
    } catch {
      // The collections list drives a required control, so a load failure leaves
      // the form unable to be saved; surface it rather than failing silently (this
      // runs outside initialize()'s await, so an unhandled rejection would be invisible).
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamAccessRuleCollectionsLoadError"),
      });
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

  /**
   * Keep the CIDR array enabled only while the ip_allowlist condition is on. A disabled
   * control is excluded from the form's validity, so a lingering blank or empty array can't
   * block submit once the condition is switched back off — the same effect the previous
   * ControlValueAccessor got for free by mounting/unmounting its validator with the editor.
   */
  private coupleIpAllowlistEnabled(): void {
    const enabledControl = this.formGroup.controls.ipAllowlistEnabled;
    const cidrsControl = this.formGroup.controls.ipAllowlistCidrs;

    const apply = (enabled: boolean): void => {
      if (enabled) {
        cidrsControl.enable({ emitEvent: false });
      } else {
        cidrsControl.disable({ emitEvent: false });
      }
    };

    apply(enabledControl.value);
    enabledControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(apply);
  }

  /** Replace the CIDR rows with one control per loaded value; a FormArray can't be patched to a new length. */
  private setIpAllowlistCidrs(cidrs: string[]): void {
    const array = this.formGroup.controls.ipAllowlistCidrs;
    const message = this.i18nService.t("accessRuleIpAllowlistInvalidCidr");
    array.clear({ emitEvent: false });
    for (const cidr of cidrs) {
      array.push(
        cidrRowControl(cidr, message, (v) => this.cidrValidation.isValid(v)),
        {
          emitEvent: false,
        },
      );
    }
    array.updateValueAndValidity({ emitEvent: false });
  }

  protected readonly submit = async (): Promise<void> => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const value = this.formGroup.getRawValue();
    const conditions: AccessCondition[] = [];

    if (value.humanApprovalEnabled) {
      conditions.push({ kind: "human_approval" });
    }

    if (value.ipAllowlistEnabled) {
      conditions.push({
        kind: "ip_allowlist",
        cidrs: value.ipAllowlistCidrs.map((c) => c.trim()).filter((c) => c !== ""),
      });
    }

    // Carry forward any condition kinds this client doesn't model (e.g. the
    // server's `time_of_day`) so editing an unrelated field on the rule doesn't
    // silently delete them. See `unknownConditions` for why this is additive
    // rather than round-tripping the whole array.
    conditions.push(...this.unknownConditions());

    // No runtime UUID validation here (unlike the SDK-boundary code in
    // `AccessRulesSdkService`) — this is just a type-level bridge from the
    // multi-select's plain string ids to the SDK's branded `CollectionId`.
    const request: AccessRuleAddEditRequest = {
      name: value.name,
      description: value.description.length === 0 ? undefined : value.description,
      conditions,
      collections: value.collections.map((i) => i.id as unknown as SdkCollectionId),
      defaultLeaseDurationSeconds: value.defaultLeaseDurationSeconds,
      maxLeaseDurationSeconds:
        value.maxLeaseDurationSeconds === NO_DURATION_CAP
          ? undefined
          : value.maxLeaseDurationSeconds,
      singleActiveLease: value.singleActiveLease,
      enabled: value.enabled,
      allowsExtensions: value.allowsExtensions,
      maxExtensionDurationSeconds: value.allowsExtensions
        ? value.maxExtensionDurationSeconds
        : undefined,
    };

    try {
      const existing = this.existing();
      if (existing != null) {
        await this.pamApi.updateAccessRule(this.organizationId, uuidAsString(existing.id), request);
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
      const message = accessRuleErrorMessage(e) ?? this.i18nService.t("unexpectedError");
      this.toastService.showToast({ variant: "error", message });
    }
  };

  protected readonly cancel = (): Promise<boolean> => this.navigateToList();

  /** Return to the access-rules list (the parent of both the `new` and `:id` routes). */
  private navigateToList(): Promise<boolean> {
    return this.router.navigate([".."], { relativeTo: this.route });
  }
}
