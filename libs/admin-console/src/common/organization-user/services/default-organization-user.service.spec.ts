import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import {
  OrganizationUserConfirmRequest,
  OrganizationUserBulkConfirmRequest,
  OrganizationUserApiService,
  OrganizationUserBulkResponse,
  OrganizationUserUpdateRequest,
} from "../..";

import { DefaultOrganizationUserService } from "./default-organization-user.service";

describe("DefaultOrganizationUserService", () => {
  let service: DefaultOrganizationUserService;
  let keyService: jest.Mocked<KeyService>;
  let encryptService: jest.Mocked<EncryptService>;
  let organizationUserApiService: jest.Mocked<OrganizationUserApiService>;
  let accountService: jest.Mocked<AccountService>;
  let i18nService: jest.Mocked<I18nService>;

  const mockOrganization = new Organization();
  mockOrganization.id = "org-123" as OrganizationId;

  const mockUserId = "user-123";
  const mockPublicKey = new Uint8Array(64) as CsprngArray;
  const mockRandomBytes = new Uint8Array(64) as CsprngArray;
  const mockOrgKey = new SymmetricCryptoKey(mockRandomBytes) as OrgKey;
  const mockEncryptedKey = { encryptedString: "encrypted-key" } as EncString;
  const mockEncryptedCollectionName = { encryptedString: "encrypted-collection-name" } as EncString;
  const mockDefaultCollectionName = "My Items";

  const setupCommonMocks = () => {
    keyService.orgKeys$.mockReturnValue(
      of({ [mockOrganization.id]: mockOrgKey } as Record<OrganizationId, OrgKey>),
    );
    encryptService.encryptString.mockResolvedValue(mockEncryptedCollectionName);
    i18nService.t.mockReturnValue(mockDefaultCollectionName);
  };

  beforeEach(() => {
    keyService = {
      orgKeys$: jest.fn(),
    } as any;

    encryptService = {
      encryptString: jest.fn(),
      encapsulateKeyUnsigned: jest.fn(),
    } as any;

    organizationUserApiService = {
      postOrganizationUserConfirm: jest.fn(),
      postOrganizationUserBulkConfirm: jest.fn(),
      restoreOrganizationUser: jest.fn(),
      restoreManyOrganizationUsers: jest.fn(),
      putOrganizationUser: jest.fn(),
    } as any;

    accountService = {
      activeAccount$: of({ id: "user-123" }),
    } as any;

    i18nService = {
      t: jest.fn(),
    } as any;

    TestBed.configureTestingModule({
      providers: [
        DefaultOrganizationUserService,
        { provide: KeyService, useValue: keyService },
        { provide: EncryptService, useValue: encryptService },
        { provide: OrganizationUserApiService, useValue: organizationUserApiService },
        { provide: AccountService, useValue: accountService },
        { provide: I18nService, useValue: i18nService },
      ],
    });

    service = new DefaultOrganizationUserService(
      keyService,
      encryptService,
      organizationUserApiService,
      accountService,
      i18nService,
    );
  });

  describe("confirmUser", () => {
    beforeEach(() => {
      setupCommonMocks();
      encryptService.encapsulateKeyUnsigned.mockResolvedValue(mockEncryptedKey);
      organizationUserApiService.postOrganizationUserConfirm.mockReturnValue(Promise.resolve());
    });

    it("should confirm a user successfully", (done) => {
      service.confirmUser(mockOrganization, mockUserId, mockPublicKey).subscribe({
        next: () => {
          expect(i18nService.t).toHaveBeenCalledWith("myItems");

          expect(encryptService.encryptString).toHaveBeenCalledWith(
            mockDefaultCollectionName,
            mockOrgKey,
          );
          expect(encryptService.encapsulateKeyUnsigned).toHaveBeenCalledWith(
            mockOrgKey,
            mockPublicKey,
          );

          expect(organizationUserApiService.postOrganizationUserConfirm).toHaveBeenCalledWith(
            mockOrganization.id,
            mockUserId,
            {
              key: mockEncryptedKey.encryptedString,
              defaultUserCollectionName: mockEncryptedCollectionName.encryptedString,
            } as OrganizationUserConfirmRequest,
          );

          done();
        },
        error: done,
      });
    });
  });

  describe("bulkConfirmUsers", () => {
    const mockUserIdsWithKeys = [
      { id: "user-1", key: "key-1" },
      { id: "user-2", key: "key-2" },
    ];

    const mockBulkResponse = {
      data: [
        { id: "user-1", error: null } as OrganizationUserBulkResponse,
        { id: "user-2", error: null } as OrganizationUserBulkResponse,
      ],
    } as ListResponse<OrganizationUserBulkResponse>;

    beforeEach(() => {
      setupCommonMocks();
      organizationUserApiService.postOrganizationUserBulkConfirm.mockReturnValue(
        Promise.resolve(mockBulkResponse),
      );
    });

    it("should bulk confirm users successfully", (done) => {
      service.bulkConfirmUsers(mockOrganization, mockUserIdsWithKeys).subscribe({
        next: (response) => {
          expect(i18nService.t).toHaveBeenCalledWith("myItems");

          expect(encryptService.encryptString).toHaveBeenCalledWith(
            mockDefaultCollectionName,
            mockOrgKey,
          );

          expect(organizationUserApiService.postOrganizationUserBulkConfirm).toHaveBeenCalledWith(
            mockOrganization.id,
            new OrganizationUserBulkConfirmRequest(
              mockUserIdsWithKeys,
              mockEncryptedCollectionName.encryptedString,
            ),
          );

          expect(response).toEqual(mockBulkResponse);

          done();
        },
        error: done,
      });
    });
  });

  describe("buildRestoreUserRequest", () => {
    beforeEach(() => {
      setupCommonMocks();
    });

    it("should build a restore request with encrypted collection name", (done) => {
      service.buildRestoreUserRequest(mockOrganization).subscribe({
        next: (request) => {
          expect(i18nService.t).toHaveBeenCalledWith("myItems");
          expect(encryptService.encryptString).toHaveBeenCalledWith(
            mockDefaultCollectionName,
            mockOrgKey,
          );
          expect(request).toEqual({
            defaultUserCollectionName: mockEncryptedCollectionName.encryptedString,
          });
          done();
        },
        error: done,
      });
    });
  });

  describe("restoreUser", () => {
    beforeEach(() => {
      setupCommonMocks();
      organizationUserApiService.restoreOrganizationUser.mockReturnValue(Promise.resolve());
    });

    it("should restore a user successfully", (done) => {
      service.restoreUser(mockOrganization, mockUserId).subscribe({
        next: () => {
          expect(i18nService.t).toHaveBeenCalledWith("myItems");
          expect(encryptService.encryptString).toHaveBeenCalledWith(
            mockDefaultCollectionName,
            mockOrgKey,
          );
          expect(organizationUserApiService.restoreOrganizationUser).toHaveBeenCalledWith(
            mockOrganization.id,
            mockUserId,
            {
              defaultUserCollectionName: mockEncryptedCollectionName.encryptedString,
            },
          );
          done();
        },
        error: done,
      });
    });
  });

  describe("bulkRestoreUsers", () => {
    const mockUserIds = ["user-1", "user-2"];

    const mockBulkResponse = {
      data: [
        { id: "user-1", error: null } as OrganizationUserBulkResponse,
        { id: "user-2", error: null } as OrganizationUserBulkResponse,
      ],
    } as ListResponse<OrganizationUserBulkResponse>;

    beforeEach(() => {
      setupCommonMocks();
      organizationUserApiService.restoreManyOrganizationUsers.mockReturnValue(
        Promise.resolve(mockBulkResponse),
      );
    });

    it("should bulk restore users successfully", (done) => {
      service.bulkRestoreUsers(mockOrganization, mockUserIds).subscribe({
        next: (response) => {
          expect(i18nService.t).toHaveBeenCalledWith("myItems");
          expect(encryptService.encryptString).toHaveBeenCalledWith(
            mockDefaultCollectionName,
            mockOrgKey,
          );
          expect(organizationUserApiService.restoreManyOrganizationUsers).toHaveBeenCalledWith(
            mockOrganization.id,
            expect.objectContaining({
              ids: mockUserIds,
              defaultUserCollectionName: mockEncryptedCollectionName.encryptedString,
            }),
          );
          expect(response).toEqual(mockBulkResponse);
          done();
        },
        error: done,
      });
    });
  });

  describe("updateUser", () => {
    const mockPermissions = new PermissionsApi();

    beforeEach(() => {
      organizationUserApiService.putOrganizationUser.mockReturnValue(Promise.resolve());
    });

    it.each([OrganizationUserType.Owner, OrganizationUserType.Admin])(
      "should call putOrganizationUser without encrypting a collection name for exempt type %s",
      (userType, done: jest.DoneCallback) => {
        const request = new OrganizationUserUpdateRequest({
          type: userType,
          permissions: mockPermissions,
        });

        const org = new Organization();
        org.id = mockOrganization.id;
        org.useMyItems = true;
        org.usePolicies = true;

        service.updateUser(org, mockUserId, request).subscribe({
          next: () => {
            expect(encryptService.encryptString).not.toHaveBeenCalled();
            expect(request.defaultUserCollectionName).toBeUndefined();
            expect(organizationUserApiService.putOrganizationUser).toHaveBeenCalledWith(
              org.id,
              mockUserId,
              request,
            );
            done();
          },
          error: done,
        });
      },
    );

    it.each([OrganizationUserType.User, OrganizationUserType.Custom])(
      "should encrypt the default collection name and include it in the request for non-exempt type %s when useMyItems and usePolicies are enabled",
      (userType, done: jest.DoneCallback) => {
        setupCommonMocks();
        const request = new OrganizationUserUpdateRequest({
          type: userType,
          permissions: mockPermissions,
        });

        const org = new Organization();
        org.id = mockOrganization.id;
        org.useMyItems = true;
        org.usePolicies = true;

        service.updateUser(org, mockUserId, request).subscribe({
          next: () => {
            expect(i18nService.t).toHaveBeenCalledWith("myItems");
            expect(encryptService.encryptString).toHaveBeenCalledWith(
              mockDefaultCollectionName,
              mockOrgKey,
            );
            expect(request.defaultUserCollectionName).toBe(
              mockEncryptedCollectionName.encryptedString,
            );
            expect(organizationUserApiService.putOrganizationUser).toHaveBeenCalledWith(
              org.id,
              mockUserId,
              request,
            );
            done();
          },
          error: done,
        });
      },
    );

    it.each([OrganizationUserType.User, OrganizationUserType.Custom])(
      "should not encrypt the default collection name for non-exempt type %s when useMyItems or usePolicies is disabled",
      (userType, done: jest.DoneCallback) => {
        const request = new OrganizationUserUpdateRequest({
          type: userType,
          permissions: mockPermissions,
        });

        const org = new Organization();
        org.id = mockOrganization.id;
        org.useMyItems = false;
        org.usePolicies = true;

        service.updateUser(org, mockUserId, request).subscribe({
          next: () => {
            expect(encryptService.encryptString).not.toHaveBeenCalled();
            expect(request.defaultUserCollectionName).toBeUndefined();
            expect(organizationUserApiService.putOrganizationUser).toHaveBeenCalledWith(
              org.id,
              mockUserId,
              request,
            );
            done();
          },
          error: done,
        });
      },
    );
  });
});
