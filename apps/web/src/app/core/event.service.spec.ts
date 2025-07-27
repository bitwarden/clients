import { mock } from "jest-mock-extended";

import {
  CollectionService,
  CollectionView,
  OrganizationUserApiService,
  OrganizationUserUserMiniResponse,
} from "@bitwarden/admin-console/common";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventType } from "@bitwarden/common/enums/event-type.enum";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { EventService } from "./event.service";

describe("EventService", () => {
  let eventService: EventService;
  let mocki18nService = mock<I18nService>();
  let mockPolicyService = mock<PolicyService>();
  let mockAccountService: AccountService;
  let mockCipherService = mock<CipherService>();
  let mockOrgUserApiService = mock<OrganizationUserApiService>();
  let mockCollectionService = mock<CollectionService>();

  const userId = Utils.newGuid() as UserId;
  const orgId = Utils.newGuid() as OrganizationId;
  const collectionId = Utils.newGuid() as string;

  const orgUserMiniResponse: ListResponse<OrganizationUserUserMiniResponse> = {
    continuationToken: null,
    data: [
      {
        id: userId,
        name: "Test User",
        email: "testuser@example.com",
      } as unknown as OrganizationUserUserMiniResponse,
    ],
  } as ListResponse<OrganizationUserUserMiniResponse>;

  const collectionViews = [
    {
      id: collectionId,
      name: "Test Collection",
    } as CollectionView,
  ];

  const baseEvent = {
    type: EventType.Cipher_Created,
    cipherId: "abcdef1234567890",
    organizationId: "orgid1234567890" as OrganizationId,
    organizationUserId: userId,
    userId: userId,
    collectionId: collectionId,
    deviceType: 0, // Android
  } as any;

  beforeEach(async () => {
    mocki18nService = mock<I18nService>();
    mockPolicyService = mock<PolicyService>();
    mockAccountService = mockAccountServiceWith(userId);
    mockCipherService = mock<CipherService>();
    mockOrgUserApiService = mock<OrganizationUserApiService>();
    mockCollectionService = mock<CollectionService>();
    eventService = new EventService(
      mocki18nService,
      mockPolicyService,
      mockAccountService,
      mockCipherService,
      mockOrgUserApiService,
      mockCollectionService,
    );

    // reset mocks
    jest.clearAllMocks();

    // Default mock for i18nService.t
    mocki18nService.t.mockImplementation((key: string, value?: string) => {
      if (value) {
        return `${key}:${value}`;
      }
      return key;
    });

    mockCipherService.getAllDecrypted.mockResolvedValue([
      { id: "abcdef1234567890", name: "Test Cipher" } as CipherView,
    ]);
    mockOrgUserApiService.getAllMiniUserDetails.mockResolvedValue(orgUserMiniResponse);
    mockCollectionService.getAllDecrypted.mockResolvedValue(collectionViews);

    // this method will use the mocks defined above
    await eventService.loadAllOrganizationInfo(orgId, userId);
  });

  it("should return correct app info for deviceType Android", async () => {
    const event = { ...baseEvent, type: 0, deviceType: 1 }; // DeviceType.Android
    mocki18nService.t.mockImplementation((key: string) => {
      if (key === "mobile") {
        return "Mobile";
      }
      if (key === "unknown") {
        return "Unknown";
      }
      return key;
    });
    const info = await eventService.getEventInfo(event);

    expect(info.appIcon).toBe("bwi-mobile");
    expect(info.appName).toContain("Mobile");
  });

  it("should return correct app info for serviceAccountId", async () => {
    const event = { ...baseEvent, type: 0, serviceAccountId: "svc123" };
    mocki18nService.t.mockImplementation((key: string) => {
      if (key === "sdk") {
        return "SDK";
      }
      return key;
    });
    const info = await eventService.getEventInfo(event);

    expect(info.appIcon).toBe("bwi-globe");
    expect(info.appName).toBe("SDK");
  });

  describe("formatDateFilters", () => {
    it("should format valid date filters to ISO strings", () => {
      const start = "2024-05-01T00:00";
      const end = "2024-05-31T23:59";

      const [isoStart, isoEnd] = eventService.formatDateFilters(start, end);

      expect(isoStart).toBe(new Date(start).toISOString());
      const expectedEnd = new Date("2024-05-31T23:59:59.999").toISOString();
      expect(isoEnd).toBe(expectedEnd);
    });

    it("should throw if start date is invalid", () => {
      expect(() => eventService.formatDateFilters("invalid-date", "2024-05-31T23:59")).toThrow(
        "Invalid date range.",
      );
    });

    it("should throw if end date is invalid", () => {
      expect(() => eventService.formatDateFilters("2024-05-01T00:00", "invalid-date")).toThrow(
        "Invalid date range.",
      );
    });

    it("should throw if end date is before start date", () => {
      expect(() => eventService.formatDateFilters("2024-05-31T23:59", "2024-05-01T00:00")).toThrow(
        "Invalid date range.",
      );
    });

    it("should handle edge case where start and end are the same", () => {
      const date = "2024-05-15T12:34";
      const [isoStart, isoEnd] = eventService.formatDateFilters(date, date);
      expect(isoStart).toBe(new Date(date).toISOString());
      expect(isoEnd).toBe(new Date(date + ":59.999").toISOString());
    });
  });

  describe("getEventInfo for Ciphers", () => {
    const testCases = [
      { type: EventType.Cipher_Created, eventName: "createdItemId" },
      { type: EventType.Cipher_Updated, eventName: "editedItemId" },
      { type: EventType.Cipher_Deleted, eventName: "permanentlyDeletedItemId" },
      { type: EventType.Cipher_AttachmentCreated, eventName: "createdAttachmentForItem" },
      { type: EventType.Cipher_AttachmentDeleted, eventName: "deletedAttachmentForItem" },
      { type: EventType.Cipher_SoftDeleted, eventName: "deletedItemId" },
      { type: EventType.Cipher_Restored, eventName: "restoredItemId" },
      { type: EventType.Cipher_AttachmentCreated, eventName: "createdAttachmentForItem" },
      { type: EventType.Cipher_AttachmentDeleted, eventName: "deletedAttachmentForItem" },
      { type: EventType.Cipher_Shared, eventName: "movedItemIdToOrg" },
      { type: EventType.Cipher_ClientViewed, eventName: "viewedItemId" },
      { type: EventType.Cipher_UpdatedCollections, eventName: "editedCollectionsForItem" },
      { type: EventType.Cipher_ClientToggledPasswordVisible, eventName: "viewedPasswordItemId" },
      {
        type: EventType.Cipher_ClientToggledHiddenFieldVisible,
        eventName: "viewedHiddenFieldItemId",
      },
      {
        type: EventType.Cipher_ClientToggledCardCodeVisible,
        eventName: "viewedSecurityCodeItemId",
      },
      { type: EventType.Cipher_ClientCopiedPassword, eventName: "copiedPasswordItemId" },
      { type: EventType.Cipher_ClientCopiedHiddenField, eventName: "copiedHiddenFieldItemId" },
      { type: EventType.Cipher_ClientCopiedCardCode, eventName: "copiedSecurityCodeItemId" },
      { type: EventType.Cipher_ClientAutofilled, eventName: "autofilledItemId" },
      {
        type: EventType.Cipher_ClientToggledCardNumberVisible,
        eventName: "viewedCardNumberItemId",
      },
    ];

    testCases.forEach(({ type, eventName }) => {
      it(`should return correct info for event type ${type}`, async () => {
        const event = { ...baseEvent, type };

        const info = await eventService.getEventInfo(event);

        expect(info.message).toContain("Test Cipher");
        expect(info.humanReadableMessage).toContain(eventName);
        expect(info.appIcon).toBe("bwi-mobile");
        expect(info.appName).toBe("mobile - Android");
        expect(info.eventName).toBe(eventName);
        expect(info.eventLink).toContain("<code>Test Cipher</code>");
      });
    });
  });

  describe("getEventInfo for Organization Users", () => {
    const testCases = [
      { type: EventType.OrganizationUser_Invited, eventName: "invitedUserId" },
      { type: EventType.OrganizationUser_Confirmed, eventName: "confirmedUserId" },
      { type: EventType.OrganizationUser_Updated, eventName: "editedUserId" },
      { type: EventType.OrganizationUser_Removed, eventName: "removedUserId" },
      { type: EventType.OrganizationUser_UpdatedGroups, eventName: "editedGroupsForUser" },
      { type: EventType.OrganizationUser_UnlinkedSso, eventName: "unlinkedSsoUser" },
      {
        type: EventType.OrganizationUser_ResetPassword_Enroll,
        eventName: "eventEnrollAccountRecovery",
      },
      {
        type: EventType.OrganizationUser_ResetPassword_Withdraw,
        eventName: "eventWithdrawAccountRecovery",
      },
      { type: EventType.OrganizationUser_AdminResetPassword, eventName: "eventAdminPasswordReset" },
      { type: EventType.OrganizationUser_ResetSsoLink, eventName: "eventResetSsoLink" },
      { type: EventType.OrganizationUser_FirstSsoLogin, eventName: "firstSsoLogin" },
      { type: EventType.OrganizationUser_Revoked, eventName: "revokedUserId" },
      { type: EventType.OrganizationUser_Restored, eventName: "restoredUserId" },
      { type: EventType.OrganizationUser_ApprovedAuthRequest, eventName: "approvedAuthRequest" },
      { type: EventType.OrganizationUser_RejectedAuthRequest, eventName: "rejectedAuthRequest" },
      { type: EventType.OrganizationUser_Deleted, eventName: "deletedUserId" },
      { type: EventType.OrganizationUser_Left, eventName: "userLeftOrganization" },
    ];

    testCases.forEach(({ type, eventName }) => {
      it(`should return correct info for user event type ${type}`, async () => {
        const event = { ...baseEvent, type };

        const info = await eventService.getEventInfo(event);

        expect(info.message).toContain("Test User");
        expect(info.humanReadableMessage).toContain(eventName);
        expect(info.appIcon).toBe("bwi-mobile");
        expect(info.appName).toBe("mobile - Android");
        expect(info.eventName).toBe(eventName);
        expect(info.eventLink).toContain("<code>Test User</code>");
      });
    });
  });

  describe("getEventInfo for Collections", () => {
    const testCases = [
      { type: EventType.Collection_Created, eventName: "createdCollectionId" },
      { type: EventType.Collection_Updated, eventName: "editedCollectionId" },
      { type: EventType.Collection_Deleted, eventName: "deletedCollectionId" },
    ];

    testCases.forEach(({ type, eventName }) => {
      it(`should return correct info for collection event type ${type}`, async () => {
        const event = { ...baseEvent, type };

        const info = await eventService.getEventInfo(event);

        expect(info.message).toContain("Test Collection");
        expect(info.humanReadableMessage).toContain(eventName);
        expect(info.appIcon).toBe("bwi-mobile");
        expect(info.appName).toBe("mobile - Android");
        expect(info.eventName).toBe(eventName);
        expect(info.eventLink).toContain("<code>Test Collection</code>");
      });
    });
  });
});
