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
  DEFAULT_MAX_EXTENSION_DURATION_SECONDS,
  EXTENSION_DURATION_OPTIONS,
  formValueToRequest,
  isAccessRuleNotFound,
  isIpAllowlist,
  isKnownAccessCondition,
  NO_DURATION_CAP,
  snapToNearestAccessRuleDuration,
} from "../..";
import { discardConfirmOptions } from "../../helpers/discard-confirm";
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
import { RuleBypassableCiphersCalloutComponent } from "./rule-bypassable-ciphers-callout/rule-bypassable-ciphers-callout.component";

/**
 * Routed page for creating or editing a PAM access rule. Edit mode fetches the rule via
 * `accessRuleId` (route param) through {@link AccessRuleSdkService.getAccessRule}; create mode
 * reads an optional `template` query param to prefill.
 *
 * Groups the form into card sections per the design; on save, routes back to the access-rules
 * list.
 */
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
    RuleBypassableCiphersCalloutComponent,
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
  private readonly organizationService = inject(OrganizationService);
  private readonly cidrValidation = inject(CidrValidationService);
  private readonly dialogService = inject(DialogService);

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  // Protected, not private: the bypassable-ciphers callout takes both as inputs.
  protected readonly organizationId = this.route.snapshot.params.organizationId as OrganizationId;
  protected readonly accessRuleId = this.route.snapshot.params.accessRuleId as
    AccessRuleId | undefined;
  /**
   * Set by the list's "Make a copy": the rule was just created from another one and its name
   * still carries the "(copy)" suffix, so the admin's first act is almost certainly to rename it.
   * Drives the name field's autofocus-and-select; presence is the signal, the value is not read.
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
   * The inline save-failure callout; null while there is nothing to report. Never toasted, so the
   * notice persists alongside entered values. Retry shows only for a `generic` outcome — a mapped
   * failure needs a change first, or resubmitting fails identically.
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

  /**
   * The page heading. Edit mode shows the rule's own name, per the design; it falls back to
   * the page-type label until the rule has loaded. Create mode keeps the page-type label,
   * since there is no name yet and a blank heading would be worse.
   */
  protected readonly titleText = computed(
    () => this.existing()?.name ?? this.i18nService.t(this.pageTypeKey),
  );

  protected readonly eventLogRoute = ["/organizations", this.organizationId, "pam", "audit"];

  /**
   * Gates the footer notice. `canManageAccessRules` (this page's guard) does not imply access to
   * event logs: `canAccessEventLogs` also requires the organization's `useEvents` entitlement, and
   * without it the PAM audit route's own guard bounces the admin straight back out.
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

  /** Fetch the rule under edit; on a stale/inaccessible id (or any other failure), toast and route back. */
  private async loadRule(): Promise<AccessRuleView | null> {
    // `accessRuleId` is only a *claimed* id until checked; `uuidAsString` unwraps the brand for
    // `isGuid`.
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

  /** Toast and route back to the list for an id that does not resolve to a rule, malformed or not. */
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

  private async loadCollections(rule: AccessRuleView | null): Promise<void> {
    try {
      const userId = await firstValueFrom(this.activeUserId$);
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
      // A failure leaves the form unsaveable, so surface it; nothing awaits `initialize()`, so a
      // rejection would go unseen.
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamAccessRuleCollectionsLoadError"),
      });
    } finally {
      this.collectionsLoading.set(false);
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
   * Report a rejected save that names a specific field on that field, where the fix is, rather than
   * in the callout above the form. The error is set directly rather than through a validator so it
   * clears the moment the admin edits the control — the next `updateValueAndValidity` recomputes
   * from the validators alone.
   */
  private showFieldSaveError(field: AccessRuleErrorField, messageKey: string): void {
    const control = this.formGroup.controls[field];
    control.setErrors({ serverError: { message: this.i18nService.t(messageKey) } });
    control.markAsTouched();
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
      await this.navigateToList();
    } catch (e) {
      const outcome = classifyAccessRuleError(e);
      if (outcome.kind === "mapped" && outcome.field != null) {
        this.showFieldSaveError(outcome.field, outcome.messageKey);
        return;
      }
      this.saveError.set(outcome);
    }
  };

  /**
   * Confirm before unsaved edits are thrown away. Called both by Cancel and by the route's
   * CanDeactivate guard, which covers the breadcrumb and browser back/forward. A pristine form
   * has nothing to lose, so it skips the dialog rather than asking about an empty page.
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

  /**
   * Delete the rule under edit, after confirmation. Edit mode only — there is nothing
   * to delete before the rule exists on the server.
   */
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
      await this.navigateToList();
    } catch (e) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t(accessRuleErrorMessageKey(e)),
      });
    }
  };

  /** Return to the access-rules list (the parent of both the `new` and `:id` routes). */
  private navigateToList(): Promise<boolean> {
    // An exit the admin already agreed to; the CanDeactivate guard must not ask a second time.
    this.formGroup.markAsPristine();
    return this.router.navigate([".."], { relativeTo: this.route });
  }
}

export const accessRuleEditDiscardGuard: CanDeactivateFn<AccessRuleEditComponent> = (component) =>
  component.confirmDiscard();
