import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventResponse, EventType } from "@bitwarden/common/dirt/event-logs";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { EventOptions, EventService } from "./event.service";

describe("EventService Send events", () => {
  let sut: EventService;

  // Echoes the key and appends each substitution arg, so assertions can detect whether an interactive
  // anchor (with its sentinel href) made it into the message vs. the plain human-readable copy.
  const i18n = mock<I18nService>();
  i18n.t.mockImplementation(
    (id: string, p1?: string, p2?: string) => `${id}${p1 ?? ""}${p2 ?? ""}`,
  );

  beforeEach(() => {
    const policyService = mock<PolicyService>();
    policyService.policies$.mockReturnValue(of([]));
    const accountService = mock<AccountService>();
    (accountService as any).activeAccount$ = of({ id: "user-id" });
    const configService = mock<ConfigService>();
    configService.getFeatureFlag.mockResolvedValue(false);

    sut = new EventService(i18n, policyService, accountService, configService);
  });

  const sendId = "send-1234-5678";
  const creatorId = "creator-9012-3456";

  function accessEvent(type: EventType): EventResponse {
    return { type, sendId, userId: creatorId, organizationId: "org" } as EventResponse;
  }

  it("renders a Send access message with clickable Send-id and creator links (sentinel hrefs)", async () => {
    const info = await sut.getEventInfo(accessEvent(EventType.Send_Accessed_Text));

    expect(info.message).toContain(`href="#send-events:${sendId}"`);
    expect(info.message).toContain(`href="#member-events:${creatorId}"`);
  });

  it("keeps the human-readable (export) message plain text", async () => {
    const info = await sut.getEventInfo(accessEvent(EventType.Send_Accessed_File));

    expect(info.humanReadableMessage).not.toContain("href");
    expect(info.humanReadableMessage).not.toContain("<a");
    expect(info.humanReadableMessage).toContain(sendId.substring(0, 8));
  });

  it("omits the Send id when hideSendId is set (Send-scoped dialog) but keeps the creator", async () => {
    const options = new EventOptions();
    options.hideSendId = true;

    const info = await sut.getEventInfo(accessEvent(EventType.Send_Accessed_Text), options);

    expect(info.message).not.toContain("#send-events:");
    expect(info.message).toContain(`href="#member-events:${creatorId}"`);
  });

  it("renders the creator id as plain text (no link) when the creator is not a linkable member", async () => {
    const options = new EventOptions();
    options.linkableMemberIds = new Set<string>(); // creator absent => not linkable

    const info = await sut.getEventInfo(accessEvent(EventType.Send_Accessed_Text), options);

    expect(info.message).toContain(`href="#send-events:${sendId}"`);
    expect(info.message).not.toContain("#member-events:");
    expect(info.message).toContain(creatorId.substring(0, 8));
  });

  it("keeps the creator id linked when the creator is a linkable member", async () => {
    const options = new EventOptions();
    options.linkableMemberIds = new Set<string>([creatorId]);

    const info = await sut.getEventInfo(accessEvent(EventType.Send_Accessed_File), options);

    expect(info.message).toContain(`href="#member-events:${creatorId}"`);
  });

  it("renders the Send id on a create event", async () => {
    const info = await sut.getEventInfo({
      type: EventType.Send_Created_Text,
      sendId,
      organizationId: "org",
    } as EventResponse);

    expect(info.message).toContain(`href="#send-events:${sendId}"`);
    expect(info.humanReadableMessage).not.toContain("href");
    expect(info.humanReadableMessage).toContain(sendId.substring(0, 8));
  });
});

