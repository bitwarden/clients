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
  ButtonModule,
  DialogService,
  IconButtonModule,
  LinkModule,
  MenuModule,
  TableModule,
  ToastService,
} from "@bitwarden/components";
import { AccessRuleRequest, AccessRuleResponse, PamApiService } from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

import { HeaderModule } from "../../layouts/header/header.module";

import { AccessRuleDialogData, AccessRuleDialogComponent } from "./access-rule-dialog.component";
import { AccessRuleSummaryComponent } from "./access-rule-summary.component";

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
  imports: [
    CommonModule,
    AsyncActionsModule,
    ButtonModule,
    HeaderModule,
    IconButtonModule,
    LinkModule,
    MenuModule,
    TableModule,
    I18nPipe,
    AccessRuleSummaryComponent,
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

  protected readonly loading = signal(true);
  protected readonly rules = signal<AccessRuleResponse[]>([]);
  private readonly collectionNameById = signal<Map<string, string>>(new Map());

  protected readonly collectionNamesByRule = computed<Map<string, string[]>>(() => {
    const names = this.collectionNameById();
    const result = new Map<string, string[]>();
    for (const rule of this.rules()) {
      result.set(
        rule.id,
        rule.collections.map((id) => names.get(id) ?? id).sort((a, b) => a.localeCompare(b)),
      );
    }
    return result;
  });

  private readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as OrganizationId)),
    { requireSync: true },
  );

  constructor() {
    effect(() => {
      void this.reload(this.organizationId());
    });
  }

  protected readonly ruleTemplates = RULE_TEMPLATES;

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
        new AccessRuleRequest({
          name: rule.name,
          description: rule.description,
          conditions: rule.conditions,
          collections: rule.collections,
          defaultLeaseDurationSeconds: rule.defaultLeaseDurationSeconds,
          maxLeaseDurationSeconds: rule.maxLeaseDurationSeconds,
          singleActiveLease: rule.singleActiveLease,
          enabled: nextEnabled,
        }),
      );
      this.rules.update((list) => list.map((r) => (r.id === rule.id ? updated : r)));
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(
          nextEnabled ? "pamAccessRuleEnableSuccess" : "pamAccessRuleDisableSuccess",
        ),
      });
    } catch (e) {
      const message =
        e instanceof ErrorResponse
          ? (e.message ?? this.i18nService.t("unexpectedError"))
          : this.i18nService.t("unexpectedError");
      this.toastService.showToast({ variant: "error", message });
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
      const message =
        e instanceof ErrorResponse
          ? (e.message ?? this.i18nService.t("unexpectedError"))
          : this.i18nService.t("unexpectedError");
      this.toastService.showToast({ variant: "error", message });
    }
  };

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
