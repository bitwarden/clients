import { mock } from "jest-mock-extended";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventType } from "@bitwarden/common/enums/event-type.enum";
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
  const userId = Utils.newGuid() as UserId;
  const orgId = Utils.newGuid() as OrganizationId;

  beforeEach(() => {
    mocki18nService = mock<I18nService>();
    mockPolicyService = mock<PolicyService>();
    mockAccountService = mockAccountServiceWith(userId);
    mockCipherService = mock<CipherService>();
    eventService = new EventService(
      mocki18nService,
      mockPolicyService,
      mockAccountService,
      mockCipherService,
    );
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
    const baseEvent = {
      type: EventType.Cipher_Created,
      cipherId: "abcdef1234567890",
      organizationId: "orgid1234567890" as OrganizationId,
      deviceType: 0,
    } as any;

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

    beforeEach(async () => {
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
      await eventService.loadAllOrganizationCiphers(orgId, userId);
    });

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

    it("should return correct info for Cipher_Created event", async () => {
      const event = { ...baseEvent, type: EventType.Cipher_Created };

      const info = await eventService.getEventInfo(event);

      expect(info.message).toContain("Test Cipher");
      expect(info.humanReadableMessage).toContain("createdItemId:abcdef12");
      expect(info.appIcon).toBe("bwi-mobile");
      expect(info.appName).toBe("mobile - Android");
      expect(info.eventName).toBe("createdItemId");
      expect(info.eventLink).toContain("<code>Test Cipher</code>");
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
  });
});
