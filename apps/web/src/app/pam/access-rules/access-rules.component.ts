import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  LOCALE_ID,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, lastValueFrom, map } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  BadgeModule,
  BitwardenIcon,
  BulkActionComponent,
  BulkActionsBarComponent,
  ButtonModule,
  CheckboxModule,
  ChipFilterComponent,
  ChipFilterOption,
  DialogService,
  IconButtonModule,
  LinkModule,
  MenuModule,
  SearchModule,
  TableDataSource,
  TableModule,
  ToastService,
} from "@bitwarden/components";
import {
  AccessCondition,
  AccessRuleRequest,
  AccessRuleResponse,
  PamApiService,
} from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

import { HeaderModule } from "../../layouts/header/header.module";

import { AccessRuleDialogData, AccessRuleDialogComponent } from "./access-rule-dialog.component";

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

type StatusFilter = "enabled" | "disabled";

type ConditionBadge = {
  icon: BitwardenIcon;
  label: string;
};

/**
 * A flattened, presentation-ready view of an {@link AccessRuleResponse}. The derived
 * `name`, `status`, and `revisionDate` properties are what {@link TableDataSource}'s
 * default accessor sorts on, so each sortable column maps to a property here.
 */
type AccessRuleRow = {
  id: string;
  rule: AccessRuleResponse;
  name: string;
  enabled: boolean;
  status: string;
  /** Epoch milliseconds, so the "Last modified" column sorts chronologically. */
  revisionDate: number;
  collectionNames: string[];
  conditionBadges: ConditionBadge[];
  accessWindow: string | null;
  lastModified: string;
};

