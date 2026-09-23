import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider } from "@bitwarden/common/platform/state";
import {
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import {
  OrganizationInviteLink,
  OrganizationInviteLinkService,
} from "@bitwarden/organization-invite-link";

import { MemberDialogResult } from "../../components/member-dialog/member-dialog.types";
import { MemberDialogManagerService } from "../member-dialog-manager/member-dialog-manager.service";
import { OrganizationMembersService } from "../organization-members-service/organization-members.service";

import {
  INVITE_LINK_CALLOUT_DISMISSED_KEY,
  InviteLinkCalloutService,
} from "./invite-link-callout.service";

describe("InviteLinkCalloutService", () => {
  const userId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;
  let configService: MockProxy<ConfigService>;
  let memberDialogManager: MockProxy<MemberDialogManagerService>;
  let organizationMembersService: MockProxy<OrganizationMembersService>;
  let organizationMetadataService: MockProxy<OrganizationMetadataServiceAbstraction>;
  let organizationInviteLinkService: MockProxy<OrganizationInviteLinkService>;
  let dialogService: MockProxy<DialogService>;
  let router: MockProxy<Router>;
  let service: InviteLinkCalloutService;

  const mockBillingMetadata = {
    organizationOccupiedSeats: 5,
    isOnSecretsManagerStandalone: false,
  } as OrganizationBillingMetadataResponse;

  const createOrganization = (overrides: Partial<Organization> = {}): Organization =>
    ({
      id: Utils.newGuid() as OrganizationId,
      canManageUsers: true,
      useInviteLinks: true,
      ...overrides,
    }) as Organization;

  const stubDialogClosed = (result: unknown) => {
    dialogService.open.mockReturnValue({ closed: of(result) } as any);
  };

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
    configService = mock<ConfigService>();
    configService.getFeatureFlag.mockResolvedValue(true);
    memberDialogManager = mock<MemberDialogManagerService>();
    memberDialogManager.openInviteDialog.mockResolvedValue(MemberDialogResult.Saved);
    organizationMembersService = mock<OrganizationMembersService>();
    organizationMembersService.loadUsers.mockResolvedValue([]);
    organizationMetadataService = mock<OrganizationMetadataServiceAbstraction>();
    organizationMetadataService.getOrganizationMetadata$.mockReturnValue(of(mockBillingMetadata));
    organizationInviteLinkService = mock<OrganizationInviteLinkService>();
    organizationInviteLinkService.inviteLink$.mockReturnValue(of(undefined));
    dialogService = mock<DialogService>();
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        InviteLinkCalloutService,
        { provide: AccountService, useValue: accountService },
        { provide: StateProvider, useValue: stateProvider },
        { provide: ConfigService, useValue: configService },
        { provide: MemberDialogManagerService, useValue: memberDialogManager },
        { provide: OrganizationMembersService, useValue: organizationMembersService },
        { provide: OrganizationMetadataServiceAbstraction, useValue: organizationMetadataService },
        { provide: OrganizationInviteLinkService, useValue: organizationInviteLinkService },
        { provide: DialogService, useValue: dialogService },
        { provide: Router, useValue: router },
      ],
    });

    service = TestBed.inject(InviteLinkCalloutService);
  });

  it("isDismissed$ returns false for an org with no dismissal state", async () => {
    const orgId = Utils.newGuid() as OrganizationId;

    const dismissed = await firstValueFrom(service.isDismissed$(orgId));

    expect(dismissed).toBe(false);
  });

  it("isDismissed$ returns true after dismiss(orgId) is called", async () => {
    const orgId = Utils.newGuid() as OrganizationId;

    await service.dismiss(orgId);
    const dismissed = await firstValueFrom(service.isDismissed$(orgId));

    expect(dismissed).toBe(true);
  });

  it("dismiss() is idempotent — calling it twice for the same org does not create duplicates", async () => {
    const orgId = Utils.newGuid() as OrganizationId;

    await service.dismiss(orgId);
    await service.dismiss(orgId);

    const state = await firstValueFrom(
      stateProvider.getUser(userId, INVITE_LINK_CALLOUT_DISMISSED_KEY).state$,
    );

    expect(state).toEqual([orgId]);
  });

  it("showIfEligible() returns early without opening a dialog when org.canManageUsers is false", async () => {
    const organization = createOrganization({ canManageUsers: false });

    await service.showIfEligible(organization);

    expect(dialogService.open).not.toHaveBeenCalled();
  });

  it("showIfEligible() returns early without opening a dialog when the org is already dismissed", async () => {
    const organization = createOrganization();
    await service.dismiss(organization.id as OrganizationId);

    await service.showIfEligible(organization);

    expect(dialogService.open).not.toHaveBeenCalled();
  });

  it("showIfEligible() returns early without opening a dialog when the feature flag is disabled", async () => {
    configService.getFeatureFlag.mockResolvedValue(false);
    const organization = createOrganization();

    await service.showIfEligible(organization);

    expect(dialogService.open).not.toHaveBeenCalled();
  });

  it("showIfEligible() opens the dialog and calls dismiss() when the user clicks Skip", async () => {
    const organization = createOrganization();
    stubDialogClosed("skip");

    await service.showIfEligible(organization);

    expect(dialogService.open).toHaveBeenCalledTimes(1);
    const dismissed = await firstValueFrom(service.isDismissed$(organization.id as OrganizationId));
    expect(dismissed).toBe(true);
    expect(memberDialogManager.openInviteDialog).not.toHaveBeenCalled();
  });

  it("showIfEligible() returns early without opening a dialog when the org already has an invite link configured", async () => {
    const organization = createOrganization();
    organizationInviteLinkService.inviteLink$.mockReturnValue(
      of(Object.assign(new OrganizationInviteLink({} as any), { id: "link-1" })),
    );

    await service.showIfEligible(organization);

    expect(dialogService.open).not.toHaveBeenCalled();
  });

  it("showIfEligible() dismisses the callout for good when the org already has an invite link configured", async () => {
    const organization = createOrganization();
    organizationInviteLinkService.inviteLink$.mockReturnValue(
      of(Object.assign(new OrganizationInviteLink({} as any), { id: "link-1" })),
    );

    await service.showIfEligible(organization);
    const dismissed = await firstValueFrom(service.isDismissed$(organization.id as OrganizationId));

    expect(dismissed).toBe(true);
  });

  it("showIfEligible() opens the dialog, calls dismiss(), fetches metadata + users, and calls openInviteDialog({ showCoachMarks: true }) when the user clicks Try it", async () => {
    const organization = createOrganization();
    stubDialogClosed("showMeHow");

    await service.showIfEligible(organization);

    expect(dialogService.open).toHaveBeenCalledTimes(1);
    const dismissed = await firstValueFrom(service.isDismissed$(organization.id as OrganizationId));
    expect(dismissed).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(["organizations", organization.id, "members"]);
    expect(organizationMetadataService.getOrganizationMetadata$).toHaveBeenCalledWith(
      organization.id,
    );
    expect(organizationMembersService.loadUsers).toHaveBeenCalledWith(organization);
    expect(memberDialogManager.openInviteDialog).toHaveBeenCalledWith(
      organization,
      mockBillingMetadata,
      [],
      true,
    );
  });
});
