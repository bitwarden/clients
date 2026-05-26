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
import { LeasingPolicyKind, LeasingPolicyResponse, PamApiService } from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

import { HeaderModule } from "../../layouts/header/header.module";

import { LeasingPolicyDialogData , LeasingPolicyDialogComponent } from "./leasing-policy-dialog.component";
import { LeasingPolicySummaryComponent } from "./leasing-policy-summary.component";

const KIND_LABEL_KEYS: Record<LeasingPolicyKind, string> = {
  [LeasingPolicyKind.HumanApproval]: "pamLeasingModeHumanApproval",
  [LeasingPolicyKind.IpAllowlist]: "pamLeasingModeIpAllowlist",
  [LeasingPolicyKind.TimeOfDay]: "pamLeasingModeTimeOfDay",
  [LeasingPolicyKind.AllOf]: "pamLeasingModeAllOf",
};

@Component({
  templateUrl: "./leasing-policies.component.html",
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
    LeasingPolicySummaryComponent,
  ],
})
export class LeasingPoliciesComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly pamApi = inject(PamApiService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected readonly loading = signal(true);
  protected readonly policies = signal<LeasingPolicyResponse[]>([]);
  protected readonly LeasingPolicyKind = LeasingPolicyKind;

  private readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as OrganizationId)),
    { requireSync: true },
  );

  constructor() {
    effect(() => {
      void this.reload(this.organizationId());
    });
  }

  protected kindLabel(kind: LeasingPolicyKind): string {
    return this.i18nService.t(KIND_LABEL_KEYS[kind] ?? "");
  }

  protected readonly openCreate = (): Promise<void> => this.openDialog({});

  protected readonly openEdit = (policy: LeasingPolicyResponse): Promise<void> =>
    this.openDialog({ policy });

  protected readonly remove = async (policy: LeasingPolicyResponse): Promise<void> => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamLeasingPolicyDeleteConfirmTitle" },
      content: {
        key: "pamLeasingPolicyDeleteConfirmContent",
        placeholders: [policy.name],
      },
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.pamApi.deleteLeasingPolicy(this.organizationId(), policy.id);
      this.policies.update((list) => list.filter((p) => p.id !== policy.id));
    } catch (e) {
      const message =
        e instanceof ErrorResponse
          ? (e.message ?? this.i18nService.t("unexpectedError"))
          : this.i18nService.t("unexpectedError");
      this.toastService.showToast({ variant: "error", message });
    }
  };

  private async openDialog(data: Omit<LeasingPolicyDialogData, "organizationId">): Promise<void> {
    const ref = LeasingPolicyDialogComponent.open(this.dialogService, {
      data: { organizationId: this.organizationId(), ...data },
    });
    if ((await lastValueFrom(ref.closed)) === "saved") {
      await this.reload(this.organizationId());
    }
  }

  private async reload(organizationId: OrganizationId): Promise<void> {
    this.loading.set(true);
    try {
      const response = await this.pamApi.listLeasingPolicies(organizationId);
      this.policies.set(response.data);
    } finally {
      this.loading.set(false);
    }
  }
}
