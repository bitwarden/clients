import { SelectionModel } from "@angular/cdk/collections";
import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { map, startWith } from "rxjs";

import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  BadgeModule,
  BulkActionComponent,
  BulkActionsBarComponent,
  ButtonModule,
  CheckboxModule,
  DialogService,
  FilterMenuComponent,
  FilterOptionComponent,
  IconButtonModule,
  IconModule,
  LinkModule,
  MenuModule,
  SearchModule,
  SortFn,
  TableDataSource,
  TableModule,
  ToastService,
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import {
  AccessRuleId,
  AccessRuleView,
  AccessRuleStatusFilter,
  accessRuleDeactivateConfirmOptions,
  accessRuleDeleteConfirmOptions,
  accessRuleErrorMessageKey,
  accessRuleMatchesFilter,
  classifyAccessRuleError,
  copyRuleName,
  resolveCollectionNames,
  rulesChangingEnabled,
} from "..";
import { DurationLongPipe } from "../date/duration-long.pipe";
import { RelativeTimePipe } from "../date/relative-time.pipe";
import { AccessRulesService } from "../services/access-rules.service";

import { AccessRuleCollectionBadgesComponent } from "./access-rule-collection-badges.component";
import { ACCESS_RULE_TEMPLATES, AccessRuleTemplateKey } from "./access-rule-templates";
import { AccessRulesEmptyStateComponent } from "./access-rules-empty-state/access-rules-empty-state.component";
import { ApprovalMethodPipe } from "./approval-method.pipe";

