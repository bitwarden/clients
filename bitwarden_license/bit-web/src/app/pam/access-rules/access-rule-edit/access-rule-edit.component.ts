import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, CanDeactivateFn, Router, RouterLink } from "@angular/router";
import { firstValueFrom, map, switchMap } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { getById } from "@bitwarden/common/platform/misc/rxjs-operators";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  AutofocusDirective,
  BadgeModule,
  BreadcrumbsModule,
  ButtonModule,
  CalloutModule,
  CardComponent,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  HeaderComponent,
  LinkModule,
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
import { isGuid } from "@bitwarden/guid";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  AccessRuleId,
  AccessRuleView,
  AccessCondition,
  ACCESS_RULE_DESCRIPTION_MAX_LENGTH,
  ACCESS_RULE_DURATION_PRESETS,
  ACCESS_RULE_NAME_MAX_LENGTH,
  accessRuleDeleteConfirmOptions,
  accessRuleErrorMessageKey,
  accessRuleToFormValue,
  AccessRuleSdkService,
  AccessRuleErrorField,
  AccessRuleErrorOutcome,
  classifyAccessRuleError,
  conflictingCollectionIds,
  DEFAULT_MAX_EXTENSION_DURATION_SECONDS,
  EXTENSION_DURATION_OPTIONS,
  formValueToRequest,
  isAccessRuleNotFound,
  isIpAllowlist,
  isKnownAccessCondition,
  NO_DURATION_CAP,
  resolveCollectionNames,
  snapToNearestAccessRuleDuration,
} from "../..";
import { discardConfirmOptions } from "../../helpers/discard-confirm";
import { GovernedCollectionsService } from "../../services/governed-collections.service";
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

