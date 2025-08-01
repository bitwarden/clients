import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import {
  OrganizationUserConfirmRequest,
  OrganizationUserBulkConfirmRequest,
  OrganizationUserApiService,
  OrganizationUserBulkResponse,
} from "@bitwarden/admin-console/common";
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

import { OrganizationUserView } from "../../../core/views/organization-user.view";

import { OrganizationUserService } from "./organization-user.service";

describe("OrganizationUserService", () => {
  let service: OrganizationUserService;
  let keyService: jest.Mocked<KeyService>;
  let encryptService: jest.Mocked<EncryptService>;
  let organizationUserApiService: jest.Mocked<OrganizationUserApiService>;
  let accountService: jest.Mocked<AccountService>;
  let i18nService: jest.Mocked<I18nService>;

  const mockOrganization = new Organization();
  mockOrganization.id = "org-123" as OrganizationId;

  const mockOrganizationUser = new OrganizationUserView();
  mockOrganizationUser.id = "user-123";

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
    } as any;

    accountService = {
      activeAccount$: of({ id: "user-123" }),
    } as any;

    i18nService = {
      t: jest.fn(),
    } as any;

    TestBed.configureTestingModule({
      providers: [
        OrganizationUserService,
        { provide: KeyService, useValue: keyService },
        { provide: EncryptService, useValue: encryptService },
        { provide: OrganizationUserApiService, useValue: organizationUserApiService },
        { provide: AccountService, useValue: accountService },
        { provide: I18nService, useValue: i18nService },
      ],
    });

    service = TestBed.inject(OrganizationUserService);
  });

  describe("confirmUser", () => {
    beforeEach(() => {
      setupCommonMocks();
      encryptService.encapsulateKeyUnsigned.mockResolvedValue(mockEncryptedKey);
      organizationUserApiService.postOrganizationUserConfirm.mockReturnValue(Promise.resolve());
    });

    it("should confirm a user successfully", (done) => {
      service.confirmUser(mockOrganization, mockOrganizationUser, mockPublicKey).subscribe({
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
            mockOrganizationUser.id,
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
});
