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
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  BadgeModule,
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  BulkActionComponent,
  BulkActionsBarComponent,
  ButtonModule,
  CheckboxModule,
  DialogService,
  FILTER_CONTROL,
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
  defineTable,
  ToastService,
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import {
  AccessRuleFilter,
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
  selectedFilterStrings,
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
    BitCellComponent,
    BitCellDefDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
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
  private readonly configService = inject(ConfigService);

  // remove when VFO1 flag is removed
  protected readonly vfo1Enabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  protected readonly loading = toSignal(this.accessRules.loading$, { initialValue: true });
  protected readonly collections = toSignal(this.accessRules.collections$, {
    initialValue: [] as CollectionAdminView[],
  });
  protected readonly rules = toSignal(this.accessRules.rules$, {
    initialValue: [] as AccessRuleView[],
  });

  protected readonly templates = ACCESS_RULE_TEMPLATES;

  protected readonly dataSource = new TableDataSource<AccessRuleView>();
  /**
   * The filtered and sorted rows, which select-all spans. Sharing `connect()` with `bit-table` is
   * safe, since it is idempotent.
   */
  protected readonly processedRows = toSignal(this.dataSource.connect(), {
    initialValue: [] as AccessRuleView[],
  });

  protected readonly table = defineTable<AccessRuleView, "select" | "actions">(this.rules);

  // Only `search` is a form control, since `bit-filter-menu` isn't a `ControlValueAccessor`. The v2
  // table adopts the same `bit-search`, so `rowMatchesFilter` must not apply `searchTerm` again.
  protected readonly filterForm = new FormGroup({
    search: new FormControl("", { nonNullable: true }),
  });

  private readonly searchTerm = toSignal(
    this.filterForm.controls.search.valueChanges.pipe(startWith("")),
    { requireSync: true },
  );

  private readonly statusFilter = viewChild("statusFilter", { read: FILTER_CONTROL });
  private readonly collectionFilter = viewChild("collectionFilter", { read: FILTER_CONTROL });

  private readonly filterInputs = computed(() =>
    toAccessRuleFilter({
      search: this.searchTerm(),
      status: this.statusFilter()?.value(),
      collection: this.collectionFilter()?.value(),
    }),
  );

  protected readonly ruleFilter = computed(() => {
    const filter = this.filterInputs();
    return (rule: AccessRuleView): boolean => this.matchesFilter(rule, filter);
  });

  /**
   * The v2 table's row test. Chip and search values arrive keyed, which the table needs to count
   * each chip's options.
   */
  protected readonly rowMatchesFilter = (
    rule: AccessRuleView,
    values: AccessRuleFilterValues,
  ): boolean => this.matchesFilter(rule, toAccessRuleFilter(values));

  private matchesFilter(rule: AccessRuleView, filter: AccessRuleFilter): boolean {
    const ruleCollectionIds = rule.collections.map(uuidAsString);
    return accessRuleMatchesFilter(
      { name: rule.name, enabled: rule.enabled, collections: ruleCollectionIds },
      resolveCollectionNames(ruleCollectionIds, this.collections()),
      filter,
    );
  }

  private readonly selectableRows = computed(() =>
    this.vfo1Enabled() ? this.rules().filter(this.ruleFilter()) : this.processedRows(),
  );

  protected readonly statusOptions: { label: string; value: AccessRuleStatusFilter }[] = [
    { label: this.i18nService.t("pamAccessRuleActive"), value: "enabled" },
    { label: this.i18nService.t("pamAccessRuleInactive"), value: "disabled" },
  ];

  protected readonly collectionOptions = computed<{ label: string; value: string }[]>(() =>
    this.collections()
      .map((c) => ({ label: c.name, value: c.id }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  protected readonly selection = new SelectionModel<AccessRuleId>(true, []);

  protected selectedCount(): number {
    return this.selection.selected.length;
  }

  protected allSelected(): boolean {
    const rows = this.selectableRows();
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
      this.dataSource.filter = this.ruleFilter();
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
   * Created without confirmation, since the copy carries no collections and governs nothing yet.
   * Backing out of the edit page leaves it in the table.
   */
  protected readonly makeCopy = async (rule: AccessRuleView): Promise<void> => {
    let created: AccessRuleView;
    try {
      created = await this.createCopy(rule);
    } catch (e) {
      this.showError(e);
      return;
    }

    // Outside the try, so a failed navigation can't follow the success toast with an error.
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("pamAccessRuleCopyCreated"),
    });
    // `renaming` opens the edit page with the suffixed name selected, ready to type over.
    await this.router.navigate([created.id], {
      relativeTo: this.route,
      queryParams: { renaming: true },
    });
  };

  /**
   * Retries once against a refreshed list if the name is taken, since {@link copyRuleName} picks a
   * free name from the rules this page loaded.
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
    // Only deactivating asks first, since it changes who can get in; activating only adds gating.
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

  protected toggleAll(): void {
    if (this.allSelected()) {
      this.selection.clear();
      return;
    }
    this.selection.select(...this.selectableRows().map((r) => r.id));
  }

  protected readonly clearSelection = (): void => {
    this.selection.clear();
  };

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
    // Confirms as the row menu does, counting only the rules that will change.
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

  private selectedRules(): AccessRuleView[] {
    return this.selectableRows().filter((r) => this.selection.isSelected(r.id));
  }

  /**
   * Goes through the classifier, so the SDK's raw message (the server's serialized response) never
   * reaches the toast.
   */
  private showError(e: unknown): void {
    this.toastService.showToast({
      variant: "error",
      message: this.i18nService.t(accessRuleErrorMessageKey(e)),
    });
  }
}

/** Untyped per key, since both hosts hand over whatever each chip reports. */
type AccessRuleFilterValues = {
  search?: string;
  status?: unknown;
  collection?: unknown;
};

function toAccessRuleFilter(values: AccessRuleFilterValues): AccessRuleFilter {
  return {
    text: (values.search ?? "").trim().toLowerCase(),
    status: (typeof values.status === "string"
      ? values.status
      : null) as AccessRuleStatusFilter | null,
    collectionIds: selectedFilterStrings(values.collection),
  };
}

function revisionDateMs(rule: AccessRuleView): number {
  const ms = Date.parse(rule.revisionDate);
  return Number.isNaN(ms) ? 0 : ms;
}
