import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  CollectionView,
  CollectionTypes,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BitSubmitDirective,
  ButtonComponent,
  SelectItemView,
  ToastService,
} from "@bitwarden/components";

import { Vfo1TerminologyService } from "../services/vfo1-terminology.service";

import {
  AssignCollectionsComponent,
  CollectionAssignmentParams,
} from "./assign-collections.component";

describe("AssignCollectionsComponent", () => {
  let component: AssignCollectionsComponent;
  let fixture: ComponentFixture<AssignCollectionsComponent>;

  const mockUserId = "mock-user-id" as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);

  const editCollection = new CollectionView({
    id: "collection-id" as CollectionId,
    organizationId: "org-id" as OrganizationId,
    name: "Editable Collection",
  });
  editCollection.readOnly = false;
  editCollection.manage = true;

  const readOnlyCollection1 = new CollectionView({
    id: "read-only-collection-id" as CollectionId,
    organizationId: "org-id" as OrganizationId,
    name: "Read Only Collection",
  });
  readOnlyCollection1.readOnly = true;

  const readOnlyCollection2 = new CollectionView({
    id: "read-only-collection-id-2" as CollectionId,
    organizationId: "org-id" as OrganizationId,
    name: "Read Only Collection 2",
  });
  readOnlyCollection2.readOnly = true;

  const sharedCollection = new CollectionView({
    id: "shared-collection-id" as CollectionId,
    organizationId: "org-id" as OrganizationId,
    name: "Shared Collection",
  });
  sharedCollection.readOnly = false;
  sharedCollection.assigned = true;
  sharedCollection.type = CollectionTypes.SharedCollection;

  const defaultCollection = new CollectionView({
    id: "default-collection-id" as CollectionId,
    organizationId: "org-id" as OrganizationId,
    name: "Default Collection",
  });
  defaultCollection.readOnly = false;
  defaultCollection.manage = true;
  defaultCollection.type = CollectionTypes.DefaultUserCollection;

  const params = {
    organizationId: "org-id" as OrganizationId,
    ciphers: [
      {
        id: "cipher-id",
        name: "Cipher Name",
        collectionIds: [readOnlyCollection1.id],
        edit: true,
      } as unknown as CipherView,
    ],
    availableCollections: [editCollection, readOnlyCollection1, readOnlyCollection2],
  } as CollectionAssignmentParams;

  const org = {
    id: "org-id",
    name: "Test Org",
    productTierType: ProductTierType.Enterprise,
  } as Organization;

  const organizations$ = jest.fn().mockReturnValue(of([org]));

  let toastService: MockProxy<ToastService>;

  async function setup(vfo1Enabled = false) {
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(vfo1Enabled));

    toastService = mock<ToastService>();

    await TestBed.configureTestingModule({
      providers: [
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: OrganizationService, useValue: mock<OrganizationService>({ organizations$ }) },
        { provide: CollectionService, useValue: mock<CollectionService>() },
        { provide: ToastService, useValue: toastService },
        { provide: AccountService, useValue: accountService },
        { provide: I18nService, useValue: { t: (...keys: string[]) => keys.join(" ") } },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: Vfo1TerminologyService,
          useValue: { iconClass: (icon: string) => icon, enabled: () => vfo1Enabled },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssignCollectionsComponent);
    component = fixture.componentInstance;
    component.params = params;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await setup(false);
  });

  describe("read only collections", () => {
    beforeEach(async () => {
      await component.ngOnInit();
      fixture.detectChanges();
    });

    it("shows read-only hint for assigned collections", () => {
      const hint = fixture.debugElement.query(By.css('[data-testid="view-only-hint"]'));

      expect(hint.nativeElement.textContent.trim()).toBe(
        "cannotRemoveViewOnlyCollections Read Only Collection",
      );
    });

    it("does not show read only collections in the list", () => {
      expect(component["availableCollections"]).toEqual([
        {
          icon: "bwi-collection-shared",
          id: editCollection.id,
          labelName: editCollection.name,
          listName: editCollection.name,
        },
      ]);
    });
  });

  describe("default collections", () => {
    const cipher1 = new CipherView();
    cipher1.id = "cipher-id-1";
    cipher1.collectionIds = [editCollection.id, sharedCollection.id];
    cipher1.edit = true;

    const cipher2 = new CipherView();
    cipher2.id = "cipher-id-2";
    cipher2.collectionIds = [defaultCollection.id];
    cipher2.edit = true;

    const cipher3 = new CipherView();
    cipher3.id = "cipher-id-3";
    cipher3.collectionIds = [defaultCollection.id];
    cipher3.edit = true;

    const cipher4 = new CipherView();
    cipher4.id = "cipher-id-4";
    cipher4.collectionIds = [];
    cipher4.edit = true;

    it('does not show the "Default Collection" if any cipher is in a shared collection', async () => {
      component.params = {
        ...component.params,
        ciphers: [cipher1, cipher2],
        availableCollections: [editCollection, sharedCollection, defaultCollection],
      };

      await component.ngOnInit();
      fixture.detectChanges();

      expect(component["availableCollections"].map((c) => c.id)).toEqual([
        editCollection.id,
        sharedCollection.id,
      ]);
    });

    it('shows the "Default Collection" if no ciphers are in a shared collection', async () => {
      component.params = {
        ...component.params,
        ciphers: [cipher2, cipher3],
        availableCollections: [editCollection, sharedCollection, defaultCollection],
      };

      await component.ngOnInit();
      fixture.detectChanges();

      expect(component["availableCollections"].map((c) => c.id)).toEqual([
        editCollection.id,
        sharedCollection.id,
        defaultCollection.id,
      ]);
    });

    it('shows the "Default Collection" for singular cipher', async () => {
      component.params = {
        ...component.params,
        ciphers: [cipher4],
        availableCollections: [readOnlyCollection1, sharedCollection, defaultCollection],
      };

      await component.ngOnInit();
      fixture.detectChanges();

      expect(component["availableCollections"].map((c) => c.id)).toEqual([
        sharedCollection.id,
        defaultCollection.id,
      ]);
    });
  });

  describe("getOrgIcon", () => {
    it.each([
      [ProductTierType.Free, "bwi-family"],
      [ProductTierType.Families, "bwi-family"],
      [ProductTierType.Teams, "bwi-business"],
      [ProductTierType.Enterprise, "bwi-business"],
      [ProductTierType.TeamsStarter, "bwi-business"],
    ])("returns the correct icon for product tier %s", (tier, icon) => {
      expect(component["getOrgIcon"]({ productTierType: tier } as Organization)).toBe(icon);
    });

    it("defaults to bwi-business for an unknown product tier", () => {
      expect(
        component["getOrgIcon"]({ productTierType: 99 as ProductTierType } as Organization),
      ).toBe("bwi-business");
    });
  });

  describe("transferWarningSegments", () => {
    it("splits the plural sentence around the org name so it can be italicized", () => {
      expect(component["transferWarningSegments"]("Acme", 3)).toEqual({
        italicize: true,
        before: "personalItemsWithOrgTransferWarningPlural 3 ",
        orgName: "Acme",
        after: "",
      });
    });

    it("splits the singular sentence around the org name so it can be italicized", () => {
      expect(component["transferWarningSegments"]("Acme", 1)).toEqual({
        italicize: true,
        before: "personalItemWithOrgTransferWarningSingular ",
        orgName: "Acme",
        after: "",
      });
    });

    it("returns a single plain segment when there is no org name", () => {
      expect(component["transferWarningSegments"]("", 3)).toEqual({
        italicize: false,
        text: "personalItemsTransferWarningPlural 3",
      });
    });
  });

  describe("submit button disablement", () => {
    it("disables the submit button while the form is invalid and re-enables it when valid", () => {
      const disabledSet = jest.fn();
      component.submitBtn = {
        disabled: { set: disabledSet },
        loading: { set: jest.fn() },
      } as unknown as ButtonComponent;

      const disabled$ = new BehaviorSubject(false);
      component["bitSubmit"] = {
        disabled$,
        loading$: new BehaviorSubject(false),
      } as unknown as BitSubmitDirective;

      component.ngAfterViewInit();

      // The form starts invalid because no collections are selected.
      expect(disabledSet).toHaveBeenLastCalledWith(true);

      // Selecting a collection makes the form valid.
      component.formGroup.patchValue({ collections: [{ id: "c1" } as SelectItemView] });
      expect(disabledSet).toHaveBeenLastCalledWith(false);

      // A disabling signal from bitSubmit re-disables the button even when the form is valid.
      disabled$.next(true);
      expect(disabledSet).toHaveBeenLastCalledWith(true);
    });
  });

  describe("vault terminology disabled", () => {
    it("transferWarningText uses the org-name keys when an org name is present", () => {
      expect(component["transferWarningText"]("Acme", 3)).toBe(
        "personalItemsWithOrgTransferWarningPlural 3 Acme",
      );
      expect(component["transferWarningText"]("Acme", 1)).toBe(
        "personalItemWithOrgTransferWarningSingular Acme",
      );
    });

    it("transferWarningText uses the collection keys when no org name is present", () => {
      expect(component["transferWarningText"]("", 3)).toBe("personalItemsTransferWarningPlural 3");
      expect(component["transferWarningText"]("", 1)).toBe("personalItemTransferWarningSingular");
    });

    it("submitButtonText returns the assign label regardless of the personal item count", () => {
      component["personalItemsCount"] = 1;
      expect(component["submitButtonText"]).toBe("assign");

      component["personalItemsCount"] = 0;
      expect(component["submitButtonText"]).toBe("assign");
    });

    it("emits the assign submit button text on init", async () => {
      const emitted: string[] = [];
      component.submitButtonTextChange.subscribe((text) => emitted.push(text));

      await component.ngOnInit();

      expect(emitted).toContain("assign");
    });

    it.each([
      [1, 1, "itemMovedToCollection"],
      [1, 2, "itemMovedToCollections"],
      [2, 1, "itemsMovedToCollection"],
      [2, 2, "itemsMovedToCollections"],
    ])(
      "collectionAssignmentToastKey maps %i ciphers / %i collections to %s",
      (ciphers, collections, key) => {
        expect(component["collectionAssignmentToastKey"](ciphers, collections)).toBe(key);
      },
    );

    it("moveToOrganization falls back to the organization label when no org name is resolved", async () => {
      component["orgName"] = undefined;

      await component["moveToOrganization"](
        "org-id" as OrganizationId,
        [{ id: "c1" } as CipherView],
        [],
        mockUserId,
      );

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "itemMovedToOrg organization" }),
      );
    });
  });

  describe("vault terminology enabled", () => {
    beforeEach(async () => {
      TestBed.resetTestingModule();
      await setup(true);
    });

    it("transferWarningText uses the vault keys when no org name is present", () => {
      expect(component["transferWarningText"]("", 3)).toBe(
        "personalItemsVaultTransferWarningPlural 3",
      );
      expect(component["transferWarningText"]("", 1)).toBe(
        "personalItemVaultTransferWarningSingular",
      );
    });

    it("transferWarningText still uses the org-name keys when an org name is present", () => {
      expect(component["transferWarningText"]("Acme", 3)).toBe(
        "personalItemsWithOrgTransferWarningPlural 3 Acme",
      );
      expect(component["transferWarningText"]("Acme", 1)).toBe(
        "personalItemWithOrgTransferWarningSingular Acme",
      );
    });

    it("submitButtonText returns the add label when there are no personal items to transfer", () => {
      component["personalItemsCount"] = 0;
      expect(component["submitButtonText"]).toBe("add");
    });

    it("submitButtonText returns the transfer-and-add label when there are personal items to transfer", () => {
      component["personalItemsCount"] = 1;
      expect(component["submitButtonText"]).toBe("transferAndAdd");
    });

    it("emits the transfer-and-add submit button text on init", async () => {
      const emitted: string[] = [];
      component.submitButtonTextChange.subscribe((text) => emitted.push(text));

      await component.ngOnInit();

      expect(emitted).toContain("transferAndAdd");
    });

    it.each([
      [1, 1, "itemAddedToSharedFolder"],
      [1, 2, "itemAddedToSharedFolders"],
      [2, 1, "itemsAddedToSharedFolder"],
      [2, 2, "itemsAddedToSharedFolders"],
    ])(
      "collectionAssignmentToastKey maps %i ciphers / %i collections to %s",
      (ciphers, collections, key) => {
        expect(component["collectionAssignmentToastKey"](ciphers, collections)).toBe(key);
      },
    );

    it("moveToOrganization falls back to the vault label when no org name is resolved", async () => {
      component["orgName"] = undefined;

      await component["moveToOrganization"](
        "org-id" as OrganizationId,
        [{ id: "c1" } as CipherView],
        [],
        mockUserId,
      );

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "itemMovedToOrg vault" }),
      );
    });
  });
});
