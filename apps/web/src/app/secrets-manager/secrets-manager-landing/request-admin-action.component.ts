import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnInit,
  Optional,
  computed,
  input,
  signal,
} from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Guid } from "@bitwarden/common/types/guid";
import {
  DIALOG_DATA,
  DialogRef,
  NoItemsModule,
  SearchModule,
  ToastService,
} from "@bitwarden/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { OssModule } from "../../oss.module";
import { SharedModule } from "../../shared/shared.module";
import { RequestAdminActionRequest } from "../models/requests/request-admin-action.request";

import { SmLandingApiService } from "./sm-landing-api.service";

type RequestAccessFormValue = {
  requestAccessEmailContents: string;
  selectedOrganization: Organization;
};

@Component({
  selector: "app-request-admin-action",
  templateUrl: "request-admin-action.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SharedModule, SearchModule, NoItemsModule, HeaderModule, OssModule],
})
export class RequestAdminActionComponent implements OnInit {
  private readonly addNoteKeyInput = input("addANote");
  private readonly approvalMessageKeyInput = input(
    "youNeedApprovalFromYourAdminToTrySecretsManager",
  );
  private readonly defaultEmailContentKeyInput = input("requestAccessSMDefaultEmailContent");
  private readonly sendRequestKeyInput = input("sendRequest");
  private readonly requestSentMessageKeyInput = input("smAccessRequestEmailSent");

  protected readonly addNoteKey = computed(() => this.data?.addNoteKey ?? this.addNoteKeyInput());
  protected readonly approvalMessageKey = computed(
    () => this.data?.approvalMessageKey ?? this.approvalMessageKeyInput(),
  );
  protected readonly defaultEmailContentKey = computed(
    () => this.data?.defaultEmailContentKey ?? this.defaultEmailContentKeyInput(),
  );
  protected readonly sendRequestKey = computed(
    () => this.data?.sendRequestKey ?? this.sendRequestKeyInput(),
  );
  protected readonly requestSentMessageKey = computed(
    () => this.data?.requestSentMessageKey ?? this.requestSentMessageKeyInput(),
  );

  readonly requestAccessForm = new FormGroup({
    requestAccessEmailContents: new FormControl<string>("", [Validators.required]),
    selectedOrganization: new FormControl<Organization | null>(null, [Validators.required]),
  });
  readonly organizations = signal<Organization[]>([]);

  constructor(
    private readonly router: Router,
    private readonly i18nService: I18nService,
    private readonly organizationService: OrganizationService,
    private readonly smLandingApiService: SmLandingApiService,
    private readonly toastService: ToastService,
    private readonly accountService: AccountService,
    @Optional() @Inject(DIALOG_DATA) private readonly data: any,
    private readonly dialogRef: DialogRef,
  ) {}

  async ngOnInit(): Promise<void> {
    this.requestAccessForm.controls.requestAccessEmailContents.setValue(
      this.i18nService.t(this.defaultEmailContentKey()),
    );

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.organizations.set(
      (await firstValueFrom(this.organizationService.organizations$(userId)))
        .filter((e) => e.enabled)
        .sort((a, b) => a.name.localeCompare(b.name)),
    );

    if (!this.organizations().length) {
      await this.navigateToCreateOrganizationPage();
    }
  }

  readonly submit = async (): Promise<void> => {
    this.requestAccessForm.markAllAsTouched();
    if (this.requestAccessForm.invalid) {
      return;
    }

    const formValue = this.requestAccessForm.getRawValue() as RequestAccessFormValue;
    const selectedOrg = formValue.selectedOrganization;

    if (!selectedOrg?.id) {
      return;
    }

    const request = new RequestAdminActionRequest();
    request.OrganizationId = selectedOrg.id as Guid;
    request.EmailContent = formValue.requestAccessEmailContents;
    request.EmailTemplateName = "SecretsManagerUpgradeRequest";

    await this.smLandingApiService.requestSMAccessFromAdmins(request);
    void this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(this.requestSentMessageKey()),
    });

    if (this.dialogRef) {
      void this.dialogRef.close(true);
    }
  };

  private async navigateToCreateOrganizationPage(): Promise<void> {
    await this.router.navigate(["/create-organization"]);
  }
}
