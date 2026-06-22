import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { filter, lastValueFrom, map, switchMap, take } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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
  DialogRef,
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
import {
  AccessRuleResponse,
  AccessRuleStatusFilter,
  accessRuleMatchesFilter,
} from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import {
  AccessRuleDialogData,
  AccessRuleDialogComponent,
  AccessRuleDialogResult,
} from "./access-rule-dialog.component";
import { AccessRuleRow, AccessRulesService } from "./access-rules.service";

type RuleTemplate = {
  key: string;
  icon: string;
  titleKey: string;
  descriptionKey: string;
  tags: Array<{ icon: string; labelKey: string }>;
  prefill: {
    nameKey: string;
    defaultLeaseDurationSeconds: number;
    humanApprovalEnabled: boolean;
    ipAllowlistEnabled: boolean;
  };
};

const RULE_TEMPLATES: RuleTemplate[] = [
  {
    key: "time-limited",
    icon: "bwi-clock",
    titleKey: "pamTemplateTimeLimitedTitle",
    descriptionKey: "pamTemplateTimeLimitedDescription",
    tags: [{ icon: "bwi-file-text", labelKey: "pamTemplateTagNoConditions" }],
    prefill: {
      nameKey: "pamTemplateTimeLimitedName",
      defaultLeaseDurationSeconds: 4 * 60 * 60,
      humanApprovalEnabled: false,
      ipAllowlistEnabled: false,
    },
  },
  {
    key: "approval-required",
    icon: "bwi-users",
    titleKey: "pamTemplateApprovalRequiredTitle",
    descriptionKey: "pamTemplateApprovalRequiredDescription",
    tags: [{ icon: "bwi-users", labelKey: "pamTemplateTagHumanApproval" }],
    prefill: {
      nameKey: "pamTemplateApprovalRequiredName",
      defaultLeaseDurationSeconds: 60 * 60,
      humanApprovalEnabled: true,
      ipAllowlistEnabled: false,
    },
  },
  {
    key: "ip-restricted",
    icon: "bwi-globe",
    titleKey: "pamTemplateIpRestrictedTitle",
    descriptionKey: "pamTemplateIpRestrictedDescription",
    tags: [{ icon: "bwi-globe", labelKey: "pamTemplateTagIpAllowlist" }],
    prefill: {
      nameKey: "pamTemplateIpRestrictedName",
      defaultLeaseDurationSeconds: 60 * 60,
      humanApprovalEnabled: false,
      ipAllowlistEnabled: true,
    },
  },
];