describe("EventService collection/shared folder terminology (vfo1-foundation)", () => {
  const i18n = mock<I18nService>();
  i18n.t.mockImplementation((id: string, p1?: string) => `${id}${p1 ?? ""}`);

  function createSut(vfo1Enabled: boolean): EventService {
    const policyService = mock<PolicyService>();
    policyService.policies$.mockReturnValue(of([]));
    const accountService = mock<AccountService>();
    (accountService as any).activeAccount$ = of({ id: "user-id" });
    const configService = mock<ConfigService>();
    configService.getFeatureFlag.mockResolvedValue(vfo1Enabled);

    return new EventService(i18n, policyService, accountService, configService);
  }

  const cases: [EventType, string, string, Partial<EventResponse>][] = [
    [
      EventType.Collection_Created,
      "createdCollectionId",
      "createdSharedFolderId",
      { collectionId: "collection-1", organizationId: "org" },
    ],
    [
      EventType.Collection_Updated,
      "editedCollectionId",
      "editedSharedFolderId",
      { collectionId: "collection-1", organizationId: "org" },
    ],
    [
      EventType.Collection_Deleted,
      "deletedCollectionId",
      "deletedSharedFolderId",
      { collectionId: "collection-1", organizationId: "org" },
    ],
    [
      EventType.Cipher_UpdatedCollections,
      "editedCollectionsForItem",
      "editedSharedFoldersForItem",
      { cipherId: "cipher-1" },
    ],
    [
      EventType.Organization_CollectionManagementUpdated,
      "modifiedCollectionManagement",
      "modifiedSharedFolderManagement",
      { organizationId: "org" },
    ],
    [
      EventType.Organization_CollectionManagement_LimitCollectionCreationEnabled,
      "limitCollectionCreationEnabled",
      "limitSharedFolderCreationEnabled",
      { organizationId: "org" },
    ],
    [
      EventType.Organization_CollectionManagement_LimitCollectionCreationDisabled,
      "limitCollectionCreationDisabled",
      "limitSharedFolderCreationDisabled",
      { organizationId: "org" },
    ],
    [
      EventType.Organization_CollectionManagement_LimitCollectionDeletionEnabled,
      "limitCollectionDeletionEnabled",
      "limitSharedFolderDeletionEnabled",
      { organizationId: "org" },
    ],
    [
      EventType.Organization_CollectionManagement_LimitCollectionDeletionDisabled,
      "limitCollectionDeletionDisabled",
      "limitSharedFolderDeletionDisabled",
      { organizationId: "org" },
    ],
    [
      EventType.Organization_CollectionManagement_AllowAdminAccessToAllCollectionItemsEnabled,
      "allowAdminAccessToAllCollectionItemsEnabled",
      "allowAdminAccessToAllSharedFolderItemsEnabled",
      { organizationId: "org" },
    ],
    [
      EventType.Organization_CollectionManagement_AllowAdminAccessToAllCollectionItemsDisabled,
      "allowAdminAccessToAllCollectionItemsDisabled",
      "allowAdminAccessToAllSharedFolderItemsDisabled",
      { organizationId: "org" },
    ],
  ];

  it.each(cases)(
    "uses the legacy 'collection' key for %s when vfo1-foundation is off",
    async (type, legacyKey, _nextKey, evFields) => {
      const sut = createSut(false);

      const info = await sut.getEventInfo({ type, ...evFields } as EventResponse);

      expect(info.humanReadableMessage).toContain(legacyKey);
    },
  );

  it.each(cases)(
    "uses the 'shared folder' key for %s when vfo1-foundation is on",
    async (type, _legacyKey, nextKey, evFields) => {
      const sut = createSut(true);

      const info = await sut.getEventInfo({ type, ...evFields } as EventResponse);

      expect(info.humanReadableMessage).toContain(nextKey);
    },
  );
});