@Component({
  templateUrl: "./access-rules.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    LinkModule,
    MenuModule,
    SearchModule,
    TableModule,
    I18nPipe,
  ],
})
export class AccessRulesComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly pamApi = inject(PamApiService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly accountService = inject(AccountService);
  private readonly collectionAdminService = inject(CollectionAdminService);
  private readonly locale = inject(LOCALE_ID);

  private readonly relativeTimeFormat = new Intl.RelativeTimeFormat(this.locale, {
    numeric: "always",
    style: "narrow",
  });

  protected readonly loading = signal(true);
  protected readonly rules = signal<AccessRuleResponse[]>([]);
  private readonly collectionNameById = signal<Map<string, string>>(new Map());

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
  protected readonly statusControl = new FormControl<StatusFilter | null>(null);
  protected readonly collectionControl = new FormControl<string | null>(null);

  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: "" });
  private readonly statusValue = toSignal(this.statusControl.valueChanges, { initialValue: null });
  private readonly collectionValue = toSignal(this.collectionControl.valueChanges, {
    initialValue: null,
  });

  protected readonly statusOptions: ChipFilterOption<StatusFilter>[] = [
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
    // Reload whenever the active organization changes.
    effect(() => {
      void this.reload(this.organizationId());
    });

    // Project the loaded rules (and resolved collection names) into table rows.
    effect(() => {
      this.dataSource.data = this.buildRows(this.rules(), this.collectionNameById());
    });

    // Recompute the combined filter whenever any toolbar control changes.
    effect(() => {
      const text = this.searchText().trim().toLowerCase();
      const status = this.statusValue();
      const collectionId = this.collectionValue();
      this.dataSource.filter = (row) => this.matches(row, text, status, collectionId);
    });
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

  protected readonly openEdit = (rule: AccessRuleResponse): Promise<void> =>
    this.openDialog({ existing: rule });

  protected readonly toggleEnabled = async (rule: AccessRuleResponse): Promise<void> => {
    const nextEnabled = !rule.enabled;
    try {
      const updated = await this.pamApi.updateAccessRule(
        this.organizationId(),
        rule.id,
        this.toRequest(rule, nextEnabled),
      );
      this.rules.update((list) => list.map((r) => (r.id === rule.id ? updated : r)));
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
      await this.pamApi.deleteAccessRule(this.organizationId(), rule.id);
      this.rules.update((list) => list.filter((r) => r.id !== rule.id));
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
    const targets = this.selectedRules().filter((r) => r.enabled !== enabled);
    if (targets.length === 0) {
      this.clearSelection();
      return;
    }
    try {
      const updated = await Promise.all(
        targets.map((rule) =>
          this.pamApi.updateAccessRule(
            this.organizationId(),
            rule.id,
            this.toRequest(rule, enabled),
          ),
        ),
      );
      const byId = new Map(updated.map((r) => [r.id, r]));
      this.rules.update((list) => list.map((r) => byId.get(r.id) ?? r));
      this.clearSelection();
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamAccessRulesUpdated"),
      });
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
      await Promise.all(
        targets.map((rule) => this.pamApi.deleteAccessRule(this.organizationId(), rule.id)),
      );
      const removed = new Set(targets.map((r) => r.id));
      this.rules.update((list) => list.filter((r) => !removed.has(r.id)));
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

  private matches(
    row: AccessRuleRow,
    text: string,
    status: StatusFilter | null,
    collectionId: string | null,
  ): boolean {
    if (status === "enabled" && !row.enabled) {
      return false;
    }
    if (status === "disabled" && row.enabled) {
      return false;
    }
    if (collectionId != null && !row.rule.collections.includes(collectionId)) {
      return false;
    }
    if (text.length > 0) {
      const haystack = `${row.name} ${row.collectionNames.join(" ")}`.toLowerCase();
      if (!haystack.includes(text)) {
        return false;
      }
    }
    return true;
  }

  private buildRows(rules: AccessRuleResponse[], names: Map<string, string>): AccessRuleRow[] {
    const now = Date.now();
    return rules.map((rule) => {
      const revisionDate = Date.parse(rule.revisionDate);
      return {
        id: rule.id,
        rule,
        name: rule.name,
        enabled: rule.enabled,
        status: this.i18nService.t(rule.enabled ? "pamAccessRuleEnabled" : "disabled"),
        revisionDate: Number.isNaN(revisionDate) ? 0 : revisionDate,
        collectionNames: rule.collections
          .map((id) => names.get(id) ?? id)
          .sort((a, b) => a.localeCompare(b)),
        conditionBadges: this.conditionBadges(rule.conditions),
        accessWindow: this.accessWindow(rule),
        lastModified: Number.isNaN(revisionDate) ? "" : this.relativeTime(revisionDate, now),
      };
    });
  }

  private conditionBadges(conditions: AccessCondition[]): ConditionBadge[] {
    const badges: ConditionBadge[] = [];
    const requiresApproval = conditions.some((c) => c.kind === "human_approval");
    badges.push(
      requiresApproval
        ? {
            icon: "bwi-users",
            label: this.i18nService.t("pamAccessRuleConditionRequiresApproval"),
          }
        : { icon: "bwi-check", label: this.i18nService.t("pamAccessRuleConditionAutoApproved") },
    );
    if (conditions.some((c) => c.kind === "ip_allowlist")) {
      badges.push({
        icon: "bwi-globe",
        label: this.i18nService.t("pamAccessRuleConditionIpRestricted"),
      });
    }
    return badges;
  }

  private accessWindow(rule: AccessRuleResponse): string | null {
    const def = rule.defaultLeaseDurationSeconds;
    if (def == null) {
      return null;
    }
    const max = rule.maxLeaseDurationSeconds;
    if (max != null && max !== def) {
      return `${formatDurationShort(def)}–${formatDurationShort(max)}`;
    }
    return formatDurationShort(def);
  }

  private relativeTime(epochMs: number, now: number): string {
    let duration = (epochMs - now) / 1000;
    const divisions: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
      { amount: 60, unit: "second" },
      { amount: 60, unit: "minute" },
      { amount: 24, unit: "hour" },
      { amount: 7, unit: "day" },
      { amount: 4.34524, unit: "week" },
      { amount: 12, unit: "month" },
      { amount: Number.POSITIVE_INFINITY, unit: "year" },
    ];
    for (const division of divisions) {
      if (Math.abs(duration) < division.amount) {
        return this.relativeTimeFormat.format(Math.round(duration), division.unit);
      }
      duration /= division.amount;
    }
    return "";
  }

  private toRequest(rule: AccessRuleResponse, enabled: boolean): AccessRuleRequest {
    return new AccessRuleRequest({
      name: rule.name,
      description: rule.description,
      conditions: rule.conditions,
      collections: rule.collections,
      defaultLeaseDurationSeconds: rule.defaultLeaseDurationSeconds,
      maxLeaseDurationSeconds: rule.maxLeaseDurationSeconds,
      singleActiveLease: rule.singleActiveLease,
      enabled,
    });
  }

  private showError(e: unknown): void {
    const message =
      e instanceof ErrorResponse
        ? (e.message ?? this.i18nService.t("unexpectedError"))
        : this.i18nService.t("unexpectedError");
    this.toastService.showToast({ variant: "error", message });
  }

  private async openDialog(data: Omit<AccessRuleDialogData, "organizationId">): Promise<void> {
    const ref = AccessRuleDialogComponent.open(this.dialogService, {
      data: { organizationId: this.organizationId(), ...data },
    });
    if ((await lastValueFrom(ref.closed)) === "saved") {
      await this.reload(this.organizationId());
    }
  }

  private async reload(organizationId: OrganizationId): Promise<void> {
    this.loading.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const [rulesResponse, collections] = await Promise.all([
        this.pamApi.listAccessRules(organizationId),
        firstValueFrom(this.collectionAdminService.collectionAdminViews$(organizationId, userId)),
      ]);
      this.collectionNameById.set(new Map(collections.map((c) => [c.id, c.name])));
      this.rules.set(rulesResponse.data);
    } finally {
      this.loading.set(false);
    }
  }
}

/** Compact lease-duration label, e.g. `15m`, `1h`, `4h`, `1d`. */
function formatDurationShort(seconds: number): string {
  if (seconds % 86400 === 0) {
    return `${seconds / 86400}d`;
  }
  if (seconds % 3600 === 0) {
    return `${seconds / 3600}h`;
  }
  if (seconds % 60 === 0) {
    return `${seconds / 60}m`;
  }
  return `${seconds}s`;
}
