import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ProviderApiServiceAbstraction,
  Provider,
  AddableOrganizationResponse,
} from "@bitwarden/common/provider";
import {
  AsyncActionsModule,
  AvatarModule,
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  TableModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { WebProviderService } from "../services/web-provider.service";

export type AddExistingOrganizationDialogParams = {
  provider: Provider;
};

export const AddExistingOrganizationDialogResultType = Object.freeze({
  Closed: "closed",
  Submitted: "submitted",
} as const);
export type AddExistingOrganizationDialogResultType =
  (typeof AddExistingOrganizationDialogResultType)[keyof typeof AddExistingOrganizationDialogResultType];

@Component({
  templateUrl: "./add-existing-organization-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18nPipe, DialogModule, TableModule, AvatarModule, ButtonModule, AsyncActionsModule],
})
export class AddExistingOrganizationDialogComponent implements OnInit {
  private readonly dialogRef =
    inject<DialogRef<AddExistingOrganizationDialogResultType>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  private readonly providerApiService = inject(ProviderApiServiceAbstraction);
  private readonly toastService = inject(ToastService);
  private readonly webProviderService = inject(WebProviderService);
  private readonly accountService = inject(AccountService);
  protected readonly dialogParams = inject<AddExistingOrganizationDialogParams>(DIALOG_DATA);

  protected readonly loading = signal(true);
  protected readonly addableOrganizations = signal<AddableOrganizationResponse[]>([]);
  protected readonly selectedOrganization = signal<AddableOrganizationResponse | undefined>(
    undefined,
  );

  protected readonly ResultType = AddExistingOrganizationDialogResultType;

  async ngOnInit() {
    this.addableOrganizations.set(
      await this.providerApiService.getProviderAddableOrganizations(this.dialogParams.provider.id),
    );
    this.loading.set(false);
  }

  protected readonly addExistingOrganization = async (): Promise<void> => {
    const selectedOrganization = this.selectedOrganization();
    if (selectedOrganization == null) {
      return;
    }

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    await this.webProviderService.addOrganizationToProvider(
      this.dialogParams.provider.id,
      selectedOrganization.id,
      userId,
    );

    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("addedExistingOrganization"),
    });

    await this.dialogRef.close(this.ResultType.Submitted);
  };

  protected selectOrganization(organizationId: string) {
    this.selectedOrganization.set(
      this.addableOrganizations().find((organization) => organization.id === organizationId),
    );
  }

  static readonly open = (
    dialogService: DialogService,
    dialogConfig: DialogConfig<
      AddExistingOrganizationDialogParams,
      AddExistingOrganizationDialogResultType
    >,
  ) =>
    dialogService.open<
      AddExistingOrganizationDialogResultType,
      AddExistingOrganizationDialogParams
    >(AddExistingOrganizationDialogComponent, dialogConfig);
}
