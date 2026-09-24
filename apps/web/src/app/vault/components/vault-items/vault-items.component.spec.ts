import { SelectionModel } from "@angular/cdk/collections";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { TestBed } from "@angular/core/testing";
import { of, Subject } from "rxjs";

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
  RoutedVaultFilterService,
  RoutedVaultFilterModel,
  VaultBatchBarService,
  VaultCopyButtonsService,
  VaultItem,
} from "@bitwarden/vault";

import { VaultItemsComponent } from "./vault-items.component";

describe("VaultItemsComponent", () => {
  let component: VaultItemsComponent<CipherViewLike>;
  let filterSelect: Subject<RoutedVaultFilterModel>;
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
    filterSelect = new Subject<RoutedVaultFilterModel>();
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
          provide: RoutedVaultFilterService,
          useValue: {
            filter$: filterSelect,
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
      expect(component["optionsColumnWidthClass"](true, true)).toBe("tw-w-48");
    });

    it("reserves room for the combined copy and launch actions", () => {
      expect(component["optionsColumnWidthClass"](true, false)).toBe("tw-w-32");
    });

    it("only fits the options menu when there are no copy or launch actions", () => {
      expect(component["optionsColumnWidthClass"](false, false)).toBe("tw-w-24");
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
