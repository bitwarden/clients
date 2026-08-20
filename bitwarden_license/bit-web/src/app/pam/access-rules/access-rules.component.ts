import { SelectionModel } from "@angular/cdk/collections";
import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, inject } from "@angular/core";
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
  ChipFilterComponent,
  ChipFilterOption,
  DialogService,
  IconButtonModule,
  IconModule,
  LinkModule,
  MenuModule,
  SearchModule,
  SortFn,
  TableDataSource,
  TableModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import {
  AccessRuleId,
  AccessRuleView,
  AccessRuleStatusFilter,
  accessRuleDeleteConfirmOptions,
  accessRuleErrorMessageKey,
  accessRuleMatchesFilter,
  resolveCollectionNames,
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
    ChipFilterComponent,
    HeaderModule,
    IconButtonModule,
    IconModule,
    LinkModule,
    MenuModule,
    SearchModule,
    TableModule,
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
   * The filtered and sorted rows, which select-all spans. Sharing `connect()` with `bit-table` is
   * safe, since it is idempotent.
   */
  protected readonly processedRows = toSignal(this.dataSource.connect(), {
    initialValue: [] as AccessRuleView[],
  });

  // --- Toolbar filters ---
  protected readonly filterForm = new FormGroup({
    search: new FormControl("", { nonNullable: true }),
    status: new FormControl<AccessRuleStatusFilter | null>(null),
    collection: new FormControl<string | null>(null),
  });

  private readonly filterInputs = toSignal(
    this.filterForm.valueChanges.pipe(
      startWith(null),
      map(() => this.filterForm.getRawValue()),
    ),
    { requireSync: true },
  );

  protected readonly statusOptions: ChipFilterOption<AccessRuleStatusFilter>[] = [
    {
      label: this.i18nService.t("pamAccessRuleActive"),
      value: "enabled",
      icon: "bwi-check-circle",
    },
    {
      label: this.i18nService.t("pamAccessRuleInactive"),
      value: "disabled",
      icon: "bwi-subtract-circle",
    },
  ];

  protected readonly collectionOptions = computed<ChipFilterOption<string>[]>(() =>
    this.collections()
      .map((c) => ({ label: c.name, value: c.id, icon: "bwi-collection-shared" as const }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

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
    // Also reloads on return from the create or edit page, since the component remounts.
    effect(() => {
      void this.accessRules.load(this.organizationId());
    });

    effect(() => {
      this.dataSource.data = this.rules();
    });

    effect(() => {
      const { search, status, collection } = this.filterInputs();
      const text = search.trim().toLowerCase();
      this.dataSource.filter = (rule) => {
        const collectionIds = rule.collections.map(uuidAsString);
        return accessRuleMatchesFilter(
          { name: rule.name, enabled: rule.enabled, collections: collectionIds },
          resolveCollectionNames(collectionIds, this.collections()),
          { text, status, collectionId: collection },
        );
      };
    });
  }

  /** Ascending puts disabled rules first. */
  protected readonly sortByStatus: SortFn = (a: AccessRuleView, b: AccessRuleView) =>
    Number(a.enabled) - Number(b.enabled);

  protected readonly sortByRevisionDate: SortFn = (a: AccessRuleView, b: AccessRuleView) =>
    revisionDateMs(a) - revisionDateMs(b);

  protected readonly openCreate = (): Promise<boolean> =>
    this.router.navigate(["new"], { relativeTo: this.route });

  protected readonly openFromTemplate = (key: AccessRuleTemplateKey): Promise<boolean> =>
    this.router.navigate(["new"], { relativeTo: this.route, queryParams: { template: key } });

  protected readonly openEdit = (rule: AccessRuleView): Promise<boolean> =>
    this.router.navigate([rule.id], { relativeTo: this.route });

  /**
   * Navigate to the create page seeded from an existing rule. The create page copies
   * everything but the collections (a collection can only carry one rule) and suffixes
   * the name; nothing is persisted until the user saves.
   */
  protected readonly duplicate = (rule: AccessRuleView): Promise<boolean> =>
    this.router.navigate(["new"], {
      relativeTo: this.route,
      queryParams: { duplicateFrom: rule.id },
    });

  protected readonly toggleEnabled = async (rule: AccessRuleView): Promise<void> => {
    const nextEnabled = !rule.enabled;
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
    } catch (e) {
      this.showError(e);
    }
  };

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
    try {
      const changed = await this.accessRules.setManyEnabled(this.selectedRules(), enabled);
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
      type: "warning",
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
