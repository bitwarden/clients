import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { Observable } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserResetPasswordDetailsResponse,
} from "@bitwarden/admin-console/common";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";

import { OrganizationUserResetPasswordService } from "../../services/organization-user-reset-password/organization-user-reset-password.service";

import {
  AccountRecoveryDialogComponent,
  AccountRecoveryDialogData,
} from "./account-recovery-dialog.component";

describe("AccountRecoveryDialogComponent", () => {
  const dialogData: AccountRecoveryDialogData = {
    name: "Member",
    email: "member@example.com",
    organizationUserId: "organization-user-id",
    organizationId: "organization-id" as OrganizationId,
    organizationUserType: OrganizationUserType.Owner,
    twoFactorEnabled: false,
  };

  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let component: AccountRecoveryDialogComponent;

  beforeEach(() => {
    organizationUserApiService = mock<OrganizationUserApiService>();

    TestBed.configureTestingModule({
      imports: [AccountRecoveryDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: dialogData },
        { provide: AccountService, useValue: mock<AccountService>() },
        { provide: DialogRef, useValue: mock<DialogRef>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: PolicyService, useValue: mock<PolicyService>() },
        {
          provide: OrganizationUserResetPasswordService,
          useValue: mock<OrganizationUserResetPasswordService>(),
        },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: OrganizationUserApiService, useValue: organizationUserApiService },
      ],
    }).overrideComponent(AccountRecoveryDialogComponent, {
      set: { template: "", imports: [] },
    });

    component = TestBed.createComponent(AccountRecoveryDialogComponent).componentInstance;
  });

  const mockDetails = (isSoleOwnerOfOtherOrganization: boolean) =>
    organizationUserApiService.getOrganizationUserResetPasswordDetails.mockResolvedValue(
      new OrganizationUserResetPasswordDetailsResponse({
        IsSoleOwnerOfOtherOrganization: isSoleOwnerOfOtherOrganization,
      }),
    );

  /** Subscribes to the callout state and returns a function reading its latest value. */
  const watchCallout = () => {
    let latest: boolean | undefined;
    const callout$: Observable<boolean> = component["showSoleOwnerCallout$"];
    callout$.subscribe((value) => (latest = value));
    return () => latest;
  };

  it("shows the callout when the user solely owns another organization", async () => {
    mockDetails(true);

    const callout = watchCallout();
    await Promise.resolve();

    expect(callout()).toBe(true);
    expect(organizationUserApiService.getOrganizationUserResetPasswordDetails).toHaveBeenCalledWith(
      dialogData.organizationId,
      dialogData.organizationUserId,
    );
  });

  it("hides the callout when the user does not solely own another organization", async () => {
    mockDetails(false);

    const callout = watchCallout();
    await Promise.resolve();

    expect(callout()).toBe(false);
  });

  it("hides the callout while resetting the master password is unchecked", async () => {
    mockDetails(true);

    const callout = watchCallout();
    await Promise.resolve();
    component["form"].controls.resetMasterPassword.setValue(false);

    expect(callout()).toBe(false);

    component["form"].controls.resetMasterPassword.setValue(true);

    expect(callout()).toBe(true);
  });

  it("hides the callout when the details request fails", async () => {
    organizationUserApiService.getOrganizationUserResetPasswordDetails.mockRejectedValue(
      new Error("request failed"),
    );

    const callout = watchCallout();
    await Promise.resolve();
    await Promise.resolve();

    expect(callout()).toBe(false);
  });

  it("hides the callout when the server does not return sole ownership", async () => {
    organizationUserApiService.getOrganizationUserResetPasswordDetails.mockResolvedValue(
      new OrganizationUserResetPasswordDetailsResponse({}),
    );

    const callout = watchCallout();
    await Promise.resolve();

    expect(callout()).toBe(false);
  });
});
