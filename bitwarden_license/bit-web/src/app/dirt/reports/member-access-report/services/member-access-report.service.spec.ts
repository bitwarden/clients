import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";

import { MemberAccessReportApiService } from "./member-access-report-api.service";
import {
  memberAccessReportsMock,
  memberAccessWithoutAccessDetailsReportsMock,
} from "./member-access-report.mock";
import { MemberAccessReportService } from "./member-access-report.service";

describe("ImportService", () => {
  const mockOrganizationId = "mockOrgId" as OrganizationId;
  const reportApiService = mock<MemberAccessReportApiService>();
  const mockEncryptService = mock<EncryptService>();
  const userId = newGuid() as UserId;
  const mockAccountService = mockAccountServiceWith(userId);
  const mockKeyService = mock<KeyService>();
  let memberAccessReportService: MemberAccessReportService;
  const i18nMock = mock<I18nService>({
    t(key) {
      return key;
    },
  });

  beforeEach(() => {
    mockKeyService.orgKeys$.mockReturnValue(
      of({ mockOrgId: new SymmetricCryptoKey(new Uint8Array(64)) }),
    );
    reportApiService.getMemberAccessData.mockImplementation(() =>
      Promise.resolve(memberAccessReportsMock),
    );
    memberAccessReportService = new MemberAccessReportService(
      reportApiService,
      i18nMock,
      mockEncryptService,
      mockKeyService,
      mockAccountService,
    );
  });

  describe("generateMemberAccessReportView", () => {
    it("should generate member access report view", async () => {
      const result =
        await memberAccessReportService.generateMemberAccessReportView(mockOrganizationId);

      expect(result).toEqual([
        {
          name: "Sarah Johnson",
          email: "sjohnson@email.com",
          collectionsCount: 3,
          groupsCount: 1,
          itemsCount: 0,
          userGuid: expect.any(String),
          usesKeyConnector: expect.any(Boolean),
        },
        {
          name: "James Lull",
          email: "jlull@email.com",
          collectionsCount: 2,
          groupsCount: 1,
          itemsCount: 0,
          userGuid: expect.any(String),
          usesKeyConnector: expect.any(Boolean),
        },
        {
          name: "Beth Williams",
          email: "bwilliams@email.com",
          collectionsCount: 2,
          groupsCount: 1,
          itemsCount: 0,
          userGuid: expect.any(String),
          usesKeyConnector: expect.any(Boolean),
        },
        {
          name: "Ray Williams",
          email: "rwilliams@email.com",
          collectionsCount: 3,
          groupsCount: 3,
          itemsCount: 0,
          userGuid: expect.any(String),
          usesKeyConnector: expect.any(Boolean),
        },
      ]);
    });
  });

  describe("generateUserReportExportItems", () => {
    it("should generate user report export items", async () => {
      const result =
        await memberAccessReportService.generateUserReportExportItems(mockOrganizationId);

      const filteredReportItems = result
        .filter(
          (item) =>
            (item.name === "Sarah Johnson" &&
              item.group === "Group 1" &&
              item.totalItems === "0") ||
            (item.name === "James Lull" && item.group === "Group 4" && item.totalItems === "0"),
        )
        .map((item) => ({
          name: item.name,
          email: item.email,
          group: item.group,
          totalItems: item.totalItems,
          accountRecovery: item.accountRecovery,
          twoStepLogin: item.twoStepLogin,
        }));

      expect(filteredReportItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            email: "sjohnson@email.com",
            name: "Sarah Johnson",
            twoStepLogin: "memberAccessReportTwoFactorEnabledTrue",
            accountRecovery: "memberAccessReportAuthenticationEnabledTrue",
            group: "Group 1",
            totalItems: "0",
          }),
          expect.objectContaining({
            email: "jlull@email.com",
            name: "James Lull",
            twoStepLogin: "memberAccessReportTwoFactorEnabledFalse",
            accountRecovery: "memberAccessReportAuthenticationEnabledFalse",
            group: "Group 4",
            totalItems: "0",
          }),
        ]),
      );
    });

    it("should generate user report export items and include users with no access", async () => {
      reportApiService.getMemberAccessData.mockImplementation(() =>
        Promise.resolve(memberAccessWithoutAccessDetailsReportsMock),
      );
      const result =
        await memberAccessReportService.generateUserReportExportItems(mockOrganizationId);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            email: "asmith@email.com",
            name: "Alice Smith",
            twoStepLogin: "memberAccessReportTwoFactorEnabledTrue",
            accountRecovery: "memberAccessReportAuthenticationEnabledTrue",
            group: "Alice Group 1",
            totalItems: "0",
          }),
          expect.objectContaining({
            email: "rbrown@email.com",
            name: "Robert Brown",
            twoStepLogin: "memberAccessReportTwoFactorEnabledFalse",
            accountRecovery: "memberAccessReportAuthenticationEnabledFalse",
            group: "memberAccessReportNoGroup",
            totalItems: "0",
          }),
        ]),
      );
    });

    it("should handle decryption errors by setting collection name to null", async () => {
      const mockReportWithDecryptionError = [
        {
          userName: "Test User",
          email: "test@email.com",
          twoFactorEnabled: false,
          accountRecoveryEnabled: false,
          userGuid: "test-guid",
          usesKeyConnector: false,
          groupId: "g1",
          collectionId: "c1",
          groupName: "Test Group",
          collectionName: {
            encryptedString: "encrypted-collection-name",
          },
          itemCount: 5,
          readOnly: false,
          hidePasswords: false,
          manage: false,
          cipherIds: [] as string[],
        },
      ];

      reportApiService.getMemberAccessData.mockImplementation(() =>
        Promise.resolve(mockReportWithDecryptionError as any),
      );

      // Mock the EncString decrypt behavior to set decryptedValue to the error message
      jest.spyOn(EncString.prototype, "decrypt").mockImplementation(async function () {
        this.decryptedValue = "[error: cannot decrypt]";
        return undefined;
      });

      const result =
        await memberAccessReportService.generateUserReportExportItems(mockOrganizationId);

      expect(result[0].collection).toBe("memberAccessReportNoCollection");
    });
  });
});
