import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  CollectionService,
  CollectionTypes,
  CollectionView,
} from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ToastService } from "@bitwarden/components";

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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: OrganizationService, useValue: mock<OrganizationService>({ organizations$ }) },
        { provide: CollectionService, useValue: mock<CollectionService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: AccountService, useValue: accountService },
        { provide: I18nService, useValue: { t: (...keys: string[]) => keys.join(" ") } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssignCollectionsComponent);
    component = fixture.componentInstance;
    component.params = params;
    fixture.detectChanges();
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
});
