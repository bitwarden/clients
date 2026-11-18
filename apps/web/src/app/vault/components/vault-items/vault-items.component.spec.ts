import { SelectionModel } from "@angular/cdk/collections";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { MenuModule, TableModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  compareVaultItems,
  VaultBatchBarService,
  VaultCopyButtonsService,
  VaultItem,
} from "@bitwarden/vault";

import { VaultItemsComponent } from "./vault-items.component";
import { VAULT_ROW_LEASE_BADGE } from "./vault-row-lease-badge.token";

describe("VaultItemsComponent", () => {
  let component: VaultItemsComponent<CipherViewLike>;
  let mockSelection: SelectionModel<VaultItem<CipherViewLike>>;

  const cipher1: Partial<CipherView> = {
    id: "cipher-1",
    name: "Cipher 1",
    organizationId: undefined,
  };

  const cipher2: Partial<CipherView> = {
    id: "cipher-2",
    name: "Cipher 2",
    organizationId: undefined,
  };

  beforeEach(async () => {
    mockSelection = new SelectionModel<VaultItem<CipherViewLike>>(
      true,
      [],
      true,
      compareVaultItems,
    );

    await TestBed.configureTestingModule({
      declarations: [VaultItemsComponent],
      imports: [ScrollingModule, TableModule, I18nPipe, MenuModule],
      providers: [
        {
          provide: CipherAuthorizationService,
          useValue: {
            canDeleteCipher$: jest.fn(),
            canRestoreCipher$: jest.fn(),
          },
        },
        {
          provide: RestrictedItemTypesService,
          useValue: {
            restricted$: of([]),
            isCipherRestricted: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: I18nService,
          useValue: {
            t: (key: string) => key,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag$: jest.fn().mockReturnValue(of(false)),
          },
        },
        {
          provide: VaultCopyButtonsService,
          useValue: {
            showQuickCopyActions$: of(false),
          },
        },
        {
          provide: VaultBatchBarService,
          useValue: {
            selection: mockSelection,
            clearSelection: () => mockSelection.clear(),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(VaultItemsComponent);
    component = fixture.componentInstance;
  });

  describe("optionsColumnWidthClass", () => {
    it("reserves room for the quick copy icons when they are shown", () => {
      expect(component["optionsColumnWidthClass"](true)).toBe("tw-w-48");
    });

    it("reserves room for the combined copy and launch actions", () => {
      expect(component["optionsColumnWidthClass"](false)).toBe("tw-w-32");
    });
  });

  describe("selectable items (editableItems)", () => {
    it("excludes partial (PAM-gated) ciphers so they cannot be selected or bulk-acted", () => {
      const normal = {
        id: "normal",
        organizationId: undefined,
        partial: false,
      } as unknown as CipherViewLike;
      const partial = {
        id: "partial",
        organizationId: undefined,
        partial: true,
      } as unknown as CipherViewLike;

      component.ciphers = [normal, partial];

      const editableCiphers = component["editableItems"].map((item) => item.cipher);
      expect(editableCiphers).toContain(normal);
      expect(editableCiphers).not.toContain(partial);
    });
  });

  describe("showControlledAccess (Controlled access column)", () => {
    class TestLeaseBadge {}

    async function setup(
      provideBadge: boolean,
      pamEnabled = true,
    ): Promise<VaultItemsComponent<CipherViewLike>> {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        declarations: [VaultItemsComponent],
        imports: [ScrollingModule, TableModule, I18nPipe, MenuModule],
        providers: [
          {
            provide: CipherAuthorizationService,
            useValue: { canDeleteCipher$: jest.fn(), canRestoreCipher$: jest.fn() },
          },
          {
            provide: RestrictedItemTypesService,
            useValue: { restricted$: of([]), isCipherRestricted: jest.fn().mockReturnValue(false) },
          },
          { provide: I18nService, useValue: { t: (key: string) => key } },
          {
            provide: VaultBatchBarService,
            useValue: {
              selection: mockSelection,
              clearSelection: () => mockSelection.clear(),
            },
          },
          {
            provide: ConfigService,
            useValue: {
              getFeatureFlag$: jest.fn((flag: FeatureFlag) =>
                of(flag === FeatureFlag.Pam ? pamEnabled : false),
              ),
            },
          },
          {
            provide: VaultCopyButtonsService,
            useValue: { showQuickCopyActions$: of(false) },
          },
          ...(provideBadge ? [{ provide: VAULT_ROW_LEASE_BADGE, useValue: TestLeaseBadge }] : []),
        ],
      });
      return TestBed.createComponent(VaultItemsComponent).componentInstance;
    }

    const pamOrg = { usePam: true } as Organization;
    const normalOrg = { usePam: false } as Organization;

    it("is hidden when the PAM feature flag is off, even with the badge seam and a PAM-enabled org", async () => {
      const c = await setup(true, false);
      c.allOrganizations = [pamOrg];
      expect(c.showControlledAccess).toBe(false);
    });

    it("is hidden when no host provides the badge seam, even with a PAM-enabled org", async () => {
      const c = await setup(false);
      c.allOrganizations = [pamOrg];
      expect(c.showControlledAccess).toBe(false);
    });

    it("is hidden when the badge seam is present but no org has PAM enabled", async () => {
      const c = await setup(true);
      c.allOrganizations = [normalOrg];
      expect(c.showControlledAccess).toBe(false);
    });

    it("is shown when the flag is on, the badge seam is present, and a PAM-enabled org is in view", async () => {
      const c = await setup(true);
      c.allOrganizations = [normalOrg, pamOrg];
      expect(c.showControlledAccess).toBe(true);
    });
  });

  describe("selection identity", () => {
    it("keeps checkmarks after ciphers input is re-set with new object references", () => {
      const mockCipher = cipher1 as CipherView;
      component.ciphers = [mockCipher];
      component["selection"].select(component.dataSource.data[0]);

      component.ciphers = [mockCipher];

      expect(component["selection"].isSelected(component.dataSource.data[0])).toBe(true);
    });
  });

  describe("clearSelection", () => {
    it("clears the selection", () => {
      const items: VaultItem<CipherView>[] = [
        { cipher: cipher1 as CipherView },
        { cipher: cipher2 as CipherView },
      ];

      component["selection"].select(...items);
      expect(component["selection"].selected.length).toBeGreaterThan(0);

      component.clearSelection();

      expect(component["selection"].selected.length).toBe(0);
    });
  });
});