/** Creates or edits an access rule; create mode prefills from an optional `template` param. */
@Component({
  templateUrl: "./access-rule-edit.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    AutofocusDirective,
    BadgeModule,
    BreadcrumbsModule,
    ButtonModule,
    CalloutModule,
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
  private readonly governedCollections = inject(GovernedCollectionsService);
  private readonly organizationService = inject(OrganizationService);
  private readonly cidrValidation = inject(CidrValidationService);
  private readonly dialogService = inject(DialogService);

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  private readonly organizationId = this.route.snapshot.params.organizationId as OrganizationId;
  private readonly accessRuleId = this.route.snapshot.params.accessRuleId as
    AccessRuleId | undefined;
  /**
   * Set by the list's "Make a copy", so the name field opens selected for a rename. Presence is the
   * signal; the value is not read.
   */
  protected readonly renaming = this.route.snapshot.queryParams.renaming != null;

  protected readonly editing = this.accessRuleId != null;
  protected readonly durationOptions = ACCESS_RULE_DURATION_PRESETS;
  protected readonly extensionDurationOptions = EXTENSION_DURATION_OPTIONS;
  protected readonly noDurationCap = NO_DURATION_CAP;

  /** Null while loading or in create mode. */
  protected readonly existing = signal<AccessRuleView | null>(null);
  protected readonly loading = signal(true);

  /**
   * Shown inline rather than toasted, so it stays beside the entered values. Retry shows only for a
   * `generic` outcome, since a mapped failure needs a change first.
   */
  protected readonly saveError = signal<AccessRuleErrorOutcome | null>(null);

  protected readonly saveErrorMessage = computed(() => {
    const error = this.saveError();
    return error == null
      ? null
      : this.i18nService.t(
          error.kind === "mapped" ? error.messageKey : "pamAccessRuleSaveErrorGeneric",
        );
  });

  private readonly saveErrorCallout = viewChild("saveErrorCallout", {
    read: ElementRef<HTMLElement>,
  });

  private readonly pageTypeKey = this.editing
    ? "pamAccessRuleEditTitle"
    : "pamAccessRuleCreateTitle";

  protected readonly titleText = computed(
    () => this.existing()?.name ?? this.i18nService.t(this.pageTypeKey),
  );

  protected readonly eventLogRoute = ["/organizations", this.organizationId, "pam", "audit"];

  /**
   * Gates the footer notice's event log link. `canAccessEventLogs` also needs the organization's
   * `useEvents` entitlement, which this page's guard does not check.
   */
  protected readonly canAccessEventLogs = toSignal(
    this.activeUserId$.pipe(
      switchMap((userId) => this.organizationService.organizations$(userId)),
      getById(this.organizationId),
      map((organization) => organization?.canAccessEventLogs ?? false),
    ),
    { initialValue: false },
  );

  protected readonly formGroup = this.formBuilder.nonNullable.group({
    name: ["", [Validators.required, Validators.maxLength(ACCESS_RULE_NAME_MAX_LENGTH)]],
    description: ["", [Validators.maxLength(ACCESS_RULE_DESCRIPTION_MAX_LENGTH)]],
    collections: [[] as SelectItemView[], [Validators.required]],
    defaultLeaseDurationSeconds: [
      snapToNearestAccessRuleDuration(undefined),
      [Validators.required],
    ],
    // NO_DURATION_CAP means no cap; otherwise a lease window is clamped to this when it starts.
    maxLeaseDurationSeconds: [NO_DURATION_CAP as number],
    singleActiveLease: [false],
    enabled: [true],
    allowsExtensions: [false],
    // Only meaningful when allowsExtensions is on; the longest a single extension may run.
    maxExtensionDurationSeconds: [DEFAULT_MAX_EXTENSION_DURATION_SECONDS],
    humanApprovalEnabled: [false],
    ipAllowlistEnabled: [false],
    // Array-level validators live here rather than in the editor, so validity flows through this
    // form. Disabled while the condition is off (see coupleIpAllowlistEnabled).
    ipAllowlistCidrs: this.formBuilder.nonNullable.array<string>(
      [],
      [noDuplicateCidrsValidator(), atLeastOneNonEmptyCidrValidator()],
    ),
  });

  /**
   * Condition kinds this client doesn't model, carried through `submit()` unchanged so saving the
   * rule doesn't drop them.
   */
  private readonly unknownConditions = signal<AccessCondition[]>([]);

  private readonly allCollections = signal<{ id: string; name: string }[]>([]);
  private readonly allCollectionsLoading = signal(true);

  /**
   * Collections another rule claims; choosing one fails on the server with `CollectionsGoverned`.
   * Includes disabled rules, as the server's validator does; a failed read excludes nothing.
   */
  private readonly governedCollectionIds = toSignal(
    this.governedCollections
      .rules$(this.organizationId)
      .pipe(
        map(
          (rules) =>
            new Set(
              rules
                .filter((rule) => rule.id !== this.accessRuleId)
                .flatMap((rule) => rule.collections.map(uuidAsString)),
            ),
        ),
      ),
  );

  protected readonly collectionsLoading = computed(
    () => this.allCollectionsLoading() || this.governedCollectionIds() === undefined,
  );

  /**
   * A signal, since `computed()` can't track a `FormControl` value; a deselected but governed
   * collection would otherwise stay in the picker.
   */
  private readonly selectedCollectionIds = toSignal(
    this.formGroup.controls.collections.valueChanges.pipe(
      map((value) => new Set(value.map((c) => c.id))),
    ),
    { initialValue: new Set<string>() },
  );

  /** Keeps selected collections, since dropping one here would remove it from the rule on save. */
  protected readonly collectionOptions = computed<SelectItemView[]>(() => {
    const governed = this.governedCollectionIds();
    const selectedIds = this.selectedCollectionIds();
    return this.allCollections()
      .filter((c) => selectedIds.has(c.id) || !governed?.has(c.id))
      .map((c) => this.toCollectionOption(c));
  });

  constructor() {
    // `bit-callout` isn't a live region and renders above Save; without moving focus a failed
    // save goes unnoticed.
    effect(() => {
      if (this.saveError() == null) {
        return;
      }
      this.saveErrorCallout()?.nativeElement.focus();
    });
    this.coupleDurationBounds();
    this.coupleIpAllowlistEnabled();
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      if (this.editing) {
        const rule = await this.loadRule();
        if (rule == null) {
          return; // loadRule already toasted + navigated away
        }
        this.existing.set(rule);
        this.applyRule(rule);
      } else {
        this.applyTemplate();
      }
    } finally {
      // Collections load after the form shows, behind their own `collectionsLoading` state.
      this.loading.set(false);
    }
    await this.loadCollections(this.existing());
  }

  private async loadRule(): Promise<AccessRuleView | null> {
    // The route param is unchecked; `uuidAsString` unwraps the brand for `isGuid`.
    if (!isGuid(uuidAsString(this.accessRuleId!))) {
      return await this.ruleNotFound();
    }
    try {
      return await this.pamApi.getAccessRule(this.organizationId, this.accessRuleId!);
    } catch (e) {
      if (isAccessRuleNotFound(e)) {
        return await this.ruleNotFound();
      }
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t(accessRuleErrorMessageKey(e)),
      });
      await this.navigateToList();
      return null;
    }
  }

  private async ruleNotFound(): Promise<null> {
    this.toastService.showToast({
      variant: "error",
      message: this.i18nService.t("pamAccessRuleNotFound"),
    });
    await this.navigateToList();
    return null;
  }

  private applyRule(rule: AccessRuleView): void {
    this.unknownConditions.set(rule.conditions?.filter((c) => !isKnownAccessCondition(c)) ?? []);
    this.formGroup.patchValue(accessRuleToFormValue(rule));
    // Seeded separately, since patchValue can't resize a FormArray.
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

  private toCollectionOption(c: { id: string; name: string }): SelectItemView {
    return {
      id: c.id,
      listName: c.name,
      labelName: c.name,
      icon: "bwi-collection-shared",
    };
  }

  private async loadCollections(rule: AccessRuleView | null): Promise<void> {
    try {
      const userId = await firstValueFrom(this.activeUserId$);
      const collections = await firstValueFrom(
        this.collectionAdminService.collectionAdminViews$(this.organizationId, userId),
      );
      this.allCollections.set(collections.map((c) => ({ id: c.id, name: c.name })));

      // Unfiltered, since the control is still empty and `collectionOptions` can't yet exempt this
      // rule's own ids; a stale governed read would otherwise drop one from the rule on save.
      const optionsById = new Map(
        this.allCollections().map((c): [string, SelectItemView] => [
          c.id,
          this.toCollectionOption(c),
        ]),
      );
      const selected = (rule?.collections ?? [])
        .map((id) => optionsById.get(uuidAsString(id)))
        .filter((c: SelectItemView | undefined): c is SelectItemView => c != null);
      this.formGroup.controls.collections.setValue(selected);
    } catch {
      // A failure leaves the form unsaveable, so surface it; nothing awaits `initialize()`, so a
      // rejection would go unseen.
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamAccessRuleCollectionsLoadError"),
      });
    } finally {
      this.allCollectionsLoading.set(false);
    }
  }

  /** Keeps the default duration at or below the max by dragging the other picker along. */
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
   * A disabled control is left out of the form's validity, so leftover CIDR rows can't block submit
   * once the condition is off.
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

  /**
   * Shown on the field, where the fix is, rather than in the callout. Set directly rather than as a
   * validator, so it clears as soon as the admin edits the control.
   */
  private showFieldSaveError(field: AccessRuleErrorField, message: string): void {
    const control = this.formGroup.controls[field];
    control.setErrors({ serverError: { message } });
    control.markAsTouched();
  }

  /** Names the collections at fault, since the server reports only that a conflict exists. */
  private async fieldSaveErrorMessage(messageKey: string): Promise<string> {
    if (messageKey !== "pamAccessRuleErrorCollectionsGoverned") {
      return this.i18nService.t(messageKey);
    }

    const names = await this.conflictingCollectionNames();
    return names.length === 0
      ? this.i18nService.t(messageKey)
      : this.i18nService.t("pamAccessRuleErrorCollectionsGovernedNamed", names.join(", "));
  }

  /**
   * Read fresh, since a conflict may have appeared after this page loaded. Empty on a failed read
   * or one that disagrees with the server, which leaves the unnamed copy in place.
   */
  private async conflictingCollectionNames(): Promise<string[]> {
    try {
      const rules = await this.pamApi.listAccessRules(this.organizationId);
      const conflicting = conflictingCollectionIds(
        rules,
        this.formGroup.controls.collections.value.map((c) => c.id),
        this.existing()?.id,
      );
      return resolveCollectionNames(conflicting, this.allCollections());
    } catch {
      return [];
    }
  }

  protected readonly submit = async (): Promise<void> => {
    this.saveError.set(null);
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const request = formValueToRequest(this.formGroup.getRawValue(), this.unknownConditions());

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
      // The write changed which collections are governed, so the cached read is stale.
      this.governedCollections.invalidate(this.organizationId);
      await this.navigateToList();
    } catch (e) {
      const outcome = classifyAccessRuleError(e);
      if (outcome.kind === "mapped" && outcome.field != null) {
        this.showFieldSaveError(
          outcome.field,
          await this.fieldSaveErrorMessage(outcome.messageKey),
        );
        return;
      }
      this.saveError.set(outcome);
    }
  };

  /**
   * Called by Cancel and by the route's CanDeactivate guard, which covers the breadcrumb and
   * browser back and forward.
   */
  async confirmDiscard(): Promise<boolean> {
    if (!this.formGroup.dirty) {
      return true;
    }

    return await this.dialogService.openSimpleDialog(
      discardConfirmOptions({ editing: this.editing, createTitleKey: "pamAccessRuleDiscardTitle" }),
    );
  }

  protected readonly cancel = async (): Promise<void> => {
    if (!(await this.confirmDiscard())) {
      return;
    }

    await this.navigateToList();
  };

  protected readonly remove = async (): Promise<void> => {
    const existing = this.existing();
    if (existing == null) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog(
      accessRuleDeleteConfirmOptions(existing.name),
    );
    if (!confirmed) {
      return;
    }

    try {
      await this.pamApi.deleteAccessRule(this.organizationId, existing.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamAccessRuleDeleted"),
      });
      // Deleting frees this rule's collections.
      this.governedCollections.invalidate(this.organizationId);
      await this.navigateToList();
    } catch (e) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t(accessRuleErrorMessageKey(e)),
      });
    }
  };

  private navigateToList(): Promise<boolean> {
    // An exit the admin already agreed to; the CanDeactivate guard must not ask a second time.
    this.formGroup.markAsPristine();
    return this.router.navigate([".."], { relativeTo: this.route });
  }
}

export const accessRuleEditDiscardGuard: CanDeactivateFn<AccessRuleEditComponent> = (component) =>
  component.confirmDiscard();
