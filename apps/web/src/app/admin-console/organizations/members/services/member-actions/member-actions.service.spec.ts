import { TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { firstValueFrom, of, throwError } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserInviteRequest,
  OrganizationUserService,
} from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import {
  OrganizationUserType,
  OrganizationUserStatusType,
} from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
import { OrganizationUserBulkResponse, OrganizationUserId } from "@bitwarden/sdk-internal";

import { OrganizationUserView } from "../../../core/views/organization-user.view";
import { MemberDialogManagerService } from "../member-dialog-manager/member-dialog-manager.service";

import { MemberActionsService } from "./member-actions.service";
import { REQUESTS_PER_BATCH } from "./member-actions.types";

describe("MemberActionsService", () => {
  let service: MemberActionsService;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let organizationUserService: MockProxy<OrganizationUserService>;
  let organizationMetadataService: MockProxy<OrganizationMetadataServiceAbstraction>;
  let memberDialogManager: MockProxy<MemberDialogManagerService>;
  let sdkService: MockProxy<SdkService>;
  let membersClient: {
    send_staged_invites: jest.Mock;
    bulk_reinvite: jest.Mock;
    reinvite: jest.Mock;
  };
  let disposeClient: jest.Mock;

  const activeUserId = newGuid();
  const organizationId = newGuid() as OrganizationId;
  const userIdToManage = newGuid();

  let mockOrganization: Organization;
  let mockOrgUser: OrganizationUserView;

  beforeEach(() => {
    organizationUserApiService = mock<OrganizationUserApiService>();
    organizationUserService = mock<OrganizationUserService>();
    organizationMetadataService = mock<OrganizationMetadataServiceAbstraction>();
    memberDialogManager = mock<MemberDialogManagerService>();

    membersClient = {
      send_staged_invites: jest.fn(),
      bulk_reinvite: jest.fn(),
      reinvite: jest.fn(),
    };
    disposeClient = jest.fn();
    const clientRef = {
      value: { organization_users_management: () => membersClient },
      [Symbol.dispose]: disposeClient,
    };
    sdkService = mock<SdkService>();
    sdkService.userClient$.mockReturnValue(of({ take: () => clientRef } as any));

    mockOrganization = {
      id: organizationId,
      type: OrganizationUserType.Owner,
      canManageUsersPassword: true,
      hasPublicAndPrivateKeys: true,
      useResetPassword: true,
    } as Organization;

    mockOrgUser = {
      id: userIdToManage,
      userId: userIdToManage,
      type: OrganizationUserType.User,
      status: OrganizationUserStatusType.Confirmed,
      resetPasswordEnrolled: true,
    } as OrganizationUserView;

    TestBed.configureTestingModule({
      providers: [
        MemberActionsService,
        { provide: OrganizationUserApiService, useValue: organizationUserApiService },
        { provide: OrganizationUserService, useValue: organizationUserService },
        {
          provide: OrganizationMetadataServiceAbstraction,
          useValue: organizationMetadataService,
        },
        { provide: ApiService, useValue: mock<ApiService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: LegacyCompatKeyService, useValue: mock<LegacyCompatKeyService>() },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: OrganizationManagementPreferencesService,
          useValue: mock<OrganizationManagementPreferencesService>(),
        },
        { provide: UserNamePipe, useValue: mock<UserNamePipe>() },
        { provide: MemberDialogManagerService, useValue: memberDialogManager },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: SdkService, useValue: sdkService },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: activeUserId }) } as unknown as AccountService,
        },
      ],
    });

    service = TestBed.inject(MemberActionsService);
  });

  describe("invite", () => {
    it("should successfully invite a user", async () => {
      organizationUserApiService.postOrganizationUserInvite.mockResolvedValue(undefined);

      const request = new OrganizationUserInviteRequest({
        emails: ["test@example.com"],
        type: OrganizationUserType.User,
        accessSecretsManager: false,
        collections: [],
        groups: [],
        permissions: {} as any,
      });

      const result = await service.invite(organizationId, request);

      expect(result).toEqual({ success: true });
      expect(organizationUserApiService.postOrganizationUserInvite).toHaveBeenCalledWith(
        organizationId,
        request,
      );
    });

    it("should handle invite errors", async () => {
      const errorMessage = "Invitation failed";
      organizationUserApiService.postOrganizationUserInvite.mockRejectedValue(
        new Error(errorMessage),
      );

      const request = new OrganizationUserInviteRequest({
        emails: ["test@example.com"],
        type: OrganizationUserType.User,
        accessSecretsManager: false,
        collections: [],
        groups: [],
        permissions: {} as any,
      });

      const result = await service.invite(organizationId, request);

      expect(result).toEqual({ success: false, error: errorMessage });
    });
  });

  describe("removeUser", () => {
    it("should successfully remove a user", async () => {
      organizationUserApiService.removeOrganizationUser.mockResolvedValue(undefined);

      const result = await service.removeUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: true });
      expect(organizationUserApiService.removeOrganizationUser).toHaveBeenCalledWith(
        organizationId,
        userIdToManage,
      );
    });

    it("should handle remove errors", async () => {
      const errorMessage = "Remove failed";
      organizationUserApiService.removeOrganizationUser.mockRejectedValue(new Error(errorMessage));

      const result = await service.removeUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: false, error: errorMessage });
    });
  });

  describe("revokeUser", () => {
    it("should successfully revoke a user", async () => {
      organizationUserApiService.revokeOrganizationUser.mockResolvedValue(undefined);

      const result = await service.revokeUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: true });
      expect(organizationUserApiService.revokeOrganizationUser).toHaveBeenCalledWith(
        organizationId,
        userIdToManage,
      );
    });

    it("should handle revoke errors", async () => {
      const errorMessage = "Revoke failed";
      organizationUserApiService.revokeOrganizationUser.mockRejectedValue(new Error(errorMessage));

      const result = await service.revokeUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: false, error: errorMessage });
    });
  });

  describe("restoreUser", () => {
    it("should call organizationUserService.restoreUser", async () => {
      organizationUserService.restoreUser.mockReturnValue(of(undefined));

      const result = await service.restoreUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: true });
      expect(organizationUserService.restoreUser).toHaveBeenCalledWith(
        mockOrganization,
        userIdToManage,
      );
    });

    it("should handle errors from organizationUserService.restoreUser", async () => {
      const errorMessage = "Restore failed";
      organizationUserService.restoreUser.mockReturnValue(
        throwError(() => new Error(errorMessage)),
      );

      const result = await service.restoreUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: false, error: errorMessage });
    });
  });

  describe("deleteUser", () => {
    it("should successfully delete a user", async () => {
      organizationUserApiService.deleteOrganizationUser.mockResolvedValue(undefined);

      const result = await service.deleteUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: true });
      expect(organizationUserApiService.deleteOrganizationUser).toHaveBeenCalledWith(
        organizationId,
        userIdToManage,
      );
    });

    it("should handle delete errors", async () => {
      const errorMessage = "Delete failed";
      organizationUserApiService.deleteOrganizationUser.mockRejectedValue(new Error(errorMessage));

      const result = await service.deleteUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: false, error: errorMessage });
    });
  });

  /** A row of the SDK's bulk response; `error` is absent when the member succeeded. */
  const memberOutcome = (id: string, error?: string): OrganizationUserBulkResponse => ({
    id: id as OrganizationUserId,
    error,
  });

  const sdkRequestFailure = (serverMessage: string) =>
    new Error(
      `error in response: status code 400 Bad Request: {"message":"${serverMessage}","validationErrors":null}`,
    );

  describe("reinviteUser", () => {
    it("should successfully reinvite a user", async () => {
      membersClient.reinvite.mockResolvedValue(undefined);

      const result = await firstValueFrom(service.reinviteUser(mockOrganization, userIdToManage));

      expect(result).toEqual({ success: true });
      expect(membersClient.reinvite).toHaveBeenCalledWith(organizationId, userIdToManage);
    });

    it("should handle reinvite errors", async () => {
      const errorMessage = "Reinvite failed";
      membersClient.reinvite.mockRejectedValue(new Error(errorMessage));

      const result = await firstValueFrom(service.reinviteUser(mockOrganization, userIdToManage));

      expect(result).toEqual({ success: false, error: errorMessage });
    });

    it("should surface the server message when the SDK rejects the request", async () => {
      membersClient.reinvite.mockRejectedValue(sdkRequestFailure("User invalid."));

      const result = await firstValueFrom(service.reinviteUser(mockOrganization, userIdToManage));

      expect(result).toEqual({ success: false, error: "User invalid." });
    });
  });

  describe("sendInvite", () => {
    it("should send invites to the given staged members", async () => {
      membersClient.send_staged_invites.mockResolvedValue([memberOutcome(userIdToManage)]);

      const result = await firstValueFrom(service.sendInvite(mockOrganization, userIdToManage));

      expect(result).toEqual({ success: true });
      expect(membersClient.send_staged_invites).toHaveBeenCalledWith(organizationId, [
        userIdToManage,
      ]);
    });

    it("should use the active user's SDK client and release it afterwards", async () => {
      membersClient.send_staged_invites.mockResolvedValue([memberOutcome(userIdToManage)]);

      await firstValueFrom(service.sendInvite(mockOrganization, userIdToManage));

      expect(sdkService.userClient$).toHaveBeenCalledWith(activeUserId);
      expect(disposeClient).toHaveBeenCalled();
    });

    it("should refresh the metadata cache because promotion occupies a seat", async () => {
      membersClient.send_staged_invites.mockResolvedValue([memberOutcome(userIdToManage)]);

      await firstValueFrom(service.sendInvite(mockOrganization, userIdToManage));

      expect(organizationMetadataService.refreshMetadataCache).toHaveBeenCalled();
    });

    it("should surface a per-member error reported by the server", async () => {
      membersClient.send_staged_invites.mockResolvedValue([
        memberOutcome(userIdToManage, "Only staged members can be sent an invitation."),
      ]);

      const result = await firstValueFrom(service.sendInvite(mockOrganization, userIdToManage));

      expect(result).toEqual({
        success: false,
        error: "Only staged members can be sent an invitation.",
      });
      expect(organizationMetadataService.refreshMetadataCache).not.toHaveBeenCalled();
    });

    it("should handle send invite errors", async () => {
      const errorMessage = "Send invite failed";
      membersClient.send_staged_invites.mockRejectedValue(new Error(errorMessage));

      const result = await firstValueFrom(service.sendInvite(mockOrganization, userIdToManage));

      expect(result).toEqual({ success: false, error: errorMessage });
      expect(organizationMetadataService.refreshMetadataCache).not.toHaveBeenCalled();
    });
  });

  describe("bulkSendInvite", () => {
    const stagedUserId = userIdToManage;
    const skippedUserId = newGuid();

    it("should split the response into successful and failed members", async () => {
      membersClient.send_staged_invites.mockResolvedValue([
        memberOutcome(stagedUserId),
        memberOutcome(skippedUserId, "Only staged members can be sent an invitation."),
      ]);

      const result = await firstValueFrom(
        service.bulkSendInvite(mockOrganization, [stagedUserId, skippedUserId]),
      );

      expect(result.successful.map((r) => r.id)).toEqual([stagedUserId]);
      expect(result.failed).toEqual([
        { id: skippedUserId, error: "Only staged members can be sent an invitation." },
      ]);
      expect(organizationMetadataService.refreshMetadataCache).toHaveBeenCalled();
    });

    it("should not refresh the metadata cache when no member was invited", async () => {
      membersClient.send_staged_invites.mockResolvedValue([
        memberOutcome(skippedUserId, "Only staged members can be sent an invitation."),
      ]);

      const result = await firstValueFrom(
        service.bulkSendInvite(mockOrganization, [skippedUserId]),
      );

      expect(result.successful).toHaveLength(0);
      expect(organizationMetadataService.refreshMetadataCache).not.toHaveBeenCalled();
    });

    it("should fail every member when the request throws", async () => {
      membersClient.send_staged_invites.mockRejectedValue(new Error("Seat limit reached"));

      const result = await firstValueFrom(
        service.bulkSendInvite(mockOrganization, [stagedUserId, skippedUserId]),
      );

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toEqual([
        { id: stagedUserId, error: "Seat limit reached" },
        { id: skippedUserId, error: "Seat limit reached" },
      ]);
    });

    it("should surface the server message when the SDK rejects the whole request", async () => {
      membersClient.send_staged_invites.mockRejectedValue(
        sdkRequestFailure("Seat limit has been reached."),
      );

      const result = await firstValueFrom(
        service.bulkSendInvite(mockOrganization, [stagedUserId, skippedUserId]),
      );

      expect(result.failed.map((f) => f.error)).toEqual([
        "Seat limit has been reached.",
        "Seat limit has been reached.",
      ]);
    });
  });

  describe("confirmUser", () => {
    const publicKey = new Uint8Array([1, 2, 3, 4, 5]);

    it("should confirm user", async () => {
      organizationUserService.confirmUser.mockReturnValue(of(undefined));

      const result = await service.confirmUser(mockOrgUser, publicKey, mockOrganization);

      expect(result).toEqual({ success: true });
      expect(organizationUserService.confirmUser).toHaveBeenCalledWith(
        mockOrganization,
        mockOrgUser.id,
        publicKey,
      );
      expect(organizationUserApiService.postOrganizationUserConfirm).not.toHaveBeenCalled();
    });

    it("should handle confirm errors", async () => {
      const errorMessage = "Confirm failed";
      organizationUserService.confirmUser.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const result = await service.confirmUser(mockOrgUser, publicKey, mockOrganization);

      expect(result.success).toBe(false);
      expect(result.error).toContain(errorMessage);
    });
  });

  describe("bulkReinvite", () => {
    const memberIds = (count: number) => Array.from({ length: count }, () => newGuid());
    const asUsers = (ids: string[]) => ids.map((id) => ({ id }) as OrganizationUserView);
    const allSent = (ids: string[]) => ids.map((id) => memberOutcome(id));

    beforeEach(() => {
      memberDialogManager.openBulkProgressDialog.mockReturnValue({ closed: of(undefined) } as any);
      memberDialogManager.openBulkReinviteFailureDialog.mockReturnValue(of([]));
    });

    it("should process users in a single batch when count equals REQUESTS_PER_BATCH", async () => {
      const ids = memberIds(REQUESTS_PER_BATCH);
      membersClient.bulk_reinvite.mockResolvedValue(allSent(ids));

      const result = await firstValueFrom(service.bulkReinvite(mockOrganization, asUsers(ids)));

      expect(result.successful).toHaveLength(REQUESTS_PER_BATCH);
      expect(result.failed).toHaveLength(0);
      expect(membersClient.bulk_reinvite).toHaveBeenCalledTimes(1);
      expect(membersClient.bulk_reinvite).toHaveBeenCalledWith(organizationId, ids);
    });

    it("should process users in multiple batches when count exceeds REQUESTS_PER_BATCH", async () => {
      const ids = memberIds(REQUESTS_PER_BATCH + 100);
      const firstBatch = ids.slice(0, REQUESTS_PER_BATCH);
      const secondBatch = ids.slice(REQUESTS_PER_BATCH);
      membersClient.bulk_reinvite
        .mockResolvedValueOnce(allSent(firstBatch))
        .mockResolvedValueOnce(allSent(secondBatch));

      const result = await firstValueFrom(service.bulkReinvite(mockOrganization, asUsers(ids)));

      expect(result.successful).toHaveLength(ids.length);
      expect(result.failed).toHaveLength(0);
      expect(membersClient.bulk_reinvite).toHaveBeenCalledTimes(2);
      expect(membersClient.bulk_reinvite).toHaveBeenNthCalledWith(1, organizationId, firstBatch);
      expect(membersClient.bulk_reinvite).toHaveBeenNthCalledWith(2, organizationId, secondBatch);
    });

    it("should aggregate results across multiple successful batches", async () => {
      const ids = memberIds(REQUESTS_PER_BATCH + 50);
      const firstBatch = allSent(ids.slice(0, REQUESTS_PER_BATCH));
      const secondBatch = allSent(ids.slice(REQUESTS_PER_BATCH));
      membersClient.bulk_reinvite
        .mockResolvedValueOnce(firstBatch)
        .mockResolvedValueOnce(secondBatch);

      const result = await firstValueFrom(service.bulkReinvite(mockOrganization, asUsers(ids)));

      expect(result.successful).toEqual([...firstBatch, ...secondBatch]);
      expect(result.failed).toHaveLength(0);
    });

    it("should handle mixed individual errors across multiple batches", async () => {
      const ids = memberIds(REQUESTS_PER_BATCH + 4);
      const firstBatch = ids
        .slice(0, REQUESTS_PER_BATCH)
        .map((id, index) =>
          memberOutcome(id, index % 10 === 0 ? "Rate limit exceeded" : undefined),
        );
      const secondBatch = [
        memberOutcome(ids[REQUESTS_PER_BATCH]),
        memberOutcome(ids[REQUESTS_PER_BATCH + 1], "Invalid email"),
        memberOutcome(ids[REQUESTS_PER_BATCH + 2]),
        memberOutcome(ids[REQUESTS_PER_BATCH + 3], "User suspended"),
      ];
      membersClient.bulk_reinvite
        .mockResolvedValueOnce(firstBatch)
        .mockResolvedValueOnce(secondBatch);

      const result = await firstValueFrom(service.bulkReinvite(mockOrganization, asUsers(ids)));

      // Every 10th index of the first batch fails, plus the two explicit failures in the second.
      const expectedFailures = Math.floor((REQUESTS_PER_BATCH - 1) / 10) + 1 + 2;
      expect(result.successful).toHaveLength(ids.length - expectedFailures);
      expect(result.failed).toHaveLength(expectedFailures);
      expect(result.failed.some((f) => f.error === "Rate limit exceeded")).toBe(true);
      expect(result.failed.some((f) => f.error === "Invalid email")).toBe(true);
      expect(result.failed.some((f) => f.error === "User suspended")).toBe(true);
    });

    it("should aggregate all failures when all batches fail", async () => {
      const ids = memberIds(REQUESTS_PER_BATCH + 100);
      const errorMessage = "All batches failed";
      membersClient.bulk_reinvite.mockRejectedValue(new Error(errorMessage));

      const result = await firstValueFrom(service.bulkReinvite(mockOrganization, asUsers(ids)));

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(ids.length);
      expect(result.failed.every((f) => f.error === errorMessage)).toBe(true);
      expect(membersClient.bulk_reinvite).toHaveBeenCalledTimes(2);
    });

    it("should surface the server message when the SDK rejects a batch", async () => {
      const ids = memberIds(2);
      membersClient.bulk_reinvite.mockRejectedValue(sdkRequestFailure("User invalid."));

      const result = await firstValueFrom(service.bulkReinvite(mockOrganization, asUsers(ids)));

      expect(result.failed.map((f) => f.error)).toEqual(["User invalid.", "User invalid."]);
    });

    it("should handle an empty batch response", async () => {
      const ids = memberIds(REQUESTS_PER_BATCH + 50);
      membersClient.bulk_reinvite
        .mockResolvedValueOnce(allSent(ids.slice(0, REQUESTS_PER_BATCH)))
        .mockResolvedValueOnce([]);

      const result = await firstValueFrom(service.bulkReinvite(mockOrganization, asUsers(ids)));

      expect(result.successful).toHaveLength(REQUESTS_PER_BATCH);
      expect(result.failed).toHaveLength(0);
    });

    it("should process batches sequentially in order", async () => {
      const ids = memberIds(REQUESTS_PER_BATCH * 2);
      const callOrder: number[] = [];
      membersClient.bulk_reinvite.mockImplementation(async (_orgId, batchIds: string[]) => {
        callOrder.push(batchIds.includes(ids[0]) ? 1 : 2);
        return allSent(batchIds);
      });

      await firstValueFrom(service.bulkReinvite(mockOrganization, asUsers(ids)));

      expect(callOrder).toEqual([1, 2]);
      expect(membersClient.bulk_reinvite).toHaveBeenCalledTimes(2);
    });

    it("should open progress dialog when user count exceeds REQUESTS_PER_BATCH", async () => {
      const ids = memberIds(REQUESTS_PER_BATCH + 100);
      membersClient.bulk_reinvite
        .mockResolvedValueOnce(allSent(ids.slice(0, REQUESTS_PER_BATCH)))
        .mockResolvedValueOnce(allSent(ids.slice(REQUESTS_PER_BATCH)));

      await firstValueFrom(service.bulkReinvite(mockOrganization, asUsers(ids)));

      expect(memberDialogManager.openBulkReinviteFailureDialog).not.toHaveBeenCalled();
      expect(memberDialogManager.openBulkProgressDialog).toHaveBeenCalledWith(
        expect.anything(),
        ids.length,
      );
    });

    it("should not open progress dialog when user count is or below REQUESTS_PER_BATCH", async () => {
      const ids = memberIds(REQUESTS_PER_BATCH);
      membersClient.bulk_reinvite.mockResolvedValue(allSent(ids));

      await firstValueFrom(service.bulkReinvite(mockOrganization, asUsers(ids)));

      expect(memberDialogManager.openBulkReinviteFailureDialog).not.toHaveBeenCalled();
      expect(memberDialogManager.openBulkProgressDialog).not.toHaveBeenCalled();
    });

    it("should open failure dialog when there are failures", async () => {
      const ids = memberIds(10);
      const users = asUsers(ids);
      membersClient.bulk_reinvite.mockResolvedValue(ids.map((id) => memberOutcome(id, "error")));

      const result = await firstValueFrom(service.bulkReinvite(mockOrganization, users));

      expect(memberDialogManager.openBulkReinviteFailureDialog).toHaveBeenCalledWith(
        mockOrganization,
        users,
        result,
      );
      expect(result.failed.length).toBeGreaterThan(0);
    });
  });

  describe("allowResetPassword", () => {
    const resetPasswordEnabled = true;

    it("should allow reset password for Owner over User", () => {
      const result = service.allowResetPassword(
        mockOrgUser,
        mockOrganization,
        resetPasswordEnabled,
      );

      expect(result).toBe(true);
    });

    it("should allow reset password for Admin over User", () => {
      const adminOrg = { ...mockOrganization, type: OrganizationUserType.Admin } as Organization;

      const result = service.allowResetPassword(mockOrgUser, adminOrg, resetPasswordEnabled);

      expect(result).toBe(true);
    });

    it("should not allow reset password for Admin over Owner", () => {
      const adminOrg = { ...mockOrganization, type: OrganizationUserType.Admin } as Organization;
      const ownerUser = {
        ...mockOrgUser,
        type: OrganizationUserType.Owner,
      } as OrganizationUserView;

      const result = service.allowResetPassword(ownerUser, adminOrg, resetPasswordEnabled);

      expect(result).toBe(false);
    });

    it("should allow reset password for Custom over User", () => {
      const customOrg = { ...mockOrganization, type: OrganizationUserType.Custom } as Organization;

      const result = service.allowResetPassword(mockOrgUser, customOrg, resetPasswordEnabled);

      expect(result).toBe(true);
    });

    it("should not allow reset password for Custom over Admin", () => {
      const customOrg = { ...mockOrganization, type: OrganizationUserType.Custom } as Organization;
      const adminUser = {
        ...mockOrgUser,
        type: OrganizationUserType.Admin,
      } as OrganizationUserView;

      const result = service.allowResetPassword(adminUser, customOrg, resetPasswordEnabled);

      expect(result).toBe(false);
    });

    it("should not allow reset password for Custom over Owner", () => {
      const customOrg = { ...mockOrganization, type: OrganizationUserType.Custom } as Organization;
      const ownerUser = {
        ...mockOrgUser,
        type: OrganizationUserType.Owner,
      } as OrganizationUserView;

      const result = service.allowResetPassword(ownerUser, customOrg, resetPasswordEnabled);

      expect(result).toBe(false);
    });

    it("should not allow reset password when organization cannot manage users password", () => {
      const org = { ...mockOrganization, canManageUsersPassword: false } as Organization;

      const result = service.allowResetPassword(mockOrgUser, org, resetPasswordEnabled);

      expect(result).toBe(false);
    });

    it("should not allow reset password when organization does not use reset password", () => {
      const org = { ...mockOrganization, useResetPassword: false } as Organization;

      const result = service.allowResetPassword(mockOrgUser, org, resetPasswordEnabled);

      expect(result).toBe(false);
    });

    it("should not allow reset password when user is not enrolled in reset password", () => {
      const user = { ...mockOrgUser, resetPasswordEnrolled: false } as OrganizationUserView;

      const result = service.allowResetPassword(user, mockOrganization, resetPasswordEnabled);

      expect(result).toBe(false);
    });

    it("should allow reset password when user status is revoked", () => {
      const user = {
        ...mockOrgUser,
        status: OrganizationUserStatusType.Revoked,
      } as OrganizationUserView;

      const result = service.allowResetPassword(user, mockOrganization, resetPasswordEnabled);

      expect(result).toBe(true);
    });

    it("should allow reset password when user status is accepted", () => {
      const user = {
        ...mockOrgUser,
        status: OrganizationUserStatusType.Accepted,
      } as OrganizationUserView;

      const result = service.allowResetPassword(user, mockOrganization, resetPasswordEnabled);

      expect(result).toBe(true);
    });

    it("should not allow reset password when user status is invited", () => {
      const user = {
        ...mockOrgUser,
        status: OrganizationUserStatusType.Invited,
      } as OrganizationUserView;

      const result = service.allowResetPassword(user, mockOrganization, resetPasswordEnabled);

      expect(result).toBe(false);
    });
  });

  describe("isProcessing signal", () => {
    it("should be false initially", () => {
      expect(service.isProcessing()).toBe(false);
    });

    it("should be false after operation completes successfully", async () => {
      organizationUserApiService.removeOrganizationUser.mockResolvedValue(undefined);

      await service.removeUser(mockOrganization, userIdToManage);

      expect(service.isProcessing()).toBe(false);
    });

    it("should be false after operation fails", async () => {
      organizationUserApiService.removeOrganizationUser.mockRejectedValue(new Error("Failed"));

      await service.removeUser(mockOrganization, userIdToManage);

      expect(service.isProcessing()).toBe(false);
    });
  });
});