@Component({
  templateUrl: "./access-rules.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AccessRulesService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
    initialValue: [] as AccessRuleResponse[],
  });
  private readonly collectionNameById = toSignal(this.accessRules.collectionNameById$, {
    initialValue: new Map<string, string>(),
  });
  private readonly rows = toSignal(this.accessRules.rows$, {
    initialValue: [] as AccessRuleRow[],
  });

  protected readonly ruleTemplates = RULE_TEMPLATES;

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

  /**
   * The rule named by the `accessRuleId` query param — the single source of truth for
   * which rule's dialog is open. Opening a rule writes it (so the URL is shareable and
   * navigable); closing clears it. {@link activeDialog} tracks the dialog actually on
   * screen so the two can be reconciled when the URL changes (e.g. browser back).
   */
  private readonly accessRuleId$ = this.route.queryParams.pipe(
    map((p) => (p.accessRuleId as string | undefined) ?? null),
  );
  private readonly deepLinkRuleId = toSignal(this.accessRuleId$, {
    initialValue: null as string | null,
  });
  private readonly activeDialog = signal<{
    ruleId: string;
    ref: DialogRef<AccessRuleDialogResult>;
  } | null>(null);

  constructor() {
    // Reload whenever the active organization changes.
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
        accessRuleMatchesFilter(row.rule, row.collectionNames, { text, status, collectionId });
    });

    // Keep the open dialog in step with the `accessRuleId` query param. Wait for the
    // first load so the rule list is available, then react to the param: opening a
    // rule, or closing the dialog when the param is removed (e.g. browser back).
    // Driven off the router's queryParams (not a signal) so dialog open/close runs
    // outside change detection.
    this.accessRules.loading$
      .pipe(
        filter((loading) => !loading),
        take(1),
        switchMap(() => this.accessRuleId$),
        takeUntilDestroyed(),
      )
      .subscribe((ruleId) => this.reconcileDialog(ruleId));
  }

  protected readonly openCreate = (): Promise<void> => this.openDialog({});

  protected openFromTemplate(tmpl: RuleTemplate): void {
    void this.openDialog({
      template: {
        name: this.i18nService.t(tmpl.prefill.nameKey),
        defaultLeaseDurationSeconds: tmpl.prefill.defaultLeaseDurationSeconds,
        humanApprovalEnabled: tmpl.prefill.humanApprovalEnabled,
        ipAllowlistEnabled: tmpl.prefill.ipAllowlistEnabled,
      },
    });
  }

  /**
   * Open a rule by routing to it: the `accessRuleId` query param is the source of
   * truth, so the URL becomes shareable and the dialog opens via {@link reconcileDialog}.
   * Pushing a history entry lets browser-back close the dialog.
   */
  protected readonly openEdit = (rule: AccessRuleResponse): Promise<boolean> =>
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { accessRuleId: rule.id },
      queryParamsHandling: "merge",
    });

  protected readonly toggleEnabled = async (rule: AccessRuleResponse): Promise<void> => {
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

  protected readonly remove = async (rule: AccessRuleResponse): Promise<void> => {
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

  private selectedRules(): AccessRuleResponse[] {
    const ids = this.selectedIds();
    return this.processedRows()
      .filter((r) => ids.has(r.id))
      .map((r) => r.rule);
  }

  private showError(e: unknown): void {
    const message =
      e instanceof ErrorResponse
        ? (e.message ?? this.i18nService.t("unexpectedError"))
        : this.i18nService.t("unexpectedError");
    this.toastService.showToast({ variant: "error", message });
  }

  /**
   * Bring the dialog into agreement with the `accessRuleId` query param: open the
   * named rule, or close the current dialog when the param is removed (browser back).
   * A no-op when the param already matches what's on screen.
   */
  private reconcileDialog(ruleId: string | null): void {
    const active = this.activeDialog();
    if (ruleId === (active?.ruleId ?? null)) {
      return;
    }
    if (active != null) {
      // The URL moved off the open rule — close it. Detach first so the close
      // handler in openRule sees the dialog as already gone and skips clearing.
      this.activeDialog.set(null);
      void active.ref.close();
      return;
    }
    if (ruleId != null) {
      void this.openRule(ruleId);
    }
  }

  /**
   * Show the edit dialog for the routed rule. A stale id (deleted rule, or one the
   * user can't see) self-heals: clear the param and toast. When the dialog closes by
   * its own UI the param still points here, so we clear it to keep the URL in step.
   */
  private async openRule(ruleId: string): Promise<void> {
    const rule = this.accessRules.getRule(ruleId);
    if (rule == null) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamAccessRuleNotFound"),
      });
      await this.clearRuleParam();
      return;
    }

    const ref = AccessRuleDialogComponent.open(this.dialogService, {
      data: { organizationId: this.organizationId(), existing: rule },
    });
    this.activeDialog.set({ ruleId, ref });
    const result = await lastValueFrom(ref.closed);
    this.activeDialog.set(null);

    // If the URL still names this rule, it was closed via the dialog UI (not a
    // back-navigation that already cleared it), so bring the URL back in line. Left
    // un-awaited: the reconcile subscription owns URL→dialog state and the reload
    // below is independent, so there's no reason to serialize them.
    if (this.deepLinkRuleId() === ruleId) {
      void this.clearRuleParam();
    }
    if (result === "saved") {
      await this.accessRules.load(this.organizationId());
    }
  }

  /** Drop the `accessRuleId` param without adding a history entry. */
  private clearRuleParam(): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { accessRuleId: null },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }

  private async openDialog(data: Omit<AccessRuleDialogData, "organizationId">): Promise<void> {
    const ref = AccessRuleDialogComponent.open(this.dialogService, {
      data: { organizationId: this.organizationId(), ...data },
    });
    if ((await lastValueFrom(ref.closed)) === "saved") {
      await this.accessRules.load(this.organizationId());
    }
  }
}