describe("EventService organization name personalization (vfo1-foundation)", () => {
  const i18n = mock<I18nService>();
  i18n.t.mockImplementation(
    (id: string, p1?: string, p2?: string) => `${id}|${p1 ?? ""}|${p2 ?? ""}`,
  );

  function createSut(vfo1Enabled: boolean): EventService {
    const policyService = mock<PolicyService>();
    policyService.policies$.mockReturnValue(of([]));
    const accountService = mock<AccountService>();
    (accountService as any).activeAccount$ = of({ id: "user-id" });
    const configService = mock<ConfigService>();
    configService.getFeatureFlag.mockResolvedValue(vfo1Enabled);

    return new EventService(i18n, policyService, accountService, configService);
  }

  const orgName = "Acme Inc";

  // [EventType, legacyKey, nextKey, event response fields]
  const cases: [EventType, string, string, Partial<EventResponse>][] = [
    [
      EventType.Cipher_Shared,
      "movedItemIdToOrg",
      "movedItemIdToOrgWithName",
      { cipherId: "cipher-1", organizationId: "org" },
    ],
    [
      EventType.OrganizationUser_Revoked,
      "revokedUserId",
      "revokedUserIdWithOrgName",
      { organizationUserId: "ou-1", organizationId: "org" },
    ],
    [
      EventType.OrganizationUser_Restored,
      "restoredUserId",
      "restoredUserIdWithOrgName",
      { organizationUserId: "ou-1", organizationId: "org" },
    ],
    [
      EventType.OrganizationUser_Left,
      "userLeftOrganization",
      "userLeftOrganizationWithName",
      { organizationUserId: "ou-1", organizationId: "org" },
    ],
    [
      EventType.OrganizationUser_SelfRevoked,
      "userSelfRevokedOrganizationOwnership",
      "userSelfRevokedOrganizationOwnershipWithName",
      { organizationId: "org" },
    ],
    [
      EventType.OrganizationUser_Revoked_TwoFactorNonCompliance,
      "revokedUserIdTwoFactorNonCompliance",
      "revokedUserIdTwoFactorNonComplianceWithOrgName",
      { organizationUserId: "ou-1", organizationId: "org" },
    ],
    [
      EventType.OrganizationUser_Revoked_SingleOrganizationNonCompliance,
      "revokedUserIdSingleOrganizationNonCompliance",
      "revokedUserIdSingleOrganizationNonComplianceWithOrgName",
      { organizationUserId: "ou-1", organizationId: "org" },
    ],
    [
      EventType.Organization_Updated,
      "editedOrgSettings",
      "editedOrgSettingsWithName",
      { organizationId: "org" },
    ],
    [
      EventType.Organization_PurgedVault,
      "purgedOrganizationVault",
      "purgedOrganizationVaultWithName",
      { organizationId: "org" },
    ],
    [
      EventType.Organization_ClientExportedVault,
      "exportedOrganizationVault",
      "exportedOrganizationVaultWithName",
      { organizationId: "org" },
    ],
    [
      EventType.Organization_ItemOrganization_Accepted,
      "userAcceptedTransfer",
      "userAcceptedTransferWithOrgName",
      { organizationId: "org" },
    ],
    [
      EventType.Organization_ItemOrganization_Declined,
      "revokedUserIdDeclinedTransfer",
      "revokedUserIdDeclinedTransferWithOrgName",
      { organizationUserId: "ou-1", organizationId: "org" },
    ],
    [
      EventType.ProviderOrganization_Created,
      "createdOrganizationId",
      "createdOrganizationIdWithName",
      { providerOrganizationId: "po-1", providerId: "provider-1" },
    ],
    [
      EventType.ProviderOrganization_Added,
      "addedOrganizationId",
      "addedOrganizationIdWithName",
      { providerOrganizationId: "po-1", providerId: "provider-1" },
    ],
    [
      EventType.ProviderOrganization_Removed,
      "removedOrganizationId",
      "removedOrganizationIdWithName",
      { providerOrganizationId: "po-1", providerId: "provider-1" },
    ],
    [
      EventType.ProviderOrganization_VaultAccessed,
      "accessedClientVault",
      "accessedClientVaultWithName",
      { providerOrganizationId: "po-1", providerId: "provider-1" },
    ],
  ];

  it.each(cases)(
    "uses the legacy key (not the 'with name' key) for %s when vfo1-foundation is off, even with an org name resolver",
    async (type, legacyKey, nextKey, evFields) => {
      const sut = createSut(false);
      const options = new EventOptions();
      options.getOrganizationName = () => orgName;

      const info = await sut.getEventInfo({ type, ...evFields } as EventResponse, options);

      expect(info.humanReadableMessage).toContain(`${legacyKey}|`);
      expect(info.humanReadableMessage).not.toContain(nextKey);
    },
  );

  it.each(cases)(
    "uses the 'with name' key and interpolates the resolved organization name for %s when vfo1-foundation is on",
    async (type, _legacyKey, nextKey, evFields) => {
      const sut = createSut(true);
      const options = new EventOptions();
      options.getOrganizationName = () => orgName;

      const info = await sut.getEventInfo({ type, ...evFields } as EventResponse, options);

      expect(info.humanReadableMessage).toContain(nextKey);
      expect(info.humanReadableMessage).toContain(orgName);
    },
  );

  it.each(cases)(
    "falls back to the legacy key for %s when vfo1-foundation is on but no org name resolver is provided",
    async (type, legacyKey, nextKey, evFields) => {
      const sut = createSut(true);

      const info = await sut.getEventInfo({ type, ...evFields } as EventResponse);

      expect(info.humanReadableMessage).toContain(`${legacyKey}|`);
      expect(info.humanReadableMessage).not.toContain(nextKey);
    },
  );

  it.each(cases)(
    "falls back to the legacy key for %s when vfo1-foundation is on but the resolver returns undefined",
    async (type, legacyKey, nextKey, evFields) => {
      const sut = createSut(true);
      const options = new EventOptions();
      options.getOrganizationName = () => undefined;

      const info = await sut.getEventInfo({ type, ...evFields } as EventResponse, options);

      expect(info.humanReadableMessage).toContain(`${legacyKey}|`);
      expect(info.humanReadableMessage).not.toContain(nextKey);
    },
  );
});