@Component({
  templateUrl: "./access-rules.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AccessRulesService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AccessRuleCollectionBadgesComponent,
    AccessRulesEmptyStateComponent,
    BadgeModule,
    BulkActionComponent,
    BulkActionsBarComponent,
    ButtonModule,
    CheckboxModule,
    FilterMenuComponent,
    FilterOptionComponent,
    HeaderModule,
    IconButtonModule,
    IconModule,
    LinkModule,
    MenuModule,
    SearchModule,
    TableModule,
    TooltipDirective,
    TypographyModule,
    I18nPipe,
    RelativeTimePipe,
    DurationLongPipe,
    ApprovalMethodPipe,
  ],
})
export class AccessRulesComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly accessRules = inject(AccessRulesService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected readonly loading = toSignal(this.accessRules.loading$, { initialValue: true });
  protected readonly collections = toSignal(this.accessRules.collections$, {
    initialValue: [] as CollectionAdminView[],
  });
  protected readonly rules = toSignal(this.accessRules.rules$, {
    initialValue: [] as AccessRuleView[],
  });

  /** Starter templates offered by the header's create menu, next to the blank "Custom" option. */
  protected readonly templates = ACCESS_RULE_TEMPLATES;

  protected readonly dataSource = new TableDataSource<AccessRuleView>();
  /**
   * The filtered + sorted rules straight from the data source — the basis for both the
   * rendered table body and select-all (which spans the whole filtered set). `connect()`
   * is idempotent, so sharing it with `bit-table` (which connects too) is safe.
   */
  protected readonly processedRows = toSignal(this.dataSource.connect(), {
    initialValue: [] as AccessRuleView[],
  });

  // --- Toolbar filters ---
  // Only `search` is a reactive-form control: `bit-filter-menu` isn't a
  // `ControlValueAccessor`, so the status/collection chips below own their own
  // selection and are read directly off their view-child refs in `filterInputs`.
  protected readonly filterForm = new FormGroup({
    search: new FormControl("", { nonNullable: true }),
  });

  private readonly searchTerm = toSignal(
    this.filterForm.controls.search.valueChanges.pipe(startWith("")),
    { requireSync: true },
  );

  private readonly statusFilter = viewChild<FilterMenuComponent>("statusFilter");
  private readonly collectionFilter = viewChild<FilterMenuComponent>("collectionFilter");

  private readonly filterInputs = computed(() => {
    const status = this.statusFilter()?.value() as AccessRuleStatusFilter | undefined;
    const collections = this.collectionFilter()?.value();
    return {
      text: this.searchTerm().trim().toLowerCase(),
      status: status ?? null,
      collectionIds: Array.isArray(collections) ? (collections as string[]) : [],
    };
  });

  protected readonly statusOptions: { label: string; value: AccessRuleStatusFilter }[] = [
    { label: this.i18nService.t("pamAccessRuleActive"), value: "enabled" },
    { label: this.i18nService.t("pamAccessRuleInactive"), value: "disabled" },
  ];

  protected readonly collectionOptions = computed<{ label: string; value: string }[]>(() =>
    this.collections()
      .map((c) => ({ label: c.name, value: c.id }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  // --- Selection ---
  protected readonly selection = new SelectionModel<AccessRuleId>(true, []);

  protected selectedCount(): number {
    return this.selection.selected.length;
  }

  protected allSelected(): boolean {
    const rows = this.processedRows();
    return rows.length > 0 && rows.every((r) => this.selection.isSelected(r.id));
  }

  protected someSelected(): boolean {
    return this.selection.hasValue() && !this.allSelected();
  }

  private readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as OrganizationId)),
    { requireSync: true },
  );

  constructor() {
    // Reload whenever the active organization changes. This also refreshes the list
    // when returning from the create/edit page, since the component remounts.
    effect(() => {
      void this.accessRules.load(this.organizationId());
    });

    // Mirror the loaded rules into the table data source.
    effect(() => {
      this.dataSource.data = this.rules();
    });

    // Recompute the combined filter whenever any toolbar control changes.
    effect(() => {
      const { text, status, collectionIds } = this.filterInputs();
      this.dataSource.filter = (rule) => {
        const ruleCollectionIds = rule.collections.map(uuidAsString);
        return accessRuleMatchesFilter(
          { name: rule.name, enabled: rule.enabled, collections: ruleCollectionIds },
          resolveCollectionNames(ruleCollectionIds, this.collections()),
          { text, status, collectionIds },
        );
      };
    });
  }

  /** Column sort for "status": disabled rules before enabled ones (ascending). */
  protected readonly sortByStatus: SortFn = (a: AccessRuleView, b: AccessRuleView) =>
    Number(a.enabled) - Number(b.enabled);

  /** Column sort for "last modified": chronological by revision date (ascending). */
  protected readonly sortByRevisionDate: SortFn = (a: AccessRuleView, b: AccessRuleView) =>
    revisionDateMs(a) - revisionDateMs(b);

  /** Navigate to the create page. */
  protected readonly openCreate = (): Promise<boolean> =>
    this.router.navigate(["new"], { relativeTo: this.route });

  /** Navigate to the create page, seeding it from a starter template. */
  protected readonly openFromTemplate = (key: AccessRuleTemplateKey): Promise<boolean> =>
    this.router.navigate(["new"], { relativeTo: this.route, queryParams: { template: key } });

  /** Navigate to the edit page for a rule (a shareable, deep-linkable URL). */
  protected readonly openEdit = (rule: AccessRuleView): Promise<boolean> =>
    this.router.navigate([rule.id], { relativeTo: this.route });

  /**
   * Copy a rule and open the copy for editing.
   *
   * The copy is created straight away, without a confirmation step: it carries no collections
   * (a collection can only be governed by one rule), so until the admin assigns some there is
   * nothing for it to govern and nothing to undo. That is also why the edit page is where the
   * admin lands — the copy is unfinished, and its required collections are the thing to finish.
   * Backing out of that page leaves the copy in the table rather than discarding it.
   */
  protected readonly makeCopy = async (rule: AccessRuleView): Promise<void> => {
    let created: AccessRuleView;
    try {
      created = await this.createCopy(rule);
    } catch (e) {
      this.showError(e);
      return;
    }

    // Announced only once the copy is definitely persisted, and outside the try: a failed
    // navigation must not follow a success toast with an error one about a rule that exists.
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("pamAccessRuleCopyCreated"),
    });
    // `renaming` tells the edit page to put the cursor in the name field with the suffixed
    // name selected, so the admin can type over it.
    await this.router.navigate([created.id], {
      relativeTo: this.route,
      queryParams: { renaming: true },
    });
  };

  /**
   * Create the copy, retrying once against a refreshed list if the name turned out to be taken.
   *
   * {@link copyRuleName} picks a free name from the rules this page loaded, which another admin
   * (or another tab) can have moved on from since. Without the refresh that rejection is a dead
   * end: the admin is on the table with no field to correct, and clicking again recomputes the
   * same name from the same stale list and fails identically.
   */
  private async createCopy(rule: AccessRuleView): Promise<AccessRuleView> {
    try {
      return await this.accessRules.copy(rule, this.copyNameFor(rule));
    } catch (e) {
      const outcome = classifyAccessRuleError(e);
      if (outcome.kind !== "mapped" || outcome.messageKey !== "pamAccessRuleErrorNameTaken") {
        throw e;
      }
      await this.accessRules.load(this.organizationId());
      return await this.accessRules.copy(rule, this.copyNameFor(rule));
    }
  }

  private copyNameFor(rule: AccessRuleView): string {
    return copyRuleName(
      rule.name,
      this.rules().map((r) => r.name),
      (key, name, count) => this.i18nService.t(key, name, count),
    );
  }

  protected readonly toggleEnabled = async (rule: AccessRuleView): Promise<void> => {
    const nextEnabled = !rule.enabled;
    // Deactivating is the direction that changes who can get in, so it asks first. Activating
    // stays one click: it only ever adds gating back.
    if (!nextEnabled) {
      const confirmed = await this.dialogService.openSimpleDialog(
        accessRuleDeactivateConfirmOptions(),
      );
      if (!confirmed) {
        return;
      }
    }
    try {
      await this.accessRules.setEnabled(rule, nextEnabled);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(
          nextEnabled ? "pamAccessRuleActivateSuccess" : "pamAccessRuleDeactivateSuccess",
        ),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  protected readonly remove = async (rule: AccessRuleView): Promise<void> => {
    const confirmed = await this.dialogService.openSimpleDialog(
      accessRuleDeleteConfirmOptions(rule.name),
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.accessRules.delete(rule);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamAccessRuleDeleted"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  // --- Selection ---

  protected toggleAll(): void {
    if (this.allSelected()) {
      this.selection.clear();
      return;
    }
    this.selection.select(...this.processedRows().map((r) => r.id));
  }

  protected readonly clearSelection = (): void => {
    this.selection.clear();
  };

  // --- Bulk actions ---

  protected readonly bulkActivate = (): void => {
    void this.bulkSetEnabled(true);
  };
  protected readonly bulkDeactivate = (): void => {
    void this.bulkSetEnabled(false);
  };
  protected readonly bulkDelete = (): void => {
    void this.bulkRemove();
  };

  private async bulkSetEnabled(enabled: boolean): Promise<void> {
    const selected = this.selectedRules();
    // Same speedbump as the row menu, over only the rules that will actually move — confirming
    // the raw selection would overstate it. Nothing to move means no question at all: fall
    // through to the existing no-op rather than asking about zero rules.
    const deactivating = enabled ? [] : rulesChangingEnabled(selected, false);
    if (deactivating.length > 0) {
      const confirmed = await this.dialogService.openSimpleDialog(
        accessRuleDeactivateConfirmOptions(deactivating.length),
      );
      if (!confirmed) {
        return;
      }
    }
    try {
      const changed = await this.accessRules.setManyEnabled(selected, enabled);
      this.clearSelection();
      if (changed > 0) {
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessRulesUpdated"),
        });
      }
    } catch (e) {
      this.showError(e);
    }
  }

  private async bulkRemove(): Promise<void> {
    const targets = this.selectedRules();
    if (targets.length === 0) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamAccessRuleBulkDeleteConfirmTitle" },
      content: {
        key: "pamAccessRuleBulkDeleteConfirmContent",
        placeholders: [targets.length.toString()],
      },
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.accessRules.deleteMany(targets);
      this.clearSelection();
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamAccessRulesDeleted"),
      });
    } catch (e) {
      this.showError(e);
    }
  }

  // --- Helpers ---

  private selectedRules(): AccessRuleView[] {
    return this.processedRows().filter((r) => this.selection.isSelected(r.id));
  }

  /**
   * Toast a rejected mutation. Routed through the classifier so the SDK's own message — the
   * server's serialized response, filesystem paths and all — never reaches the toast.
   */
  private showError(e: unknown): void {
    this.toastService.showToast({
      variant: "error",
      message: this.i18nService.t(accessRuleErrorMessageKey(e)),
    });
  }
}

/** A rule's revision date as epoch milliseconds for sorting; 0 when the date is invalid. */
function revisionDateMs(rule: AccessRuleView): number {
  const ms = Date.parse(rule.revisionDate);
  return Number.isNaN(ms) ? 0 : ms;
}
