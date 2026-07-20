import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import {
  CollectionAdminView,
  Unassigned,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { DialogService, SimpleDialogCloseType } from "@bitwarden/components";
import { All, RoutedVaultFilterModel } from "@bitwarden/vault";

import { CollectionDialogTabType } from "../../shared/components/collection-dialog";

import { VaultHeaderComponent } from "./vault-header.component";

describe("VaultHeaderComponent", () => {
  let fixture: ComponentFixture<VaultHeaderComponent>;
  let component: VaultHeaderComponent;

  let mockI18nService: MockProxy<I18nService>;
  let mockDialogService: MockProxy<DialogService>;
  let mockCollectionAdminService: MockProxy<CollectionAdminService>;
  let mockAccountService: ReturnType<typeof mockAccountServiceWith>;
  let router: Router;

  const userId = "test-user-id" as UserId;
  const orgId = "org-1" as any;

  function makeOrg(overrides: Partial<Organization> = {}): Organization {
    return {
      id: orgId,
      name: "Acme Corp",
      enabled: true,
      canCreateNewCollections: true,
      canEditAnyCollection: true,
      canDeleteAnyCollection: true,
      maxCollections: 5,
      productTierType: ProductTierType.Teams,
      isProviderUser: false,
      isMember: true,
      isAdmin: false,
      canEditSubscription: true,
      permissions: { editAnyCollection: false, manageUsers: false, manageGroups: false },
      ...overrides,
    } as unknown as Organization;
  }

  function makeCollection(
    name: string,
    overrides: Partial<CollectionAdminView> = {},
  ): CollectionAdminView {
    const col = new CollectionAdminView({ id: "col-1", organizationId: orgId, name });
    col.manage = true;
    col.assigned = true;
    Object.assign(col, overrides);
    return col;
  }

  function makeTreeNode(
    col: CollectionAdminView,
    parent?: TreeNode<CollectionAdminView>,
  ): TreeNode<CollectionAdminView> {
    return new TreeNode<CollectionAdminView>(col, parent as TreeNode<CollectionAdminView>);
  }

  function setInputs(overrides: {
    filter?: RoutedVaultFilterModel;
    organization?: Organization;
    collection?: TreeNode<CollectionAdminView> | undefined;
    loading?: boolean;
    searchText?: string;
  }) {
    const defaults = {
      filter: { organizationId: orgId } as RoutedVaultFilterModel,
      organization: makeOrg(),
      collection: undefined,
      loading: false,
      searchText: "",
    };
    const merged = { ...defaults, ...overrides };
    fixture.componentRef.setInput("filter", merged.filter);
    fixture.componentRef.setInput("organization", merged.organization);
    fixture.componentRef.setInput("collection", merged.collection);
    fixture.componentRef.setInput("loading", merged.loading);
    fixture.componentRef.setInput("searchText", merged.searchText);
  }

  beforeEach(async () => {
    mockI18nService = mock<I18nService>();
    mockDialogService = mock<DialogService>();
    mockCollectionAdminService = mock<CollectionAdminService>();
    mockAccountService = mockAccountServiceWith(userId);

    mockI18nService.t.mockImplementation((key: string, ...args: any[]) => {
      const map: Record<string, string> = {
        collections: "Collections",
        unassigned: "Unassigned",
        upgradeOrganization: "Upgrade Organization",
        freeOrgMaxCollectionReachedManageBilling: "Max collections reached (billing)",
        freeOrgMaxCollectionReachedNoManageBilling: "Max collections reached",
        upgrade: "Upgrade",
        ok: "Ok",
      };
      return map[key] ?? key;
    });

    await TestBed.configureTestingModule({
      imports: [VaultHeaderComponent],
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: mockI18nService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: CollectionAdminService, useValue: mockCollectionAdminService },
        { provide: AccountService, useValue: mockAccountService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(VaultHeaderComponent, {
        set: { template: "", imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(VaultHeaderComponent);
    component = fixture.componentInstance;
  });

  describe("title", () => {
    it("returns collection name when a collection is selected", () => {
      setInputs({ collection: makeTreeNode(makeCollection("Engineering")) });
      expect((component as any).title()).toBe("Engineering");
    });

    it("returns 'Unassigned' when filter.collectionId === Unassigned", () => {
      setInputs({ filter: { organizationId: orgId, collectionId: Unassigned } });
      expect((component as any).title()).toBe("Unassigned");
    });

    it("returns '<OrgName> collections' when at org root with a named org", () => {
      setInputs({ organization: makeOrg({ name: "Acme Corp" }) });
      expect((component as any).title()).toBe("Acme Corp collections");
    });

    it("returns 'Collections' when org has no name", () => {
      setInputs({ organization: makeOrg({ name: "" }) });
      expect((component as any).title()).toBe("Collections");
    });

    it("collection name takes priority over Unassigned filter", () => {
      setInputs({
        filter: { organizationId: orgId, collectionId: Unassigned },
        collection: makeTreeNode(makeCollection("Special")),
      });
      expect((component as any).title()).toBe("Special");
    });
  });

  describe("icon", () => {
    it("returns 'bwi-collection-shared' when a collectionId is set", () => {
      setInputs({ filter: { organizationId: orgId, collectionId: "col-1" as any } });
      expect((component as any).icon()).toBe("bwi-collection-shared");
    });

    it("returns empty string when no collectionId is set", () => {
      setInputs({ filter: { organizationId: orgId } });
      expect((component as any).icon()).toBe("");
    });
  });

  describe("showBreadcrumbs", () => {
    it("is true when collectionId is set and not All", () => {
      setInputs({ filter: { organizationId: orgId, collectionId: "col-1" as any } });
      expect((component as any).showBreadcrumbs()).toBe(true);
    });

    it("is false when collectionId is undefined", () => {
      setInputs({ filter: { organizationId: orgId } });
      expect((component as any).showBreadcrumbs()).toBe(false);
    });

    it("is false when collectionId equals All", () => {
      setInputs({ filter: { organizationId: orgId, collectionId: All } });
      expect((component as any).showBreadcrumbs()).toBe(false);
    });
  });

  describe("collections", () => {
    it("returns empty array when no collection is selected", () => {
      setInputs({});
      expect((component as any).collections()).toEqual([]);
    });

    it("returns empty array for a root-level collection (no parent)", () => {
      setInputs({ collection: makeTreeNode(makeCollection("Root")) });
      expect((component as any).collections()).toEqual([]);
    });

    it("returns ancestor chain excluding the selected collection", () => {
      const root = makeCollection("Root", { id: "root" as any });
      const child = makeCollection("Child", { id: "child" as any });
      const grandchild = makeCollection("Grandchild", { id: "grandchild" as any });

      const rootNode = makeTreeNode(root);
      const childNode = makeTreeNode(child, rootNode);
      const grandchildNode = makeTreeNode(grandchild, childNode);

      setInputs({ collection: grandchildNode });

      const breadcrumbs = (component as any).collections();
      expect(breadcrumbs).toHaveLength(2);
      expect(breadcrumbs[0]).toBe(root);
      expect(breadcrumbs[1]).toBe(child);
    });
  });

  describe("canEditCollection", () => {
    it("returns false when no collection is selected", () => {
      setInputs({ collection: undefined });
      expect((component as any).canEditCollection()).toBe(false);
    });

    it("returns true when org.canEditAnyCollection is true", () => {
      const col = makeCollection("Test");
      setInputs({
        collection: makeTreeNode(col),
        organization: makeOrg({ canEditAnyCollection: true }),
      });
      expect((component as any).canEditCollection()).toBe(true);
    });

    it("returns false when org.canEditAnyCollection is false and no manage permission", () => {
      const col = makeCollection("Test", { manage: false });
      setInputs({
        collection: makeTreeNode(col),
        organization: makeOrg({ canEditAnyCollection: false }),
      });
      expect((component as any).canEditCollection()).toBe(false);
    });
  });

  describe("canDeleteCollection", () => {
    it("returns false when no collection is selected", () => {
      setInputs({ collection: undefined });
      expect((component as any).canDeleteCollection()).toBe(false);
    });

    it("returns true when org.canDeleteAnyCollection is true", () => {
      const col = makeCollection("Test");
      setInputs({
        collection: makeTreeNode(col),
        organization: makeOrg({ canDeleteAnyCollection: true }),
      });
      expect((component as any).canDeleteCollection()).toBe(true);
    });

    it("returns false when org.canDeleteAnyCollection is false and no manage permission", () => {
      const col = makeCollection("Test", { manage: false });
      setInputs({
        collection: makeTreeNode(col),
        organization: makeOrg({ canDeleteAnyCollection: false }),
      });
      expect((component as any).canDeleteCollection()).toBe(false);
    });
  });

  describe("canViewCollectionInfo", () => {
    it("returns false when no collection is selected", () => {
      setInputs({ collection: undefined });
      expect((component as any).canViewCollectionInfo()).toBe(false);
    });

    it("returns true when collection.manage is true", () => {
      const col = makeCollection("Test", { manage: true });
      setInputs({ collection: makeTreeNode(col) });
      expect((component as any).canViewCollectionInfo()).toBe(true);
    });

    it("returns true when org.isAdmin is true", () => {
      const col = makeCollection("Test", { manage: false });
      setInputs({
        collection: makeTreeNode(col),
        organization: makeOrg({ isAdmin: true } as any),
      });
      expect((component as any).canViewCollectionInfo()).toBe(true);
    });

    it("returns false for unassigned pseudo-collection", () => {
      const col = new CollectionAdminView({
        id: Unassigned,
        organizationId: orgId,
        name: "Unassigned",
      });
      setInputs({ collection: makeTreeNode(col) });
      expect((component as any).canViewCollectionInfo()).toBe(false);
    });
  });

  describe("canCreateCollection", () => {
    it("returns true when org.canCreateNewCollections is true", () => {
      setInputs({ organization: makeOrg({ canCreateNewCollections: true }) });
      expect((component as any).canCreateCollection()).toBe(true);
    });

    it("returns false when org.canCreateNewCollections is false", () => {
      setInputs({ organization: makeOrg({ canCreateNewCollections: false }) });
      expect((component as any).canCreateCollection()).toBe(false);
    });
  });

  describe("canCreateCipher", () => {
    it("returns true for a regular org member", () => {
      setInputs({ organization: makeOrg({ isProviderUser: false, isMember: true }) });
      expect((component as any).canCreateCipher()).toBe(true);
    });

    it("returns false when user is a provider user and not a member", () => {
      setInputs({ organization: makeOrg({ isProviderUser: true, isMember: false }) });
      expect((component as any).canCreateCipher()).toBe(false);
    });

    it("returns true when user is a provider user AND also a member", () => {
      setInputs({ organization: makeOrg({ isProviderUser: true, isMember: true }) });
      expect((component as any).canCreateCipher()).toBe(true);
    });

    it("returns false when the organization is suspended (disabled)", () => {
      setInputs({
        organization: makeOrg({ enabled: false, isProviderUser: false, isMember: true }),
      });
      expect((component as any).canCreateCipher()).toBe(false);
    });
  });

  describe("handleAddCipher", () => {
    it("emits addCipher with the given CipherType", () => {
      setInputs({});
      const spy = jest.fn();
      component.addCipher.subscribe(spy);
      component.handleAddCipher(CipherType.Login);
      expect(spy).toHaveBeenCalledWith(CipherType.Login);
    });

    it("emits addCipher with undefined when no type provided", () => {
      setInputs({});
      const spy = jest.fn();
      component.addCipher.subscribe(spy);
      component.handleAddCipher();
      expect(spy).toHaveBeenCalledWith(undefined);
    });
  });

  describe("handleEditCollection", () => {
    it("emits editCollection with the given tab and readonly flag", async () => {
      setInputs({});
      const spy = jest.fn();
      component.editCollection.subscribe(spy);
      await component.handleEditCollection(CollectionDialogTabType.Info, false);
      expect(spy).toHaveBeenCalledWith({ tab: CollectionDialogTabType.Info, readonly: false });
    });

    it("emits editCollection in readonly mode", async () => {
      setInputs({});
      const spy = jest.fn();
      component.editCollection.subscribe(spy);
      await component.handleEditCollection(CollectionDialogTabType.Access, true);
      expect(spy).toHaveBeenCalledWith({ tab: CollectionDialogTabType.Access, readonly: true });
    });
  });

  describe("handleDeleteCollection", () => {
    it("emits deleteCollection", () => {
      setInputs({});
      const spy = jest.fn();
      component.deleteCollection.subscribe(spy);
      component.handleDeleteCollection();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe("onSearchTextChanged", () => {
    it("emits searchTextChanged with the provided text", () => {
      setInputs({});
      const spy = jest.fn();
      component.searchTextChanged.subscribe(spy);
      component.onSearchTextChanged("hello");
      expect(spy).toHaveBeenCalledWith("hello");
    });
  });

  describe("handleAddCollection", () => {
    it("emits addCollection immediately for a non-free org", async () => {
      setInputs({ organization: makeOrg({ productTierType: ProductTierType.Teams }) });
      const spy = jest.fn();
      component.addCollection.subscribe(spy);
      await component.handleAddCollection();
      expect(spy).toHaveBeenCalled();
      expect(mockDialogService.openSimpleDialogRef).not.toHaveBeenCalled();
    });

    it("emits addCollection when free org has room for more collections", async () => {
      mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
        of([makeCollection("Col1"), makeCollection("Col2")]),
      );
      mockAccountService.activeAccountSubject.next({
        id: userId,
        email: "test@example.com",
        name: "Test",
        emailVerified: true,
      });

      setInputs({
        organization: makeOrg({
          productTierType: ProductTierType.Free,
          maxCollections: 5,
        }),
      });

      const spy = jest.fn();
      component.addCollection.subscribe(spy);
      await component.handleAddCollection();
      expect(spy).toHaveBeenCalled();
    });

    it("shows upgrade dialog and does NOT emit addCollection when free org is at limit", async () => {
      const col1 = makeCollection("Col1", { id: "c1" as any });
      const col2 = makeCollection("Col2", { id: "c2" as any });
      mockCollectionAdminService.collectionAdminViews$.mockReturnValue(of([col1, col2]));
      mockAccountService.activeAccountSubject.next({
        id: userId,
        email: "test@example.com",
        name: "Test",
        emailVerified: true,
      });

      const closedSubject = new BehaviorSubject<SimpleDialogCloseType | undefined>(undefined);
      mockDialogService.openSimpleDialogRef.mockReturnValue({
        closed: closedSubject.asObservable(),
      } as any);

      setInputs({
        organization: makeOrg({
          productTierType: ProductTierType.Free,
          maxCollections: 2,
          canEditSubscription: false,
        }),
      });

      const spy = jest.fn();
      component.addCollection.subscribe(spy);

      const promise = component.handleAddCollection();
      closedSubject.next(false as any);
      await promise;

      expect(mockDialogService.openSimpleDialogRef).toHaveBeenCalled();
      expect(spy).not.toHaveBeenCalled();
    });

    it("navigates to billing when free org owner accepts upgrade dialog", async () => {
      const col1 = makeCollection("Col1", { id: "c1" as any });
      const col2 = makeCollection("Col2", { id: "c2" as any });
      mockCollectionAdminService.collectionAdminViews$.mockReturnValue(of([col1, col2]));
      mockAccountService.activeAccountSubject.next({
        id: userId,
        email: "test@example.com",
        name: "Test",
        emailVerified: true,
      });

      const closedSubject = new BehaviorSubject<SimpleDialogCloseType | undefined>(undefined);
      mockDialogService.openSimpleDialogRef.mockReturnValue({
        closed: closedSubject.asObservable(),
      } as any);
      const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);

      setInputs({
        organization: makeOrg({
          productTierType: ProductTierType.Free,
          maxCollections: 2,
          canEditSubscription: true,
        }),
      });

      const promise = component.handleAddCollection();
      closedSubject.next(true as any);
      await promise;

      expect(navigateSpy).toHaveBeenCalledWith(
        ["/organizations", orgId, "billing", "subscription"],
        { queryParams: { upgrade: true } },
      );
    });
  });
});
