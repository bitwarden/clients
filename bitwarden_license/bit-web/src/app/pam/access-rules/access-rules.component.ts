import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { map } from "rxjs";

import {
  AccessRuleView,
  AccessRuleStatusFilter,
  accessRuleErrorMessage,
  accessRuleMatchesFilter,
} from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
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
  TableDataSource,
  TableModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import {
  AccessRuleTemplateKey,
  AccessRulesEmptyStateComponent,
} from "./access-rules-empty-state.component";
import { AccessRuleRow, AccessRulesService } from "./access-rules.service";

@Component({
  templateUrl: "./access-rules.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AccessRulesService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AccessRulesEmptyStateComponent,
    AsyncActionsModule,
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
    I18nPipe,
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
  protected readonly rules = toSignal(this.accessRules.rules$, {
    initialValue: [] as AccessRuleView[],
  });
  private readonly collectionNameById = toSignal(this.accessRules.collectionNameById$, {
    initialValue: new Map<string, string>(),
  });
  private readonly rows = toSignal(this.accessRules.rows$, {
    initialValue: [] as AccessRuleRow[],
  });

  protected readonly dataSource = new TableDataSource<AccessRuleRow>();
  /**
   * The filtered + sorted rows straight from the data source — the basis for both the
   * rendered table body and select-all (which spans the whole filtered set). `connect()`
   * is idempotent, so sharing it with `bit-table` (which connects too) is safe.
   */
  protected readonly processedRows = toSignal(this.dataSource.connect(), {
    initialValue: [] as AccessRuleRow[],
  });

  // --- Toolbar filters ---
  protected readonly searchControl = new FormControl("", { nonNullable: true });
  protected readonly statusControl = new FormControl<AccessRuleStatusFilter | null>(null);
  protected readonly collectionControl = new FormControl<string | null>(null);

  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: "" });
  private readonly statusValue = toSignal(this.statusControl.valueChanges, { initialValue: null });
  private readonly collectionValue = toSignal(this.collectionControl.valueChanges, {
    initialValue: null,
  });

  protected readonly statusOptions: ChipFilterOption<AccessRuleStatusFilter>[] = [
    {
      label: this.i18nService.t("pamAccessRuleEnabled"),
      value: "enabled",
      icon: "bwi-check-circle",
    },
    { label: this.i18nService.t("disabled"), value: "disabled", icon: "bwi-circle" },
  ];

  protected readonly collectionOptions = computed<ChipFilterOption<string>[]>(() =>
    [...this.collectionNameById().entries()]
      .map(([id, name]) => ({ label: name, value: id, icon: "bwi-collection-shared" as const }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  // --- Selection ---
  private readonly selectedIds = signal<Set<string>>(new Set());
  protected readonly selectedCount = computed(() => this.selectedIds().size);
  protected readonly allSelected = computed(() => {
    const rows = this.processedRows();
    const selected = this.selectedIds();
    return rows.length > 0 && rows.every((r) => selected.has(r.id));
  });
  protected readonly someSelected = computed(() => this.selectedCount() > 0 && !this.allSelected());

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

    // Mirror the projected rows into the table data source.
    effect(() => {
      this.dataSource.data = this.rows();
    });

    // Recompute the combined filter whenever any toolbar control changes.
    effect(() => {
      const text = this.searchText().trim().toLowerCase();
      const status = this.statusValue();
      const collectionId = this.collectionValue();
      this.dataSource.filter = (row) =>
        accessRuleMatchesFilter(
          {
            name: row.rule.name,
            enabled: row.rule.enabled,
            collections: row.rule.collections.map(uuidAsString),
          },
          row.collectionNames,
          { text, status, collectionId },
        );
    });
  }

  /** Navigate to the create page. */
  protected readonly openCreate = (): Promise<boolean> =>
    this.router.navigate(["new"], { relativeTo: this.route });

  /** Navigate to the create page, seeding it from a starter template. */
  protected readonly openFromTemplate = (key: AccessRuleTemplateKey): Promise<boolean> =>
    this.router.navigate(["new"], { relativeTo: this.route, queryParams: { template: key } });

  /** Navigate to the edit page for a rule (a shareable, deep-linkable URL). */
  protected readonly openEdit = (rule: AccessRuleView): Promise<boolean> =>
    this.router.navigate([rule.id], { relativeTo: this.route });

  protected readonly toggleEnabled = async (rule: AccessRuleView): Promise<void> => {
    const nextEnabled = !rule.enabled;
    try {
      await this.accessRules.setEnabled(rule, nextEnabled);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(
          nextEnabled ? "pamAccessRuleEnableSuccess" : "pamAccessRuleDisableSuccess",
        ),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  protected readonly remove = async (rule: AccessRuleView): Promise<void> => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamAccessRuleDeleteConfirmTitle" },
      content: {
        key: "pamAccessRuleDeleteConfirmContent",
        placeholders: [rule.name],
      },
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.accessRules.delete(rule);
    } catch (e) {
      this.showError(e);
    }
  };

  // --- Selection ---

  protected isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  protected toggleRow(id: string): void {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  protected toggleAll(): void {
    if (this.allSelected()) {
      this.selectedIds.set(new Set());
      return;
    }
    this.selectedIds.set(new Set(this.processedRows().map((r) => r.id)));
  }

  protected readonly clearSelection = (): void => {
    this.selectedIds.set(new Set());
  };

  // --- Bulk actions ---

  protected readonly bulkEnable = (): void => {
    void this.bulkSetEnabled(true);
  };
  protected readonly bulkDisable = (): void => {
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

  // --- Helpers ---

  private selectedRules(): AccessRuleView[] {
    const ids = this.selectedIds();
    return this.processedRows()
      .filter((r) => ids.has(r.id))
      .map((r) => r.rule);
  }

  private showError(e: unknown): void {
    const message = accessRuleErrorMessage(e) ?? this.i18nService.t("unexpectedError");
    this.toastService.showToast({ variant: "error", message });
  }
}
