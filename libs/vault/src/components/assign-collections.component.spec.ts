import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService, CollectionView } from "@bitwarden/admin-console/common";
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

  const editCollection = new CollectionView();
  editCollection.id = "collection-id" as CollectionId;
  editCollection.organizationId = "org-id" as OrganizationId;
  editCollection.name = "Editable Collection";
  editCollection.readOnly = false;
  editCollection.manage = true;

  const readOnlyCollection1 = new CollectionView();
  readOnlyCollection1.id = "read-only-collection-id" as CollectionId;
  readOnlyCollection1.organizationId = "org-id" as OrganizationId;
  readOnlyCollection1.name = "Read Only Collection";
  readOnlyCollection1.readOnly = true;

  const readOnlyCollection2 = new CollectionView();
  readOnlyCollection2.id = "read-only-collection-id-2" as CollectionId;
  readOnlyCollection2.organizationId = "org-id" as OrganizationId;
  readOnlyCollection2.name = "Read Only Collection 2";
  readOnlyCollection2.readOnly = true;

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
});
