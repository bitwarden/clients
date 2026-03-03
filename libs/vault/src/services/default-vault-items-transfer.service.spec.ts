import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of, Subject } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService, OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { EventType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId, CollectionId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { UserId } from "@bitwarden/user-core";

import {
  LeaveConfirmationDialogResult,
  TransferItemsDialogResult,
} from "../components/vault-items-transfer";

import { DefaultVaultItemsTransferService } from "./default-vault-items-transfer.service";

describe("DefaultVaultItemsTransferService", () => {
  let service: DefaultVaultItemsTransferService;
  let transferInProgressValues: boolean[];

  let mockCipherService: MockProxy<CipherService>;
  let mockPolicyService: MockProxy<PolicyService>;
  let mockOrganizationService: MockProxy<OrganizationService>;
  let mockCollectionService: MockProxy<CollectionService>;
  let mockLogService: MockProxy<LogService>;
  let mockI18nService: MockProxy<I18nService>;
  let mockDialogService: MockProxy<DialogService>;
  let mockToastService: MockProxy<ToastService>;
  let mockEventCollectionService: MockProxy<EventCollectionService>;
  let mockConfigService: MockProxy<ConfigService>;
  let mockOrganizationUserApiService: MockProxy<OrganizationUserApiService>;
  let mockSyncService: MockProxy<SyncService>;

  const userId = "user-id" as UserId;
  const organizationId = "org-id" as OrganizationId;
  const collectionId = "collection-id" as CollectionId;

  /**
   * Creates a mock DialogRef that emits the provided result when closed
   */
  function createMockDialogRef<T>(result: T): DialogRef<T> {
    const closed$ = new Subject<T>();
    const dialogRef = {
      closed: closed$.asObservable(),
      close: jest.fn(),
    } as unknown as DialogRef<T>;

    // Emit the result asynchronously to simulate dialog closing
    setTimeout(() => {
      closed$.next(result);
      closed$.complete();
    }, 0);

    return dialogRef;
  }

  beforeEach(() => {
    mockCipherService = mock<CipherService>();
    mockPolicyService = mock<PolicyService>();
    mockOrganizationService = mock<OrganizationService>();
    mockCollectionService = mock<CollectionService>();
    mockLogService = mock<LogService>();
    mockI18nService = mock<I18nService>();
    mockDialogService = mock<DialogService>();
    mockToastService = mock<ToastService>();
    mockEventCollectionService = mock<EventCollectionService>();
    mockConfigService = mock<ConfigService>();
    mockOrganizationUserApiService = mock<OrganizationUserApiService>();
    mockSyncService = mock<SyncService>();

    mockI18nService.t.mockImplementation((key) => key);
    transferInProgressValues = [];

    service = new DefaultVaultItemsTransferService(
      mockCipherService,
      mockPolicyService,
      mockOrganizationService,
      mockCollectionService,
      mockLogService,
      mockI18nService,
      mockDialogService,
      mockToastService,
      mockEventCollectionService,
      mockConfigService,
      mockOrganizationUserApiService,
      mockSyncService,
    );
  });

  describe("userMigrationInfo$", () => {
    // Helper to setup common mock scenario
    function setupMocksForMigrationScenario(options: {
      policies?: Policy[];
      organizations?: Organization[];
      ciphers?: CipherView[];
      defaultCollection?: CollectionView;
    }): void {
      mockPolicyService.policiesByType$.mockReturnValue(of(options.policies ?? []));
      mockOrganizationService.organizations$.mockReturnValue(of(options.organizations ?? []));
      mockCipherService.cipherViews$.mockReturnValue(of(options.ciphers ?? []));
      mockCollectionService.defaultUserCollection$.mockReturnValue(of(options.defaultCollection));
    }

    it("calls policiesByType$ with correct PolicyType", async () => {
      setupMocksForMigrationScenario({ policies: [] });

      await firstValueFrom(service.userMigrationInfo$(userId));

      expect(mockPolicyService.policiesByType$).toHaveBeenCalledWith(
        PolicyType.OrganizationDataOwnership,
        userId,
      );
    });

    describe("when no policy exists", () => {
      beforeEach(() => {
        setupMocksForMigrationScenario({ policies: [] });
      });

      it("returns requiresMigration: false", async () => {
        const result = await firstValueFrom(service.userMigrationInfo$(userId));

        expect(result).toEqual({
          requiresMigration: false,
        });
      });
    });

    describe("when policy exists", () => {
      const policy = {
        organizationId: organizationId,
        revisionDate: new Date("2024-01-01"),
      } as Policy;
      const organization = {
        id: organizationId,
        name: "Test Org",
      } as Organization;

      beforeEach(() => {
        setupMocksForMigrationScenario({
          policies: [policy],
          organizations: [organization],
        });
      });

      describe("and user has no personal ciphers", () => {
        beforeEach(() => {
          mockCipherService.cipherViews$.mockReturnValue(of([]));
        });

        it("returns requiresMigration: false", async () => {
          const result = await firstValueFrom(service.userMigrationInfo$(userId));

          expect(result).toEqual({
            requiresMigration: false,
            enforcingOrganization: organization,
            defaultCollectionId: undefined,
          });
        });
      });

      describe("and user has personal ciphers", () => {
        beforeEach(() => {
          mockCipherService.cipherViews$.mockReturnValue(of([{ id: "cipher-1" } as CipherView]));
        });

        it("returns requiresMigration: true", async () => {
          const result = await firstValueFrom(service.userMigrationInfo$(userId));

          expect(result).toEqual({
            requiresMigration: true,
            enforcingOrganization: organization,
            defaultCollectionId: undefined,
          });
        });

        it("includes defaultCollectionId when a default collection exists", async () => {
          mockCollectionService.defaultUserCollection$.mockReturnValue(
            of({
              id: collectionId,
              organizationId: organizationId,
              isDefaultCollection: true,
            } as CollectionView),
          );

          const result = await firstValueFrom(service.userMigrationInfo$(userId));

          expect(result).toEqual({
            requiresMigration: true,
            enforcingOrganization: organization,
            defaultCollectionId: collectionId,
          });
        });
      });

      it("filters out organization ciphers when checking for personal ciphers", async () => {
        mockCipherService.cipherViews$.mockReturnValue(
          of([
            {
              id: "cipher-1",
              organizationId: organizationId as string,
            } as CipherView,
          ]),
        );

        const result = await firstValueFrom(service.userMigrationInfo$(userId));

        expect(result).toEqual({
          requiresMigration: false,
          enforcingOrganization: organization,
          defaultCollectionId: undefined,
        });
      });
    });

    describe("when multiple policies exist", () => {
      const olderPolicy = {
        organizationId: "older-org-id" as OrganizationId,
        revisionDate: new Date("2024-01-01"),
      } as Policy;
      const newerPolicy = {
        organizationId: organizationId,
        revisionDate: new Date("2024-06-01"),
      } as Policy;
      const olderOrganization = {
        id: "older-org-id" as OrganizationId,
        name: "Older Org",
      } as Organization;
      const newerOrganization = {
        id: organizationId,
        name: "Newer Org",
      } as Organization;

      beforeEach(() => {
        setupMocksForMigrationScenario({
          policies: [newerPolicy, olderPolicy],
          organizations: [olderOrganization, newerOrganization],
          ciphers: [{ id: "cipher-1" } as CipherView],
        });
      });

      it("uses the oldest policy when selecting enforcing organization", async () => {
        const result = await firstValueFrom(service.userMigrationInfo$(userId));

        expect(result).toEqual({
          requiresMigration: true,
          enforcingOrganization: olderOrganization,
          defaultCollectionId: undefined,
        });
      });
    });
  });

  describe("transferPersonalItems", () => {
    it("does nothing when user has no personal ciphers", async () => {
      mockCipherService.cipherViews$.mockReturnValue(of([]));

      await service.transferPersonalItems(userId, organizationId, collectionId);

      expect(mockCipherService.shareManyWithServer).not.toHaveBeenCalled();
      expect(mockLogService.info).not.toHaveBeenCalled();
    });

    it("calls shareManyWithServer with correct parameters", async () => {
      const personalCiphers = [{ id: "cipher-1" }, { id: "cipher-2" }] as CipherView[];

      mockCipherService.cipherViews$.mockReturnValue(of(personalCiphers));
      mockCipherService.shareManyWithServer.mockResolvedValue(undefined);

      await service.transferPersonalItems(userId, organizationId, collectionId);

      expect(mockCipherService.shareManyWithServer).toHaveBeenCalledWith(
        personalCiphers,
        organizationId,
        [collectionId],
        userId,
      );
    });

    it("transfers only personal ciphers, not organization ciphers", async () => {
      const allCiphers = [
        { id: "cipher-1" },
        { id: "cipher-2", organizationId: "other-org-id" },
        { id: "cipher-3" },
      ] as CipherView[];

      const expectedPersonalCiphers = [allCiphers[0], allCiphers[2]];

      mockCipherService.cipherViews$.mockReturnValue(of(allCiphers));
      mockCipherService.shareManyWithServer.mockResolvedValue(undefined);

      await service.transferPersonalItems(userId, organizationId, collectionId);

      expect(mockCipherService.shareManyWithServer).toHaveBeenCalledWith(
        expectedPersonalCiphers,
        organizationId,
        [collectionId],
        userId,
      );
    });

    it("propagates errors from shareManyWithServer", async () => {
      const personalCiphers = [{ id: "cipher-1" }] as CipherView[];

      const error = new Error("Transfer failed");

      mockCipherService.cipherViews$.mockReturnValue(of(personalCiphers));
      mockCipherService.shareManyWithServer.mockRejectedValue(error);

      await expect(
        service.transferPersonalItems(userId, organizationId, collectionId),
      ).rejects.toThrow("Transfer failed");
    });
  });

  describe("upgradeOldAttachments", () => {
    it("upgrades old attachments before transferring", async () => {
      const cipherWithOldAttachment = {
        id: "cipher-1",
        name: "Cipher 1",
        hasOldAttachments: true,
        attachments: [{ key: null }],
      } as unknown as CipherView;

      const upgradedCipher = {
        id: "cipher-1",
        name: "Cipher 1",
        hasOldAttachments: false,
        attachments: [{ key: "new-key" }],
      } as unknown as CipherView;

      mockCipherService.cipherViews$
        .mockReturnValueOnce(of([cipherWithOldAttachment]))
        .mockReturnValueOnce(of([upgradedCipher]));
      mockCipherService.upgradeOldCipherAttachments.mockResolvedValue(upgradedCipher);
      mockCipherService.shareManyWithServer.mockResolvedValue(undefined);

      await service.transferPersonalItems(userId, organizationId, collectionId);

      expect(mockCipherService.upgradeOldCipherAttachments).toHaveBeenCalledWith(
        cipherWithOldAttachment,
        userId,
      );
      expect(mockCipherService.shareManyWithServer).toHaveBeenCalledWith(
        [upgradedCipher],
        organizationId,
        [collectionId],
        userId,
      );
    });

    it("upgrades multiple ciphers with old attachments", async () => {
      const cipher1 = {
        id: "cipher-1",
        name: "Cipher 1",
        hasOldAttachments: true,
        attachments: [{ key: null }],
      } as unknown as CipherView;

      const cipher2 = {
        id: "cipher-2",
        name: "Cipher 2",
        hasOldAttachments: true,
        attachments: [{ key: null }],
      } as unknown as CipherView;

      const upgradedCipher1 = { ...cipher1, hasOldAttachments: false } as CipherView;
      const upgradedCipher2 = { ...cipher2, hasOldAttachments: false } as CipherView;

      mockCipherService.cipherViews$
        .mockReturnValueOnce(of([cipher1, cipher2]))
        .mockReturnValueOnce(of([upgradedCipher1, upgradedCipher2]));
      mockCipherService.upgradeOldCipherAttachments
        .mockResolvedValueOnce(upgradedCipher1)
        .mockResolvedValueOnce(upgradedCipher2);
      mockCipherService.shareManyWithServer.mockResolvedValue(undefined);

      await service.transferPersonalItems(userId, organizationId, collectionId);

      expect(mockCipherService.upgradeOldCipherAttachments).toHaveBeenCalledTimes(2);
      expect(mockCipherService.upgradeOldCipherAttachments).toHaveBeenCalledWith(cipher1, userId);
      expect(mockCipherService.upgradeOldCipherAttachments).toHaveBeenCalledWith(cipher2, userId);
    });

    it("skips attachments that already have keys", async () => {
      const cipherWithMixedAttachments = {
        id: "cipher-1",
        name: "Cipher 1",
        hasOldAttachments: true,
        attachments: [{ key: "existing-key" }, { key: null }],
      } as unknown as CipherView;

      const upgradedCipher = {
        ...cipherWithMixedAttachments,
        hasOldAttachments: false,
      } as unknown as CipherView;

      mockCipherService.cipherViews$
        .mockReturnValueOnce(of([cipherWithMixedAttachments]))
        .mockReturnValueOnce(of([upgradedCipher]));
      mockCipherService.upgradeOldCipherAttachments.mockResolvedValue(upgradedCipher);
      mockCipherService.shareManyWithServer.mockResolvedValue(undefined);

      await service.transferPersonalItems(userId, organizationId, collectionId);

      // Should only be called once for the attachment without a key
      expect(mockCipherService.upgradeOldCipherAttachments).toHaveBeenCalledTimes(1);
    });

    it("throws error when upgradeOldCipherAttachments fails", async () => {
      const cipherWithOldAttachment = {
        id: "cipher-1",
        name: "Cipher 1",
        hasOldAttachments: true,
        attachments: [{ key: null }],
      } as unknown as CipherView;

      mockCipherService.cipherViews$.mockReturnValue(of([cipherWithOldAttachment]));
      mockCipherService.upgradeOldCipherAttachments.mockRejectedValue(new Error("Upgrade failed"));

      await expect(
        service.transferPersonalItems(userId, organizationId, collectionId),
      ).rejects.toThrow("Failed to upgrade old attachments for cipher cipher-1");

      expect(mockCipherService.shareManyWithServer).not.toHaveBeenCalled();
    });

    it("throws error when upgrade returns cipher still having old attachments", async () => {
      const cipherWithOldAttachment = {
        id: "cipher-1",
        name: "Cipher 1",
        hasOldAttachments: true,
        attachments: [{ key: null }],
      } as unknown as CipherView;

      // Upgrade returns but cipher still has old attachments
      const stillOldCipher = {
        ...cipherWithOldAttachment,
        hasOldAttachments: true,
      } as unknown as CipherView;

      mockCipherService.cipherViews$.mockReturnValue(of([cipherWithOldAttachment]));
      mockCipherService.upgradeOldCipherAttachments.mockResolvedValue(stillOldCipher);

      await expect(
        service.transferPersonalItems(userId, organizationId, collectionId),
      ).rejects.toThrow("Failed to upgrade old attachments for cipher cipher-1");

      expect(mockLogService.error).toHaveBeenCalled();
      expect(mockCipherService.shareManyWithServer).not.toHaveBeenCalled();
    });

    it("throws error when sanity check finds remaining old attachments after upgrade", async () => {
      const cipherWithOldAttachment = {
        id: "cipher-1",
        name: "Cipher 1",
        hasOldAttachments: true,
        attachments: [{ key: null }],
      } as unknown as CipherView;

      const upgradedCipher = {
        ...cipherWithOldAttachment,
        hasOldAttachments: false,
      } as unknown as CipherView;

      // First call returns cipher with old attachment, second call (after upgrade) still returns old attachment
      mockCipherService.cipherViews$
        .mockReturnValueOnce(of([cipherWithOldAttachment]))
        .mockReturnValueOnce(of([cipherWithOldAttachment])); // Still has old attachments after re-fetch
      mockCipherService.upgradeOldCipherAttachments.mockResolvedValue(upgradedCipher);

      await expect(
        service.transferPersonalItems(userId, organizationId, collectionId),
      ).rejects.toThrow(
        "Failed to upgrade all old attachments. 1 ciphers still have old attachments.",
      );

      expect(mockCipherService.shareManyWithServer).not.toHaveBeenCalled();
    });

    it("logs info when upgrading old attachments", async () => {
      const cipherWithOldAttachment = {
        id: "cipher-1",
        name: "Cipher 1",
        hasOldAttachments: true,
        attachments: [{ key: null }],
      } as unknown as CipherView;

      const upgradedCipher = {
        ...cipherWithOldAttachment,
        hasOldAttachments: false,
      } as unknown as CipherView;

      mockCipherService.cipherViews$
        .mockReturnValueOnce(of([cipherWithOldAttachment]))
        .mockReturnValueOnce(of([upgradedCipher]));
      mockCipherService.upgradeOldCipherAttachments.mockResolvedValue(upgradedCipher);
      mockCipherService.shareManyWithServer.mockResolvedValue(undefined);

      await service.transferPersonalItems(userId, organizationId, collectionId);

      expect(mockLogService.info).toHaveBeenCalledWith(
        expect.stringContaining("Found 1 ciphers with old attachments needing upgrade"),
      );
      expect(mockLogService.info).toHaveBeenCalledWith(
        expect.stringContaining("Successfully upgraded 1 ciphers with old attachments"),
      );
    });

    it("does not upgrade when ciphers have no old attachments", async () => {
      const cipherWithoutOldAttachment = {
        id: "cipher-1",
        name: "Cipher 1",
        hasOldAttachments: false,
      } as unknown as CipherView;

      mockCipherService.cipherViews$.mockReturnValue(of([cipherWithoutOldAttachment]));
      mockCipherService.shareManyWithServer.mockResolvedValue(undefined);

      await service.transferPersonalItems(userId, organizationId, collectionId);

      expect(mockCipherService.upgradeOldCipherAttachments).not.toHaveBeenCalled();
      expect(mockCipherService.shareManyWithServer).toHaveBeenCalled();
    });
  });

  describe("enforceOrganizationDataOwnership", () => {
    const policy = {
      organizationId: organizationId,
      revisionDate: new Date("2024-01-01"),
    } as Policy;
    const organization = {
      id: organizationId,
      name: "Test Org",
    } as Organization;

    function setupMocksForEnforcementScenario(options: {
      featureEnabled?: boolean;
      policies?: Policy[];
      organizations?: Organization[];
      ciphers?: CipherView[];
      defaultCollection?: CollectionView;
    }): void {
      mockConfigService.getFeatureFlag.mockResolvedValue(options.featureEnabled ?? true);
      mockPolicyService.policiesByType$.mockReturnValue(of(options.policies ?? []));
      mockOrganizationService.organizations$.mockReturnValue(of(options.organizations ?? []));
      mockCipherService.cipherViews$.mockReturnValue(of(options.ciphers ?? []));
      mockCollectionService.defaultUserCollection$.mockReturnValue(of(options.defaultCollection));
      mockSyncService.fullSync.mockResolvedValue(true);
      mockOrganizationUserApiService.revokeSelf.mockResolvedValue(undefined);
    }

    it("does nothing when feature flag is disabled", async () => {
      setupMocksForEnforcementScenario({
        featureEnabled: false,
        policies: [policy],
        organizations: [organization],
        ciphers: [{ id: "cipher-1" } as CipherView],
        defaultCollection: {
          id: collectionId,
          organizationId: organizationId,
          isDefaultCollection: true,
        } as CollectionView,
      });

      await service.enforceOrganizationDataOwnership(userId);

      expect(mockConfigService.getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.MigrateMyVaultToMyItems,
      );
      expect(mockDialogService.open).not.toHaveBeenCalled();
      expect(mockCipherService.shareManyWithServer).not.toHaveBeenCalled();
    });

    it("does nothing when no migration is required", async () => {
      setupMocksForEnforcementScenario({ policies: [] });

      await service.enforceOrganizationDataOwnership(userId);

      expect(mockDialogService.open).not.toHaveBeenCalled();
      expect(mockCipherService.shareManyWithServer).not.toHaveBeenCalled();
    });

    it("does nothing when user has no personal ciphers", async () => {
      setupMocksForEnforcementScenario({
        policies: [policy],
        organizations: [organization],
        ciphers: [],
      });

      await service.enforceOrganizationDataOwnership(userId);

      expect(mockDialogService.open).not.toHaveBeenCalled();
      expect(mockCipherService.shareManyWithServer).not.toHaveBeenCalled();
    });

    it("logs warning and returns when default collection is missing", async () => {
      setupMocksForEnforcementScenario({
        policies: [policy],
        organizations: [organization],
        ciphers: [{ id: "cipher-1" } as CipherView],
      });

      await service.enforceOrganizationDataOwnership(userId);

      expect(mockLogService.warning).toHaveBeenCalledWith(
        "Default collection is missing for user during organization data ownership enforcement",
      );
      expect(mockDialogService.open).not.toHaveBeenCalled();
      expect(mockCipherService.shareManyWithServer).not.toHaveBeenCalled();
    });

    it("does not transfer items when user declines and confirms leaving", async () => {
      setupMocksForEnforcementScenario({
        policies: [policy],
        organizations: [organization],
        ciphers: [{ id: "cipher-1" } as CipherView],
        defaultCollection: {
          id: collectionId,
          organizationId: organizationId,
          isDefaultCollection: true,
        } as CollectionView,
      });

      // User declines transfer, then confirms leaving
      mockDialogService.open
        .mockReturnValueOnce(createMockDialogRef(TransferItemsDialogResult.Declined))
        .mockReturnValueOnce(createMockDialogRef(LeaveConfirmationDialogResult.Confirmed));

      await service.enforceOrganizationDataOwnership(userId);

      expect(mockOrganizationUserApiService.revokeSelf).toHaveBeenCalledWith(organizationId);
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(true);
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "leftOrganization",
      });
      expect(mockCipherService.shareManyWithServer).not.toHaveBeenCalled();
    });

    it("transfers items and shows success toast when user accepts transfer", async () => {
      const personalCiphers = [{ id: "cipher-1" } as CipherView];
      setupMocksForEnforcementScenario({
        policies: [policy],
        organizations: [organization],
        ciphers: personalCiphers,
        defaultCollection: {
          id: collectionId,
          organizationId: organizationId,
          isDefaultCollection: true,
        } as CollectionView,
      });

      mockDialogService.open.mockReturnValueOnce(
        createMockDialogRef(TransferItemsDialogResult.Accepted),
      );
      mockCipherService.shareManyWithServer.mockResolvedValue(undefined);

      await service.enforceOrganizationDataOwnership(userId);

      expect(mockCipherService.shareManyWithServer).toHaveBeenCalledWith(
        personalCiphers,
        organizationId,
        [collectionId],
        userId,
      );
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "itemsTransferred",
      });
    });

    it("shows error toast when transfer fails", async () => {
      const personalCiphers = [{ id: "cipher-1" } as CipherView];
      setupMocksForEnforcementScenario({
        policies: [policy],
        organizations: [organization],
        ciphers: personalCiphers,
        defaultCollection: {
          id: collectionId,
          organizationId: organizationId,
          isDefaultCollection: true,
        } as CollectionView,
      });

      mockDialogService.open.mockReturnValueOnce(
        createMockDialogRef(TransferItemsDialogResult.Accepted),
      );
      mockCipherService.shareManyWithServer.mockRejectedValue(new Error("Transfer failed"));

      await service.enforceOrganizationDataOwnership(userId);

      expect(mockLogService.error).toHaveBeenCalledWith(
        "Error transferring personal items to organization",
        expect.any(Error),
      );
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "errorOccurred",
      });
    });

    it("re-shows transfer dialog when user goes back from leave confirmation", async () => {
      const personalCiphers = [{ id: "cipher-1" } as CipherView];
      setupMocksForEnforcementScenario({
        policies: [policy],
        organizations: [organization],
        ciphers: personalCiphers,
        defaultCollection: {
          id: collectionId,
          organizationId: organizationId,
          isDefaultCollection: true,
        } as CollectionView,
      });

      // User declines, goes back, then accepts
      mockDialogService.open
        .mockReturnValueOnce(createMockDialogRef(TransferItemsDialogResult.Declined))
        .mockReturnValueOnce(createMockDialogRef(LeaveConfirmationDialogResult.Back))
        .mockReturnValueOnce(createMockDialogRef(TransferItemsDialogResult.Accepted));
      mockCipherService.shareManyWithServer.mockResolvedValue(undefined);

      await service.enforceOrganizationDataOwnership(userId);

      // Dialog should have been opened 3 times: transfer -> leave -> transfer (after going back)
      expect(mockDialogService.open).toHaveBeenCalledTimes(3);
      expect(mockCipherService.shareManyWithServer).toHaveBeenCalled();
    });

    it("allows multiple back navigations before accepting transfer", async () => {
      const personalCiphers = [{ id: "cipher-1" } as CipherView];
      setupMocksForEnforcementScenario({
        policies: [policy],
        organizations: [organization],
        ciphers: personalCiphers,
        defaultCollection: {
          id: collectionId,
          organizationId: organizationId,
          isDefaultCollection: true,
        } as CollectionView,
      });

      // User declines, goes back, declines again, goes back again, then accepts
      mockDialogService.open
        .mockReturnValueOnce(createMockDialogRef(TransferItemsDialogResult.Declined))
        .mockReturnValueOnce(createMockDialogRef(LeaveConfirmationDialogResult.Back))
        .mockReturnValueOnce(createMockDialogRef(TransferItemsDialogResult.Declined))
        .mockReturnValueOnce(createMockDialogRef(LeaveConfirmationDialogResult.Back))
        .mockReturnValueOnce(createMockDialogRef(TransferItemsDialogResult.Accepted));
      mockCipherService.shareManyWithServer.mockResolvedValue(undefined);

      await service.enforceOrganizationDataOwnership(userId);

      // Dialog should have been opened 5 times
      expect(mockDialogService.open).toHaveBeenCalledTimes(5);
      expect(mockCipherService.shareManyWithServer).toHaveBeenCalled();
    });

    it("allows user to go back and then confirm leaving", async () => {
      setupMocksForEnforcementScenario({
        policies: [policy],
        organizations: [organization],
        ciphers: [{ id: "cipher-1" } as CipherView],
        defaultCollection: {
          id: collectionId,
          organizationId: organizationId,
          isDefaultCollection: true,
        } as CollectionView,
      });

      // User declines, goes back, declines again, then confirms leaving
      mockDialogService.open
        .mockReturnValueOnce(createMockDialogRef(TransferItemsDialogResult.Declined))
        .mockReturnValueOnce(createMockDialogRef(LeaveConfirmationDialogResult.Back))
        .mockReturnValueOnce(createMockDialogRef(TransferItemsDialogResult.Declined))
        .mockReturnValueOnce(createMockDialogRef(LeaveConfirmationDialogResult.Confirmed));

      await service.enforceOrganizationDataOwnership(userId);

      expect(mockDialogService.open).toHaveBeenCalledTimes(4);
      expect(mockCipherService.shareManyWithServer).not.toHaveBeenCalled();
    });

    describe("event logs", () => {
      it("logs accepted event when user accepts transfer", async () => {
        const personalCiphers = [{ id: "cipher-1" } as CipherView];
        setupMocksForEnforcementScenario({
          policies: [policy],
          organizations: [organization],
          ciphers: personalCiphers,
          defaultCollection: {
            id: collectionId,
            organizationId: organizationId,
            isDefaultCollection: true,
          } as CollectionView,
        });

        mockDialogService.open.mockReturnValueOnce(
          createMockDialogRef(TransferItemsDialogResult.Accepted),
        );
        mockCipherService.shareManyWithServer.mockResolvedValue(undefined);

        await service.enforceOrganizationDataOwnership(userId);

        expect(mockEventCollectionService.collect).toHaveBeenCalledWith(
          EventType.Organization_ItemOrganization_Accepted,
          undefined,
          undefined,
          organizationId,
        );
      });

      it("logs declined event when user rejects transfer", async () => {
        const personalCiphers = [{ id: "cipher-1" } as CipherView];
        setupMocksForEnforcementScenario({
          policies: [policy],
          organizations: [organization],
          ciphers: personalCiphers,
          defaultCollection: {
            id: collectionId,
            organizationId: organizationId,
            isDefaultCollection: true,
          } as CollectionView,
        });

        mockDialogService.open
          .mockReturnValueOnce(createMockDialogRef(TransferItemsDialogResult.Declined))
          .mockReturnValueOnce(createMockDialogRef(LeaveConfirmationDialogResult.Confirmed));

        await service.enforceOrganizationDataOwnership(userId);

        expect(mockEventCollectionService.collect).toHaveBeenCalledWith(
          EventType.Organization_ItemOrganization_Declined,
          undefined,
          undefined,
          organizationId,
        );
      });
    });
  });

  describe("transferInProgress$", () => {
    const policy = {
      organizationId: organizationId,
      revisionDate: new Date("2024-01-01"),
    } as Policy;
    const organization = {
      id: organizationId,
      name: "Test Org",
    } as Organization;

    function setupMocksForTransferScenario(options: {
      featureEnabled?: boolean;
      policies?: Policy[];
      organizations?: Organization[];
      ciphers?: CipherView[];
      defaultCollection?: CollectionView;
    }): void {
      mockConfigService.getFeatureFlag.mockResolvedValue(options.featureEnabled ?? true);
      mockPolicyService.policiesByType$.mockReturnValue(of(options.policies ?? []));
      mockOrganizationService.organizations$.mockReturnValue(of(options.organizations ?? []));
      mockCipherService.cipherViews$.mockReturnValue(of(options.ciphers ?? []));
      mockCollectionService.defaultUserCollection$.mockReturnValue(of(options.defaultCollection));
    }

    it("emits false initially", async () => {
      const result = await firstValueFrom(service.transferInProgress$);

      expect(result).toBe(false);
    });

    it("emits true during transfer and false after successful completion", async () => {
      const personalCiphers = [{ id: "cipher-1" } as CipherView];
      setupMocksForTransferScenario({
        policies: [policy],
        organizations: [organization],
        ciphers: personalCiphers,
        defaultCollection: {
          id: collectionId,
          organizationId: organizationId,
          isDefaultCollection: true,
        } as CollectionView,
      });

      mockDialogService.open.mockReturnValueOnce(
        createMockDialogRef(TransferItemsDialogResult.Accepted),
      );
      mockCipherService.shareManyWithServer.mockResolvedValue(undefined);

      // Subscribe to track all emitted values
      service.transferInProgress$.subscribe((value) => transferInProgressValues.push(value));

      await service.enforceOrganizationDataOwnership(userId);

      // Should have emitted: false (initial), true (transfer started), false (transfer completed)
      expect(transferInProgressValues).toEqual([false, true, false]);
    });

    it("emits false after transfer fails with error", async () => {
      const personalCiphers = [{ id: "cipher-1" } as CipherView];
      setupMocksForTransferScenario({
        policies: [policy],
        organizations: [organization],
        ciphers: personalCiphers,
        defaultCollection: {
          id: collectionId,
          organizationId: organizationId,
          isDefaultCollection: true,
        } as CollectionView,
      });

      mockDialogService.open.mockReturnValueOnce(
        createMockDialogRef(TransferItemsDialogResult.Accepted),
      );
      mockCipherService.shareManyWithServer.mockRejectedValue(new Error("Transfer failed"));

      // Subscribe to track all emitted values
      service.transferInProgress$.subscribe((value) => transferInProgressValues.push(value));

      await service.enforceOrganizationDataOwnership(userId);

      // Should have emitted: false (initial), true (transfer started), false (transfer failed)
      expect(transferInProgressValues).toEqual([false, true, false]);
    });
  });

  describe("enforcementInFlight", () => {
    const policy = {
      organizationId: organizationId,
      revisionDate: new Date("2024-01-01"),
    } as Policy;
    const organization = {
      id: organizationId,
      name: "Test Org",
    } as Organization;
    const personalCiphers = [{ id: "cipher-1" } as CipherView];
    const defaultCollection = {
      id: collectionId,
      organizationId: organizationId,
      isDefaultCollection: true,
    } as CollectionView;

    beforeEach(() => {
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockPolicyService.policiesByType$.mockReturnValue(of([policy]));
      mockOrganizationService.organizations$.mockReturnValue(of([organization]));
      mockCipherService.cipherViews$.mockReturnValue(of(personalCiphers));
      mockCollectionService.defaultUserCollection$.mockReturnValue(of(defaultCollection));
      mockSyncService.fullSync.mockResolvedValue(true);
      mockOrganizationUserApiService.revokeSelf.mockResolvedValue(undefined);
    });

    it("prevents re-entry when enforcement is already in flight", async () => {
      // Create a dialog that resolves after a delay
      const delayedSubject = new Subject<any>();
      const delayedDialog = {
        closed: delayedSubject.asObservable(),
        close: jest.fn(),
      } as unknown as DialogRef<any>;

      mockDialogService.open.mockReturnValue(delayedDialog);

      // Start first call (won't complete immediately)
      const firstCall = service.enforceOrganizationDataOwnership(userId);

      // Flush microtasks to allow first call to set enforcementInFlight
      await Promise.resolve();

      // Second call should return immediately without opening dialog
      await service.enforceOrganizationDataOwnership(userId);

      // Verify re-entry was prevented - only the first call should proceed
      expect(mockDialogService.open).toHaveBeenCalledTimes(1);
      expect(mockPolicyService.policiesByType$).toHaveBeenCalledTimes(1);

      // Clean up - resolve the first call's dialog
      delayedSubject.next(TransferItemsDialogResult.Declined);
      delayedSubject.complete();

      // Mock the leave dialog
      mockDialogService.open.mockReturnValueOnce(
        createMockDialogRef(LeaveConfirmationDialogResult.Confirmed),
      );

      await firstCall;
    });

    it("allows subsequent calls after user declines and leaves", async () => {
      // First call: user declines and confirms leaving
      mockDialogService.open
        .mockReturnValueOnce(createMockDialogRef(TransferItemsDialogResult.Declined))
        .mockReturnValueOnce(createMockDialogRef(LeaveConfirmationDialogResult.Confirmed));

      await service.enforceOrganizationDataOwnership(userId);

      // Reset mocks for second call
      mockDialogService.open.mockClear();

      // Second call: user accepts transfer
      mockDialogService.open.mockReturnValueOnce(
        createMockDialogRef(TransferItemsDialogResult.Accepted),
      );
      mockCipherService.shareManyWithServer.mockResolvedValue(undefined);

      await service.enforceOrganizationDataOwnership(userId);

      // Second call should proceed (dialog opened again)
      expect(mockDialogService.open).toHaveBeenCalledTimes(1);
    });

    it("allows subsequent calls after successful transfer", async () => {
      // First call: user accepts transfer
      mockDialogService.open.mockReturnValueOnce(
        createMockDialogRef(TransferItemsDialogResult.Accepted),
      );
      mockCipherService.shareManyWithServer.mockResolvedValue(undefined);

      await service.enforceOrganizationDataOwnership(userId);

      // Reset mocks for second call
      mockDialogService.open.mockClear();
      mockCipherService.shareManyWithServer.mockClear();

      // Second call should be allowed (though no migration needed after first transfer)
      // Set up scenario where migration is needed again
      mockCipherService.cipherViews$.mockReturnValue(of([{ id: "cipher-2" } as CipherView]));

      mockDialogService.open.mockReturnValueOnce(
        createMockDialogRef(TransferItemsDialogResult.Accepted),
      );
      mockCipherService.shareManyWithServer.mockResolvedValue(undefined);

      await service.enforceOrganizationDataOwnership(userId);

      // Second call should proceed (dialog opened again)
      expect(mockDialogService.open).toHaveBeenCalledTimes(1);
    });

    it("allows subsequent calls after transfer fails with error", async () => {
      // First call: transfer fails
      mockDialogService.open.mockReturnValueOnce(
        createMockDialogRef(TransferItemsDialogResult.Accepted),
      );
      mockCipherService.shareManyWithServer.mockRejectedValue(new Error("Transfer failed"));

      await service.enforceOrganizationDataOwnership(userId);

      // Reset mocks for second call
      mockDialogService.open.mockClear();
      mockCipherService.shareManyWithServer.mockClear();

      // Second call: user accepts transfer successfully
      mockDialogService.open.mockReturnValueOnce(
        createMockDialogRef(TransferItemsDialogResult.Accepted),
      );
      mockCipherService.shareManyWithServer.mockResolvedValue(undefined);

      await service.enforceOrganizationDataOwnership(userId);

      // Second call should proceed (dialog opened again)
      expect(mockDialogService.open).toHaveBeenCalledTimes(1);
    });
  });
});
