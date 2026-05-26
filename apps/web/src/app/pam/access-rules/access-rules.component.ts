import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { lastValueFrom, map } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  BadgeModule,
  ButtonModule,
  DialogService,
  IconButtonModule,
  LinkModule,
  MenuModule,
  NoItemsModule,
  TableModule,
  ToastService,
} from "@bitwarden/components";
import { AccessRuleKind, AccessRuleResponse, PamApiService } from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

import { HeaderModule } from "../../layouts/header/header.module";

import { AccessRuleDialogData, AccessRuleDialogComponent } from "./access-rule-dialog.component";
import { AccessRuleSummaryComponent } from "./access-rule-summary.component";

const KIND_LABEL_KEYS: Record<AccessRuleKind, string> = {
  [AccessRuleKind.HumanApproval]: "pamAccessRuleKindHumanApproval",
  [AccessRuleKind.IpAllowlist]: "pamAccessRuleKindIpAllowlist",
  [AccessRuleKind.TimeOfDay]: "pamAccessRuleKindTimeOfDay",
  [AccessRuleKind.AllOf]: "pamAccessRuleKindAllOf",
};

@Component({
  templateUrl: "./access-rules.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    AsyncActionsModule,
    BadgeModule,
    ButtonModule,
    HeaderModule,
    IconButtonModule,
    LinkModule,
    MenuModule,
    NoItemsModule,
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

  protected readonly loading = signal(true);
  protected readonly rules = signal<AccessRuleResponse[]>([]);
  protected readonly AccessRuleKind = AccessRuleKind;

  private readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as OrganizationId)),
    { requireSync: true },
  );

  constructor() {
    effect(() => {
      void this.reload(this.organizationId());
    });
  }

  protected kindLabel(kind: AccessRuleKind): string {
    return this.i18nService.t(KIND_LABEL_KEYS[kind] ?? "");
  }

  protected readonly openCreate = (): Promise<void> => this.openDialog({});

  protected readonly openEdit = (rule: AccessRuleResponse): Promise<void> =>
    this.openDialog({ existing: rule });

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
      const response = await this.pamApi.listAccessRules(organizationId);
      this.rules.set(response.data);
    } finally {
      this.loading.set(false);
    }
  }
}
