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
import { I18nPipe } from "@bitwarden/ui-common";

import {
  AccessRuleId,
  AccessRuleView,
  AccessCondition,
  ACCESS_RULE_DURATION_PRESETS,
  accessRuleDeleteConfirmOptions,
  accessRuleErrorMessage,
  accessRuleToFormValue,
  AccessRuleSdkService,
  DEFAULT_MAX_EXTENSION_DURATION_SECONDS,
  EXTENSION_DURATION_OPTIONS,
  formValueToRequest,
  isAccessRuleCollectionConflict,
  isAccessRuleNotFound,
  isIpAllowlist,
  isKnownAccessCondition,
  NO_DURATION_CAP,
  snapToNearestAccessRuleDuration,
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
  private readonly organizationService = inject(OrganizationService);
  private readonly cidrValidation = inject(CidrValidationService);
  private readonly dialogService = inject(DialogService);

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  private readonly organizationId = this.route.snapshot.params.organizationId as OrganizationId;
  private readonly accessRuleId = this.route.snapshot.params.accessRuleId as
    AccessRuleId | undefined;
  /** In create mode, the id of a rule to seed the form from (the row menu's "Duplicate"). */
  private readonly duplicateFromId = this.route.snapshot.queryParams.duplicateFrom as
    AccessRuleId | undefined;

  protected readonly editing = this.accessRuleId != null;
  protected readonly durationOptions = ACCESS_RULE_DURATION_PRESETS;
  protected readonly extensionDurationOptions = EXTENSION_DURATION_OPTIONS;
  protected readonly noDurationCap = NO_DURATION_CAP;

  /** The rule being edited, loaded in edit mode; null while loading or in create mode. */
  protected readonly existing = signal<AccessRuleView | null>(null);
  protected readonly loading = signal(true);

  /**
   * Message for the inline save-failure callout; null while there is nothing to report.
   * A failed save must not toast — the notice has to persist alongside the entered values
   * so the admin can retry without re-keying the form.
   */
  protected readonly saveError = signal<string | null>(null);

  private readonly saveErrorCallout = viewChild("saveErrorCallout", {
    read: ElementRef<HTMLElement>,
  });

  /**
   * True while a deliberate exit is under way (saved, deleted, or a confirmed discard), so
   * {@link confirmDiscard} doesn't ask a second time for a navigation the admin already agreed to.
   */
  private readonly leaving = signal(false);

  protected readonly pageTypeKey = this.editing
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

  protected readonly eventLogRoute = ["/organizations", this.organizationId, "reporting", "events"];

  /**
   * Gates the footer notice. `canManageAccessRules` (this page's guard) does not imply access to
   * event logs: `canAccessEventLogs` also requires the organization's `useEvents` entitlement, and
   * without it the reporting route bounces the admin straight back out.
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
    // `bit-callout` is not a live region and the callout renders above three sections of form
    // while Save sits below them, so without moving focus a failed save is silent for a screen
    // reader and off-screen for everyone else.
    effect(() => {
      this.saveErrorCallout()?.nativeElement.focus();
    });
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
      } else if (this.duplicateFromId != null) {
        await this.applyDuplicateSource(this.duplicateFromId);
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
    this.formGroup.patchValue(accessRuleToFormValue(rule));
    // Seed the CIDR rows separately: a FormArray can't be resized via patchValue.
    this.setIpAllowlistCidrs(rule.conditions?.find(isIpAllowlist)?.cidrs ?? []);
  }

  /**
   * Seed the create form from an existing rule (the list's "Duplicate" action). Everything
   * copies over — including condition kinds this client doesn't model, via the same
   * {@link applyRule} stash the edit path uses — except:
   *
   * - the name, suffixed so the copy doesn't trip the server's name-uniqueness check;
   * - the collections, deliberately left empty: a collection can only be governed by one
   *   rule, so the source's collections would be rejected on save. `existing` stays null,
   *   so submitting creates a new rule (and `loadCollections(null)` preselects nothing).
   *
   * If the source can't be fetched (deleted from another tab, revoked access), toast and
   * fall back to a blank create form rather than abandoning the page.
   */
  private async applyDuplicateSource(sourceId: AccessRuleId): Promise<void> {
    try {
      const source = await this.pamApi.getAccessRule(this.organizationId, sourceId);
      this.applyRule(source);
      this.formGroup.controls.name.setValue(
        this.i18nService.t("pamAccessRuleDuplicateName", source.name),
      );
    } catch (e) {
      const message = isAccessRuleNotFound(e)
        ? this.i18nService.t("pamAccessRuleNotFound")
        : (accessRuleErrorMessage(e) ?? this.i18nService.t("pamAccessRuleNotFound"));
      this.toastService.showToast({ variant: "error", message });
    }
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
      // The collection-conflict rejection gets friendlier copy than the server's line
      // ("One or more collections are already governed by…"), which UAT found hard to parse.
      this.saveError.set(
        isAccessRuleCollectionConflict(e)
          ? this.i18nService.t("pamAccessRuleCollectionConflict")
          : (accessRuleErrorMessage(e) ?? this.i18nService.t("pamAccessRuleSaveErrorBody")),
      );
    }
  };

  /**
   * Confirm before unsaved edits are thrown away. Called both by Cancel and by the route's
   * CanDeactivate guard, which covers the breadcrumb and browser back/forward. A pristine form
   * has nothing to lose, so it skips the dialog rather than asking about an empty page.
   */
  async confirmDiscard(): Promise<boolean> {
    if (this.leaving() || !this.formGroup.dirty) {
      return true;
    }

    // Creating: the design names the thing being abandoned, the rule itself. Editing: the rule
    // already exists and only the edits are lost, so the repo's shared wording is the true one.
    return this.editing
      ? await this.dialogService.openSimpleDialog({
          title: { key: "discardEditsTitle" },
          content: { key: "discardEditsConfirmation" },
          acceptButtonText: { key: "discardEdits" },
          cancelButtonText: { key: "keepEditing" },
          type: "warning",
        })
      : await this.dialogService.openSimpleDialog({
          title: { key: "pamAccessRuleDiscardTitle" },
          content: { key: "pamAccessRuleDiscardContent" },
          acceptButtonText: { key: "pamAccessRuleDiscardConfirm" },
          cancelButtonText: { key: "cancel" },
          type: "warning",
        });
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
      const message = accessRuleErrorMessage(e) ?? this.i18nService.t("unexpectedError");
      this.toastService.showToast({ variant: "error", message });
    }
  };

  /** Return to the access-rules list (the parent of both the `new` and `:id` routes). */
  private async navigateToList(): Promise<boolean> {
    this.leaving.set(true);
    try {
      return await this.router.navigate([".."], { relativeTo: this.route });
    } finally {
      this.leaving.set(false);
    }
  }
}

export const accessRuleEditDiscardGuard: CanDeactivateFn<AccessRuleEditComponent> = (component) =>
  component.confirmDiscard();
