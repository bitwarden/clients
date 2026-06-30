import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AvatarModule,
  BadgeModule,
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogService,
  TableModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DeleteManagedMemberWarningService } from "../../services/delete-managed-member/delete-managed-member-warning.service";

import { BulkUserDetails } from "./bulk-status.component";

type BulkDeleteDialogParams = {
  organizationId: string;
  users: BulkUserDetails[];
};

@Component({
  templateUrl: "bulk-delete-dialog.component.html",
  selector: "member-bulk-delete-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarModule,
    BadgeModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    I18nPipe,
    TableModule,
    UserNamePipe,
  ],
})
export class BulkDeleteDialogComponent {
  private readonly dialogParams = inject<BulkDeleteDialogParams>(DIALOG_DATA);
  protected readonly i18nService = inject(I18nService);
  private readonly organizationUserApiService = inject(OrganizationUserApiService);
  private readonly deleteManagedMemberWarningService = inject(DeleteManagedMemberWarningService);

  protected readonly userStatusType = OrganizationUserStatusType;
  protected readonly organizationId = signal(this.dialogParams.organizationId);
  protected readonly users = signal(this.dialogParams.users);

  protected readonly loading = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | undefined>(undefined);
  protected readonly statuses = signal(new Map<string, string>());

  async submit() {
    try {
      await this.deleteManagedMemberWarningService.acknowledgeWarning(this.organizationId());
      this.loading.set(true);
      this.error.set(undefined);

      const response = await this.organizationUserApiService.deleteManyOrganizationUsers(
        this.organizationId(),
        this.users().map((user) => user.id),
      );

      const newStatuses = new Map<string, string>();
      response.data.forEach((entry) => {
        newStatuses.set(
          entry.id,
          entry.error ? entry.error : this.i18nService.t("deletedSuccessfully"),
        );
      });
      this.statuses.set(newStatuses);

      this.done.set(true);
    } catch (e) {
      this.error.set((e as any)?.message ?? String(e));
    } finally {
      this.loading.set(false);
    }
  }

  static open(dialogService: DialogService, config: DialogConfig<BulkDeleteDialogParams>) {
    return dialogService.open(BulkDeleteDialogComponent, config);
  }
}
