import { TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { of, throwError } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserBulkResponse,
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
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";

import { OrganizationUserView } from "../../../core/views/organization-user.view";
import { MemberDialogManagerService } from "../member-dialog-manager/member-dialog-manager.service";

import { REQUESTS_PER_BATCH, MemberActionsService } from "./member-actions.service";

describe("MemberActionsService", () => {
  let service: MemberActionsService;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let organizationUserService: MockProxy<OrganizationUserService>;
  let configService: MockProxy<ConfigService>;
  let organizationMetadataService: MockProxy<OrganizationMetadataServiceAbstraction>;
  let memberDialogManager: MockProxy<MemberDialogManagerService>;

  const organizationId = newGuid() as OrganizationId;
  const userIdToManage = newGuid();

  let mockOrganization: Organization;
  let mockOrgUser: OrganizationUserView;

  beforeEach(() => {
    organizationUserApiService = mock<OrganizationUserApiService>();
    organizationUserService = mock<OrganizationUserService>();
    configService = mock<ConfigService>();
    organizationMetadataService = mock<OrganizationMetadataServiceAbstraction>();
    memberDialogManager = mock<MemberDialogManagerService>();

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
        { provide: ConfigService, useValue: configService },
        {
          provide: OrganizationMetadataServiceAbstraction,
          useValue: organizationMetadataService,
        },
        { provide: ApiService, useValue: mock<ApiService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: OrganizationManagementPreferencesService,
          useValue: mock<OrganizationManagementPreferencesService>(),
        },
        { provide: UserNamePipe, useValue: mock<UserNamePipe>() },
        { provide: MemberDialogManagerService, useValue: memberDialogManager },
        { provide: I18nService, useValue: mock<I18nService>() },
      ],
    });

    service = TestBed.inject(MemberActionsService);
  });

  describe("inviteUser", () => {
    it("should successfully invite a user", async () => {
      organizationUserApiService.postOrganizationUserInvite.mockResolvedValue(undefined);

      const result = await service.inviteUser(
        mockOrganization,
        "test@example.com",
        OrganizationUserType.User,
        {},
        [],
        [],
      );

      expect(result).toEqual({ success: true });
      expect(organizationUserApiService.postOrganizationUserInvite).toHaveBeenCalledWith(
        organizationId,
        {
          emails: ["test@example.com"],
          type: OrganizationUserType.User,
          accessSecretsManager: false,
          collections: [],
          groups: [],
          permissions: {},
        },
      );
    });

    it("should handle invite errors", async () => {
      const errorMessage = "Invitation failed";
      organizationUserApiService.postOrganizationUserInvite.mockRejectedValue(
        new Error(errorMessage),
      );

      const result = await service.inviteUser(
        mockOrganization,
        "test@example.com",
        OrganizationUserType.User,
      );

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
    describe("when feature flag is enabled", () => {
      beforeEach(() => {
        configService.getFeatureFlag$.mockReturnValue(of(true));
      });

      it("should call organizationUserService.restoreUser", async () => {
        organizationUserService.restoreUser.mockReturnValue(of(undefined));

        const result = await service.restoreUser(mockOrganization, userIdToManage);

        expect(result).toEqual({ success: true });
        expect(organizationUserService.restoreUser).toHaveBeenCalledWith(
          mockOrganization,
          userIdToManage,
        );
        expect(organizationUserApiService.restoreOrganizationUser).not.toHaveBeenCalled();
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

    describe("when feature flag is disabled", () => {
      beforeEach(() => {
        configService.getFeatureFlag$.mockReturnValue(of(false));
      });

      it("should call organizationUserApiService.restoreOrganizationUser", async () => {
        organizationUserApiService.restoreOrganizationUser.mockResolvedValue(undefined);

        const result = await service.restoreUser(mockOrganization, userIdToManage);

        expect(result).toEqual({ success: true });
        expect(organizationUserApiService.restoreOrganizationUser).toHaveBeenCalledWith(
          organizationId,
          userIdToManage,
        );
        expect(organizationUserService.restoreUser).not.toHaveBeenCalled();
      });

      it("should handle errors", async () => {
        const errorMessage = "Restore failed";
        organizationUserApiService.restoreOrganizationUser.mockRejectedValue(
          new Error(errorMessage),
        );

        const result = await service.restoreUser(mockOrganization, userIdToManage);

        expect(result).toEqual({ success: false, error: errorMessage });
      });
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

  describe("reinviteUser", () => {
    it("should successfully reinvite a user", async () => {
      organizationUserApiService.postOrganizationUserReinvite.mockResolvedValue(undefined);

      const result = await service.reinviteUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: true });
      expect(organizationUserApiService.postOrganizationUserReinvite).toHaveBeenCalledWith(
        organizationId,
        userIdToManage,
      );
    });

    it("should handle reinvite errors", async () => {
      const errorMessage = "Reinvite failed";
      organizationUserApiService.postOrganizationUserReinvite.mockRejectedValue(
        new Error(errorMessage),
      );

      const result = await service.reinviteUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: false, error: errorMessage });
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
    beforeEach(() => {
      configService.getFeatureFlag$.mockReturnValue(of(false));
    });

    it("should process users in a single batch when count equals REQUESTS_PER_BATCH", async () => {
      const userIdsBatch = Array.from({ length: REQUESTS_PER_BATCH }, () => newGuid() as UserId);
      const users = userIdsBatch.map((id) => ({ id }) as OrganizationUserView);
      const mockResponse = new ListResponse(
        {
          data: userIdsBatch.map((id) => ({
            id,
            error: null,
          })),
          continuationToken: null,
        },
        OrganizationUserBulkResponse,
      );

      organizationUserApiService.postManyOrganizationUserReinvite.mockResolvedValue(mockResponse);

      const result = await service.bulkReinvite(mockOrganization, users);

      expect(result.successful).toBeDefined();
      expect(result.successful).toHaveLength(REQUESTS_PER_BATCH);
      expect(result.failed).toHaveLength(0);
      expect(organizationUserApiService.postManyOrganizationUserReinvite).toHaveBeenCalledTimes(1);
      expect(organizationUserApiService.postManyOrganizationUserReinvite).toHaveBeenCalledWith(
        organizationId,
        userIdsBatch,
      );
    });

    it("should process users in multiple batches when count exceeds REQUESTS_PER_BATCH", async () => {
      const totalUsers = REQUESTS_PER_BATCH + 100;
      const userIdsBatch = Array.from({ length: totalUsers }, () => newGuid() as UserId);
      const users = userIdsBatch.map((id) => ({ id }) as OrganizationUserView);

      const mockResponse1 = new ListResponse(
        {
          data: userIdsBatch.slice(0, REQUESTS_PER_BATCH).map((id) => ({
            id,
            error: null,
          })),
          continuationToken: null,
        },
        OrganizationUserBulkResponse,
      );

      const mockResponse2 = new ListResponse(
        {
          data: userIdsBatch.slice(REQUESTS_PER_BATCH).map((id) => ({
            id,
            error: null,
          })),
          continuationToken: null,
        },
        OrganizationUserBulkResponse,
      );

      organizationUserApiService.postManyOrganizationUserReinvite
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const result = await service.bulkReinvite(mockOrganization, users);

      expect(result.successful).toBeDefined();
      expect(result.successful).toHaveLength(totalUsers);
      expect(result.failed).toHaveLength(0);
      expect(organizationUserApiService.postManyOrganizationUserReinvite).toHaveBeenCalledTimes(2);
      expect(organizationUserApiService.postManyOrganizationUserReinvite).toHaveBeenNthCalledWith(
        1,
        organizationId,
        userIdsBatch.slice(0, REQUESTS_PER_BATCH),
      );
      expect(organizationUserApiService.postManyOrganizationUserReinvite).toHaveBeenNthCalledWith(
        2,
        organizationId,
        userIdsBatch.slice(REQUESTS_PER_BATCH),
      );
    });

    it("should aggregate results across multiple successful batches", async () => {
      const totalUsers = REQUESTS_PER_BATCH + 50;
      const userIdsBatch = Array.from({ length: totalUsers }, () => newGuid() as UserId);
      const users = userIdsBatch.map((id) => ({ id }) as OrganizationUserView);

      const mockResponse1 = new ListResponse(
        {
          data: userIdsBatch.slice(0, REQUESTS_PER_BATCH).map((id) => ({
            id,
            error: null,
          })),
          continuationToken: null,
        },
        OrganizationUserBulkResponse,
      );

      const mockResponse2 = new ListResponse(
        {
          data: userIdsBatch.slice(REQUESTS_PER_BATCH).map((id) => ({
            id,
            error: null,
          })),
          continuationToken: null,
        },
        OrganizationUserBulkResponse,
      );

      organizationUserApiService.postManyOrganizationUserReinvite
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const result = await service.bulkReinvite(mockOrganization, users);

      expect(result.successful).toBeDefined();
      expect(result.successful).toHaveLength(totalUsers);
      expect(result.successful!.slice(0, REQUESTS_PER_BATCH)).toEqual(mockResponse1.data);
      expect(result.successful!.slice(REQUESTS_PER_BATCH)).toEqual(mockResponse2.data);
      expect(result.failed).toHaveLength(0);
    });

    it("should handle mixed individual errors across multiple batches", async () => {
      const totalUsers = REQUESTS_PER_BATCH + 4;
      const userIdsBatch = Array.from({ length: totalUsers }, () => newGuid() as UserId);
      const users = userIdsBatch.map((id) => ({ id }) as OrganizationUserView);

      const mockResponse1 = new ListResponse(
        {
          data: userIdsBatch.slice(0, REQUESTS_PER_BATCH).map((id, index) => ({
            id,
            error: index % 10 === 0 ? "Rate limit exceeded" : null,
          })),
          continuationToken: null,
        },
        OrganizationUserBulkResponse,
      );

      const mockResponse2 = new ListResponse(
        {
          data: [
            { id: userIdsBatch[REQUESTS_PER_BATCH], error: null },
            { id: userIdsBatch[REQUESTS_PER_BATCH + 1], error: "Invalid email" },
            { id: userIdsBatch[REQUESTS_PER_BATCH + 2], error: null },
            { id: userIdsBatch[REQUESTS_PER_BATCH + 3], error: "User suspended" },
          ],
          continuationToken: null,
        },
        OrganizationUserBulkResponse,
      );

      organizationUserApiService.postManyOrganizationUserReinvite
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const result = await service.bulkReinvite(mockOrganization, users);

      // Count expected failures: every 10th index (0, 10, 20, ..., 490) in first batch + 2 explicit in second batch
      // Indices 0 to REQUESTS_PER_BATCH-1 where index % 10 === 0: that's floor((BATCH_SIZE-1)/10) + 1 values
      const expectedFailuresInBatch1 = Math.floor((REQUESTS_PER_BATCH - 1) / 10) + 1;
      const expectedFailuresInBatch2 = 2;
      const expectedTotalFailures = expectedFailuresInBatch1 + expectedFailuresInBatch2;
      const expectedSuccesses = totalUsers - expectedTotalFailures;

      expect(result.successful).toBeDefined();
      expect(result.successful).toHaveLength(expectedSuccesses);
      expect(result.failed).toHaveLength(expectedTotalFailures);
      expect(result.failed.some((f) => f.error === "Rate limit exceeded")).toBe(true);
      expect(result.failed.some((f) => f.error === "Invalid email")).toBe(true);
      expect(result.failed.some((f) => f.error === "User suspended")).toBe(true);
    });

    it("should aggregate all failures when all batches fail", async () => {
      const totalUsers = REQUESTS_PER_BATCH + 100;
      const userIdsBatch = Array.from({ length: totalUsers }, () => newGuid() as UserId);
      const users = userIdsBatch.map((id) => ({ id }) as OrganizationUserView);
      const errorMessage = "All batches failed";

      organizationUserApiService.postManyOrganizationUserReinvite.mockRejectedValue(
        new Error(errorMessage),
      );

      const result = await service.bulkReinvite(mockOrganization, users);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(totalUsers);
      expect(result.failed.every((f) => f.error === errorMessage)).toBe(true);
      expect(organizationUserApiService.postManyOrganizationUserReinvite).toHaveBeenCalledTimes(2);
    });

    it("should handle empty data in batch response", async () => {
      const totalUsers = REQUESTS_PER_BATCH + 50;
      const userIdsBatch = Array.from({ length: totalUsers }, () => newGuid() as UserId);
      const users = userIdsBatch.map((id) => ({ id }) as OrganizationUserView);

      const mockResponse1 = new ListResponse(
        {
          data: userIdsBatch.slice(0, REQUESTS_PER_BATCH).map((id) => ({
            id,
            error: null,
          })),
          continuationToken: null,
        },
        OrganizationUserBulkResponse,
      );

      const mockResponse2 = new ListResponse(
        {
          data: [],
          continuationToken: null,
        },
        OrganizationUserBulkResponse,
      );

      organizationUserApiService.postManyOrganizationUserReinvite
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const result = await service.bulkReinvite(mockOrganization, users);

      expect(result.successful).toBeDefined();
      expect(result.successful).toHaveLength(REQUESTS_PER_BATCH);
      expect(result.failed).toHaveLength(0);
    });

    it("should process batches sequentially in order", async () => {
      const totalUsers = REQUESTS_PER_BATCH * 2;
      const userIdsBatch = Array.from({ length: totalUsers }, () => newGuid() as UserId);
      const users = userIdsBatch.map((id) => ({ id }) as OrganizationUserView);
      const callOrder: number[] = [];

      organizationUserApiService.postManyOrganizationUserReinvite.mockImplementation(
        async (orgId, ids) => {
          const batchIndex = ids.includes(userIdsBatch[0]) ? 1 : 2;
          callOrder.push(batchIndex);

          return new ListResponse(
            {
              data: ids.map((id) => ({
                id,
                error: null,
              })),
              continuationToken: null,
            },
            OrganizationUserBulkResponse,
          );
        },
      );

      await service.bulkReinvite(mockOrganization, users);

      expect(callOrder).toEqual([1, 2]);
      expect(organizationUserApiService.postManyOrganizationUserReinvite).toHaveBeenCalledTimes(2);
    });

    describe("with BulkReinviteUI feature flag enabled", () => {
      let mockDialogService: MockProxy<DialogService>;
      let mockI18nService: MockProxy<I18nService>;

      beforeEach(() => {
        configService.getFeatureFlag$.mockReturnValue(of(true));
        mockDialogService = TestBed.inject(DialogService) as MockProxy<DialogService>;
        mockI18nService = TestBed.inject(I18nService) as MockProxy<I18nService>;
        mockI18nService.t.mockImplementation((key: string) => key);
      });

      it("should open progress dialog when user count exceeds REQUESTS_PER_BATCH", async () => {
        const totalUsers = REQUESTS_PER_BATCH + 100;
        const userIdsBatch = Array.from({ length: totalUsers }, () => newGuid() as UserId);
        const users = userIdsBatch.map((id) => ({ id }) as OrganizationUserView);

        mockDialogService.openSimpleDialog.mockResolvedValue(true);

        const mockDialogRef = { closed: of(undefined) };
        memberDialogManager.openBulkProgressDialog.mockReturnValue(mockDialogRef as any);

        const mockResponse1 = new ListResponse(
          {
            data: userIdsBatch.slice(0, REQUESTS_PER_BATCH).map((id) => ({
              id,
              error: null,
            })),
            continuationToken: null,
          },
          OrganizationUserBulkResponse,
        );

        const mockResponse2 = new ListResponse(
          {
            data: userIdsBatch.slice(REQUESTS_PER_BATCH).map((id) => ({
              id,
              error: null,
            })),
            continuationToken: null,
          },
          OrganizationUserBulkResponse,
        );

        organizationUserApiService.postManyOrganizationUserReinvite
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        await service.bulkReinvite(mockOrganization, users);

        expect(memberDialogManager.openBulkReinviteFailureDialog).not.toHaveBeenCalled();
        expect(memberDialogManager.openBulkProgressDialog).toHaveBeenCalledWith(
          expect.anything(),
          totalUsers,
        );
      });

      it("should not open progress dialog when user count is or below REQUESTS_PER_BATCH", async () => {
        const totalUsers = REQUESTS_PER_BATCH;
        const userIdsBatch = Array.from({ length: totalUsers }, () => newGuid() as UserId);
        const users = userIdsBatch.map((id) => ({ id }) as OrganizationUserView);

        const mockResponse = new ListResponse(
          {
            data: userIdsBatch.map((id) => ({
              id,
              error: null,
            })),
            continuationToken: null,
          },
          OrganizationUserBulkResponse,
        );

        organizationUserApiService.postManyOrganizationUserReinvite.mockResolvedValue(mockResponse);

        await service.bulkReinvite(mockOrganization, users);

        expect(memberDialogManager.openBulkReinviteFailureDialog).not.toHaveBeenCalled();
        expect(memberDialogManager.openBulkProgressDialog).not.toHaveBeenCalled();
      });

      it("should open failure dialog when there are failures", async () => {
        const totalUsers = 10;
        const userIdsBatch = Array.from({ length: totalUsers }, () => newGuid() as UserId);
        const users = userIdsBatch.map((id) => ({ id }) as OrganizationUserView);

        const mockResponse = new ListResponse(
          {
            data: userIdsBatch.map((id) => ({
              id,
              error: "error",
            })),
            continuationToken: null,
          },
          OrganizationUserBulkResponse,
        );

        organizationUserApiService.postManyOrganizationUserReinvite.mockResolvedValue(mockResponse);

        const result = await service.bulkReinvite(mockOrganization, users);

        expect(memberDialogManager.openBulkReinviteFailureDialog).toHaveBeenCalledWith(
          mockOrganization,
          users,
          result,
        );
        expect(result.failed.length).toBeGreaterThan(0);
      });

      it("should process batches when exceeding REQUESTS_PER_BATCH", async () => {
        const totalUsers = REQUESTS_PER_BATCH + 100;
        const userIdsBatch = Array.from({ length: totalUsers }, () => newGuid() as UserId);
        const users = userIdsBatch.map((id) => ({ id }) as OrganizationUserView);

        const mockDialogRef = { closed: of(undefined) };
        memberDialogManager.openBulkProgressDialog.mockReturnValue(mockDialogRef as any);

        const mockResponse1 = new ListResponse(
          {
            data: userIdsBatch.slice(0, REQUESTS_PER_BATCH).map((id) => ({
              id,
              error: null,
            })),
            continuationToken: null,
          },
          OrganizationUserBulkResponse,
        );

        const mockResponse2 = new ListResponse(
          {
            data: userIdsBatch.slice(REQUESTS_PER_BATCH).map((id) => ({
              id,
              error: null,
            })),
            continuationToken: null,
          },
          OrganizationUserBulkResponse,
        );

        organizationUserApiService.postManyOrganizationUserReinvite
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        await service.bulkReinvite(mockOrganization, users);

        expect(organizationUserApiService.postManyOrganizationUserReinvite).toHaveBeenCalledTimes(
          2,
        );
      });
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

    it("should not allow reset password when user status is not confirmed", () => {
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
