import { ScrollingModule } from "@angular/cdk/scrolling";
import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { CollectionView } from "@bitwarden/admin-console/common";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { MenuModule, TableModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { VaultItem } from "./vault-item";
import { VaultItemsComponent } from "./vault-items.component";

describe("VaultItemsComponent", () => {
  let component: VaultItemsComponent<CipherViewLike>;

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
          provide: CipherArchiveService,
          useValue: {
            hasArchiveFlagEnabled$: of(true),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(VaultItemsComponent);
    component = fixture.componentInstance;
  });

  describe("bulkUnarchiveAllowed", () => {
    it("returns false when no items are selected", () => {
      component["selection"].clear();

      expect(component.bulkUnarchiveAllowed).toBe(false);
    });

    it("returns false when selecting collections only", () => {
      const collection1 = { id: "col-1", name: "Collection 1" } as CollectionView;
      const collection2 = { id: "col-2", name: "Collection 2" } as CollectionView;

      const items: VaultItem<CipherView>[] = [
        { collection: collection1 },
        { collection: collection2 },
      ];

      component["selection"].select(...items);

      expect(component.bulkUnarchiveAllowed).toBe(false);
    });

    it("returns true when selecting archived ciphers without organization", () => {
      const archivedCipher1 = {
        ...cipher1,
        archivedDate: new Date("2024-01-01"),
      };
      const archivedCipher2 = {
        ...cipher2,
        archivedDate: new Date("2024-01-02"),
      };

      const items: VaultItem<CipherView>[] = [
        { cipher: archivedCipher1 as CipherView },
        { cipher: archivedCipher2 as CipherView },
      ];

      component["selection"].select(...items);

      expect(component.bulkUnarchiveAllowed).toBe(true);
    });

    it("returns false when any selected cipher has an organizationId", () => {
      const archivedCipher1: Partial<CipherView> = {
        ...cipher1,
        archivedDate: new Date("2024-01-01"),
        organizationId: undefined,
      };

      const archivedCipher2: Partial<CipherView> = {
        ...cipher2,
        archivedDate: new Date("2024-01-02"),
        organizationId: "org-1",
      };

      const items: VaultItem<CipherView>[] = [
        { cipher: archivedCipher1 as CipherView },
        { cipher: archivedCipher2 as CipherView },
      ];

      component["selection"].select(...items);

      expect(component.bulkUnarchiveAllowed).toBe(false);
    });

    it("returns false when any selected cipher is not archived", () => {
      const items: VaultItem<CipherView>[] = [
        { cipher: cipher1 as CipherView },
        { cipher: cipher2 as CipherView },
      ];

      component["selection"].select(...items);

      expect(component.bulkUnarchiveAllowed).toBe(false);
    });
  });
});
