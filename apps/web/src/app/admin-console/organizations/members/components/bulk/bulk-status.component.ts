import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";

import { OrganizationUserBulkResponse } from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import {
  OrganizationUserStatusType,
  ProviderUserStatusType,
} from "@bitwarden/common/admin-console/enums";
import { ProviderUserBulkResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user-bulk.response";
import { ProviderUserUserDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AvatarModule,
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogService,
  TableModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { OrganizationUserView } from "../../../core/views/organization-user.view";

export interface BulkUserDetails {
  id: string;
  name: string | undefined;
  email: string;
  status: OrganizationUserStatusType | ProviderUserStatusType;
  hasMasterPassword?: boolean;
  claimedByOrganization?: boolean;
}

type BulkStatusEntry = {
  user: BulkUserDetails;
  error: boolean;
  message: string;
};

type BulkStatusDialogData = {
  users: Array<OrganizationUserView | ProviderUserUserDetailsResponse>;
  filteredUsers: Array<OrganizationUserView | ProviderUserUserDetailsResponse>;
  request: Promise<OrganizationUserBulkResponse[] | ProviderUserBulkResponse[]>;
  successfulMessage: string;
};

@Component({
  selector: "member-bulk-status",
  templateUrl: "bulk-status.component.html",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    I18nPipe,
    TableModule,
    UserNamePipe,
  ],
})
export class BulkStatusComponent {
  private readonly data = inject<BulkStatusDialogData>(DIALOG_DATA);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  protected readonly users = signal<BulkStatusEntry[] | undefined>(undefined);
  protected readonly loading = signal(false);

  constructor() {
    void this.showBulkStatus(this.data);
  }

  async showBulkStatus(data: BulkStatusDialogData) {
    this.loading.set(true);
    try {
      const response = await data.request;
      const keyedErrors: Record<string, string> = (response ?? [])
        .filter((r) => r.error !== "")
        .reduce((a, x) => ({ ...a, [x.id]: x.error }), {});
      const keyedFilteredUsers: Record<
        string,
        OrganizationUserView | ProviderUserUserDetailsResponse
      > = data.filteredUsers.reduce((a, x) => ({ ...a, [x.id]: x }), {});

      this.users.set(
        data.users.map((user) => {
          let message = keyedErrors[user.id] ?? data.successfulMessage;
          if (!Object.prototype.hasOwnProperty.call(keyedFilteredUsers, user.id)) {
            message = this.i18nService.t("bulkFilteredMessage");
          }

          return {
            user: user,
            error: Object.prototype.hasOwnProperty.call(keyedErrors, user.id),
            message: message,
          };
        }),
      );
      this.loading.set(false);
    } catch (e) {
      this.logService.error(e);
    }
  }

  static open(dialogService: DialogService, config: DialogConfig<BulkStatusDialogData>) {
    return dialogService.open(BulkStatusComponent, config);
  }
}