describe("EventService shortcode escaping", () => {
  let sut: EventService;

  const i18n = mock<I18nService>();
  i18n.t.mockImplementation(
    (id: string, p1?: string, p2?: string) => `${id}${p1 ?? ""}${p2 ?? ""}`,
  );

  beforeEach(() => {
    const policyService = mock<PolicyService>();
    policyService.policies$.mockReturnValue(of([]));
    const accountService = mock<AccountService>();
    (accountService as any).activeAccount$ = of({ id: "user-id" });
    const configService = mock<ConfigService>();
    configService.getFeatureFlag.mockResolvedValue(false);

    sut = new EventService(i18n, policyService, accountService, configService);
  });

  // getShortId only keeps the first 8 characters, so the payloads below are crafted so those first
  // 8 characters are HTML-significant. "<script>" is exactly 8 characters.
  const scriptId = "<script>alert(1)";
  const ampId = "a&b<c>def-tail"; // first 8 chars: a&b<c>de

  it("escapes the id in the plain (unlinked) cipher shortcode", async () => {
    // organizationId == null forces the non-anchor `<code>` branch of formatCipherId
    const info = await sut.getEventInfo({
      type: EventType.Cipher_Created,
      cipherId: scriptId,
      organizationId: null,
    } as EventResponse);

    expect(info.message).toContain("<code>&lt;script&gt;</code>");
    expect(info.message).not.toContain("<script>");
  });

  it("escapes ampersands and angle brackets in the plain cipher shortcode", async () => {
    const info = await sut.getEventInfo({
      type: EventType.Cipher_Created,
      cipherId: ampId,
      organizationId: null,
    } as EventResponse);

    expect(info.message).toContain("<code>a&amp;b&lt;c&gt;de</code>");
  });

  it("escapes the id inside the linked (anchor) cipher shortcode", async () => {
    // organizationId set + default cipherInfo=true routes through makeAnchor
    const info = await sut.getEventInfo({
      type: EventType.Cipher_Created,
      cipherId: scriptId,
      organizationId: "org",
    } as EventResponse);

    // The rendered id lives in the <code> child and must be escaped, even though the raw id still
    // appears inside the (attribute-quoted) href.
    expect(info.message).toContain("<code>&lt;script&gt;</code>");
  });

  it("escapes the creator id in the plain (non-linkable member) send shortcode", async () => {
    const options = new EventOptions();
    options.linkableMemberIds = new Set<string>(); // creator absent => not linkable => plain text

    const info = await sut.getEventInfo(
      {
        type: EventType.Send_Accessed_Text,
        sendId: "send-1234-5678",
        userId: scriptId,
        organizationId: "org",
      } as EventResponse,
      options,
    );

    expect(info.message).toContain("<code>&lt;script&gt;</code>");
    expect(info.message).not.toContain("<code><script></code>");
  });
});
