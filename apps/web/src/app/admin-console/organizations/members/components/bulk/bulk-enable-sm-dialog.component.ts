import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { UserTypePipe } from "@bitwarden/angular/pipes/user-type.pipe";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  AvatarModule,
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  TableDataSource,
  TableModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { OrganizationUserView } from "../../../core";

export type BulkEnableSecretsManagerDialogData = {
  orgId: string;
  users: OrganizationUserView[];
};

@Component({
  templateUrl: `bulk-enable-sm-dialog.component.html`,
  selector: "member-bulk-enable-sm-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    AsyncPipe,
    AvatarModule,
    ButtonModule,
    DialogModule,
    I18nPipe,
    TableModule,
    UserNamePipe,
    UserTypePipe,
  ],
})
export class BulkEnableSecretsManagerDialogComponent {
  protected readonly dialogRef = inject(DialogRef);
  private readonly data = inject<BulkEnableSecretsManagerDialogData>(DIALOG_DATA);
  private readonly organizationUserApiService = inject(OrganizationUserApiService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);

  protected readonly dataSource = new TableDataSource<OrganizationUserView>();

  constructor() {
    this.dataSource.data = this.data.users;
  }

  readonly submit = async () => {
    await this.organizationUserApiService.putOrganizationUserBulkEnableSecretsManager(
      this.data.orgId,
      this.dataSource.data.map((u) => u.id),
    );
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("activatedAccessToSecretsManager"),
    });
    await this.dialogRef.close();
  };

  static open(dialogService: DialogService, data: BulkEnableSecretsManagerDialogData) {
    return dialogService.open<unknown, BulkEnableSecretsManagerDialogData>(
      BulkEnableSecretsManagerDialogComponent,
      { data },
    );
  }
}
