import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, ParamMap } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { DialogRef, DialogService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  AddItemDialogComponent,
  AddItemDialogResult,
  CipherRowMenuHandlers,
  CipherRowMenuService,
  ARCHIVE_ROUTE,
  MY_VAULT_ROUTE,
  TRASH_ROUTE,
  VaultCopyButtonsService,
  VaultNavItemType,
  VaultNavItemViewModel,
  VaultNavService,
  VaultsNavViewModel,
} from "@bitwarden/vault";

import { WebVaultItemActionsService } from "../services/vault-item-actions.service";

import { VaultNextComponent } from "./vault-next.component";

describe("VaultNextComponent", () => {
  const userId = "user-1" as UserId;
  const organizationId = "1b2c3d4e-5f60-4a1b-8c2d-3e4f5a6b7c8d" as OrganizationId;
  const otherOrganizationId = "9a8b7c6d-5e4f-4a3b-8c2d-1e2f3a4b5c6d" as OrganizationId;

  // The `:collectionId` segment only names a guid, so the shared folders the drill-in tests use
  // need real ones rather than readable stand-ins.
  const designId = "aaaa2222-bbbb-4ccc-8ddd-eeee11112222" as CollectionId;
  const engineeringId = "aaaa3333-bbbb-4ccc-8ddd-eeee11112222" as CollectionId;
  const platformId = "aaaa4444-bbbb-4ccc-8ddd-eeee11112222" as CollectionId;

  let fixture: ComponentFixture<VaultNextComponent>;
  let itemActions: MockProxy<WebVaultItemActionsService>;
  let cipherRowMenuService: MockProxy<CipherRowMenuService>;
  let restrictedItemTypesService: MockProxy<RestrictedItemTypesService>;
  let addItemDialogOpen: jest.SpyInstance;

  let ciphers$: Subject<CipherView[] | null>;
  let folders$: BehaviorSubject<FolderView[]>;
  let collections$: BehaviorSubject<CollectionView[]>;
  let organizations$: BehaviorSubject<Organization[]>;
  let showQuickCopyActions$: BehaviorSubject<boolean>;
  let paramMap$: BehaviorSubject<ParamMap>;
  let vaultNav$: BehaviorSubject<VaultsNavViewModel>;

  const buildCipher = (overrides: Partial<CipherView> = {}) => {
    const cipher = new CipherView();
    cipher.id = "cipher-1";
    cipher.name = "Item";
    cipher.type = CipherType.Login;
    cipher.edit = true;
    cipher.favorite = false;
    cipher.reprompt = CipherRepromptType.None;
    return Object.assign(cipher, overrides);
  };

  const buildCipherFixture = (id: string, cipherOrganizationId?: OrganizationId) => {
    const cipher = buildCipher({ id });
    cipher.organizationId = cipherOrganizationId ?? null;
    return cipher;
  };

  const buildCollection = (id: string, collectionOrganizationId: OrganizationId) =>
    new CollectionView({
      id: id as CollectionId,
      organizationId: collectionOrganizationId,
      name: id,
    });

  const buildOrganization = (id: OrganizationId, name: string) => ({ id, name }) as Organization;

  const personalNavItem: VaultNavItemViewModel = {
    id: userId,
    label: "myVault",
    color: "purple",
    icon: "bwi-user",
    type: VaultNavItemType.Personal,
  };

  const buildOrgNavItem = (id: OrganizationId, label: string): VaultNavItemViewModel => ({
    id,
    label,
    color: "purple",
    icon: "bwi-business",
    type: VaultNavItemType.Organization,
  });

  /**
   * Navigates the page to a vault scope, as the `:vaultId` and `:collectionId` route segments
   * would.
   */
  const scopeTo = (vaultId?: string, collectionId?: string) => {
    paramMap$.next(
      convertToParamMap({
        ...(vaultId == null ? {} : { vaultId }),
        ...(collectionId == null ? {} : { collectionId }),
      }),
    );
    fixture.detectChanges();
  };

  const buildFolder = (id: string, name: string) => {
    const folder = new FolderView();
    folder.id = id;
    folder.name = name;
    return folder;
  };

  /**
   * The child components are stripped from the harness (see `overrideComponent` below) so this suite
   * stays small, which means assertions read the signals the template binds rather than the
   * rendered table. The bindings themselves are covered by the Angular template type-check.
   */
  const component = () => fixture.componentInstance as any;

  /** The row menu handlers the component hands `CipherRowMenuService`. */
  const handlers = (): CipherRowMenuHandlers<CipherView> => {
    component().rowActions();
    return cipherRowMenuService.getRowActions.mock.calls.at(-1)![1];
  };

  beforeEach(async () => {
    ciphers$ = new Subject<CipherView[] | null>();
    folders$ = new BehaviorSubject<FolderView[]>([]);
    collections$ = new BehaviorSubject<CollectionView[]>([]);
    organizations$ = new BehaviorSubject<Organization[]>([]);
    showQuickCopyActions$ = new BehaviorSubject<boolean>(false);
    paramMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    // The multi-vault shape, matching the organizations most of this suite sets up.
    vaultNav$ = new BehaviorSubject<VaultsNavViewModel>({
      vaults: [
        personalNavItem,
        buildOrgNavItem(organizationId, "Acme corporation"),
        buildOrgNavItem(otherOrganizationId, "Other organization"),
      ],
      organizationDataOwnership: false,
    });

    itemActions = mock<WebVaultItemActionsService>();

    cipherRowMenuService = mock<CipherRowMenuService>();
    cipherRowMenuService.getRowActions.mockReturnValue([]);

    restrictedItemTypesService = mock<RestrictedItemTypesService>();
    // `restricted$` is readonly on the service, so it can't be assigned onto the mock.
    Object.defineProperty(restrictedItemTypesService, "restricted$", { value: of([]) });
    restrictedItemTypesService.isCipherRestricted.mockReturnValue(false);

    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: userId } as Account);

    const cipherService = mock<CipherService>();
    cipherService.cipherListViews$.mockReturnValue(ciphers$ as never);

    const folderService = mock<FolderService>();
    folderService.folderViews$.mockReturnValue(folders$);

    const collectionService = mock<CollectionService>();
    collectionService.decryptedCollections$.mockReturnValue(collections$);

    // Needed only by the projected toolbar button's i18n pipe.
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    const organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(organizations$);

    const copyButtonsService = mock<VaultCopyButtonsService>();
    // `showQuickCopyActions$` is readonly on the service, so it can't be assigned onto the mock.
    Object.defineProperty(copyButtonsService, "showQuickCopyActions$", {
      value: showQuickCopyActions$,
    });

    addItemDialogOpen = jest
      .spyOn(AddItemDialogComponent, "open")
      .mockReturnValue({ closed: of(undefined) } as unknown as DialogRef<never>);

    await TestBed.configureTestingModule({
      imports: [VaultNextComponent],
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$ } },
        { provide: CipherRowMenuService, useValue: cipherRowMenuService },
        { provide: CipherService, useValue: cipherService },
        { provide: CollectionService, useValue: collectionService },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: FolderService, useValue: folderService },
        { provide: I18nService, useValue: i18nService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: RestrictedItemTypesService, useValue: restrictedItemTypesService },
        { provide: VaultCopyButtonsService, useValue: copyButtonsService },
        { provide: VaultNavService, useValue: { viewModel$: () => vaultNav$ } },
      ],
    })
      .overrideComponent(VaultNextComponent, {
        set: {
          // The child components pull in their own dependency trees (the header needs a router, the
          // table needs search and copy services), so NO_ERRORS_SCHEMA stands in for them. It has to
          // be declared here rather than on the TestBed module — a standalone component resolves
          // schemas from its own metadata. The i18n pipe stays, since a schema does not cover an
          // unresolved pipe.
          imports: [I18nPipe],
          schemas: [NO_ERRORS_SCHEMA],
          providers: [{ provide: WebVaultItemActionsService, useValue: itemActions }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(VaultNextComponent);
    fixture.detectChanges();
  });

  describe("ciphers", () => {
    it("is loading until the ciphers stream emits", () => {
      expect(component().loading()).toBe(true);

      ciphers$.next([buildCipher()]);
      fixture.detectChanges();

      expect(component().loading()).toBe(false);
    });

    it("ignores the null emitted before the first decrypt", () => {
      ciphers$.next(null);
      fixture.detectChanges();

      expect(component().loading()).toBe(true);
      expect(component().ciphers()).toEqual([]);
    });

    it("excludes trashed, archived, and restricted items", () => {
      const visible = buildCipher({ id: "visible" });
      const trashed = buildCipher({ id: "trashed", deletedDate: new Date() });
      const archived = buildCipher({ id: "archived", archivedDate: new Date() });
      const restricted = buildCipher({ id: "restricted" });

      restrictedItemTypesService.isCipherRestricted.mockImplementation(
        (cipher) => cipher.id === "restricted",
      );

      ciphers$.next([visible, trashed, archived, restricted]);
      fixture.detectChanges();

      expect(
        component()
          .ciphers()
          .map((c: CipherView) => c.id),
      ).toEqual(["visible"]);
    });

    it("excludes restricted items from every scope, trash and archive included", () => {
      const restricted = buildCipher({ id: "restricted", deletedDate: new Date() });

      restrictedItemTypesService.isCipherRestricted.mockReturnValue(true);

      ciphers$.next([restricted]);
      paramMap$.next(convertToParamMap({ vaultId: TRASH_ROUTE }));
      fixture.detectChanges();

      expect(component().ciphers()).toEqual([]);
    });
  });

  describe("vault scope", () => {
    const personal = buildCipherFixture("personal");
    const inOrg = buildCipherFixture("in-org", organizationId);
    const inOtherOrg = buildCipherFixture("in-other-org", otherOrganizationId);
    const trashedPersonal = buildCipher({ id: "trashed-personal", deletedDate: new Date() });
    const trashedInOrg = Object.assign(buildCipherFixture("trashed-in-org", organizationId), {
      deletedDate: new Date(),
    });
    const archivedPersonal = buildCipher({ id: "archived-personal", archivedDate: new Date() });
    const archivedInOrg = Object.assign(buildCipherFixture("archived-in-org", organizationId), {
      archivedDate: new Date(),
    });

    const orgCollection = buildCollection("org-collection", organizationId);
    const otherOrgCollection = buildCollection("other-org-collection", otherOrganizationId);

    const organization = buildOrganization(organizationId, "Acme corporation");
    const otherOrganization = buildOrganization(otherOrganizationId, "Smith family");

    const rowIds = () =>
      component()
        .ciphers()
        .map((cipher: CipherView) => cipher.id);
    const collectionIds = () =>
      component()
        .scopedCollections()
        .map((collection: CollectionView) => collection.id);
    const organizationIds = () =>
      component()
        .scopedOrganizations()
        .map((organization: Organization) => organization.id);

    beforeEach(() => {
      ciphers$.next([
        personal,
        inOrg,
        inOtherOrg,
        trashedPersonal,
        trashedInOrg,
        archivedPersonal,
        archivedInOrg,
      ]);
      collections$.next([orgCollection, otherOrgCollection]);
      organizations$.next([organization, otherOrganization]);
      fixture.detectChanges();
    });

    describe("with no route segment", () => {
      it("shows every vault's active items, collections, and organizations", () => {
        expect(rowIds()).toEqual(["personal", "in-org", "in-other-org"]);
        expect(collectionIds()).toEqual(["org-collection", "other-org-collection"]);
        expect(organizationIds()).toEqual([organizationId, otherOrganizationId]);
      });

      it("leaves the search index unscoped and the header on its route title", () => {
        expect(component().scopedOrganizationId()).toBeUndefined();
        expect(component().title()).toBeUndefined();
      });

      it("offers Import and New item", () => {
        expect(component().showItemCreation()).toBe(true);
        expect(creationActions().every((el) => el != null)).toBe(true);
      });

      describe("for an account whose only vault is personal", () => {
        beforeEach(() => {
          vaultNav$.next({ vaults: [personalNavItem], organizationDataOwnership: false });
          fixture.detectChanges();
        });

        // The nav links such an account's one entry here, so the two are the same destination and
        // anything branching on the scope type has to see them as one.
        it("resolves to the personal vault scope", () => {
          expect(component().vaultScope()).toEqual({ type: "myVault" });
          expect(component().title()).toBe("myVault");
        });
      });

      // The account has one vault, but the nav gives it no unscoped entry to name.
      describe("for an account narrowed to one organization by data ownership", () => {
        beforeEach(() => {
          vaultNav$.next({
            vaults: [buildOrgNavItem(organizationId, "Acme corporation")],
            organizationDataOwnership: true,
          });
          fixture.detectChanges();
        });

        it("stays on All items, with the header on its route title", () => {
          expect(component().vaultScope()).toEqual({ type: "allItems" });
          expect(component().title()).toBeUndefined();
        });
      });
    });

    describe("scoped to the personal vault", () => {
      beforeEach(() => scopeTo(MY_VAULT_ROUTE));

      it("shows only individually owned items", () => {
        expect(rowIds()).toEqual(["personal"]);
      });

      it("offers no shared folders or vaults, which the personal vault has none of", () => {
        expect(collectionIds()).toEqual([]);
        expect(organizationIds()).toEqual([]);
        expect(component().scopedOrganizationId()).toBeUndefined();
      });

      it("titles the header My vault", () => {
        expect(component().title()).toBe("myVault");
      });

      it("still offers Import and New item", () => {
        expect(component().showItemCreation()).toBe(true);
      });
    });

    /** The toolbar's Import button and New item menu, as rendered. */
    const creationActions = () => [
      fixture.nativeElement.querySelector("#vault-next_button_import"),
      fixture.nativeElement.querySelector("vault-new-cipher-menu"),
    ];

    describe("scoped to trash", () => {
      beforeEach(() => scopeTo(TRASH_ROUTE));

      it("shows trashed items from every vault", () => {
        expect(rowIds()).toEqual(["trashed-personal", "trashed-in-org"]);
      });

      it("keeps the shared folders and vaults of every vault, the way All items does", () => {
        expect(collectionIds()).toEqual(["org-collection", "other-org-collection"]);
        expect(organizationIds()).toEqual([organizationId, otherOrganizationId]);
        expect(component().scopedOrganizationId()).toBeUndefined();
      });

      it("titles the header Trash", () => {
        expect(component().title()).toBe("trash");
      });

      it("offers no way to add an item to it", () => {
        expect(component().showItemCreation()).toBe(false);
        expect(creationActions()).toEqual([null, null]);
      });
    });

    describe("scoped to the archive", () => {
      beforeEach(() => scopeTo(ARCHIVE_ROUTE));

      it("shows archived items from every vault", () => {
        expect(rowIds()).toEqual(["archived-personal", "archived-in-org"]);
      });

      it("keeps the shared folders and vaults of every vault, the way All items does", () => {
        expect(collectionIds()).toEqual(["org-collection", "other-org-collection"]);
        expect(organizationIds()).toEqual([organizationId, otherOrganizationId]);
      });

      it("titles the header Archive", () => {
        expect(component().title()).toBe("archiveNoun");
      });

      it("offers no way to add an item to it", () => {
        expect(component().showItemCreation()).toBe(false);
        expect(creationActions()).toEqual([null, null]);
      });
    });

    describe("scoped to an organization vault", () => {
      beforeEach(() => scopeTo(organizationId));

      it("shows only that organization's items", () => {
        expect(rowIds()).toEqual(["in-org"]);
      });

      it("narrows the shared folders and vaults to that organization", () => {
        expect(collectionIds()).toEqual(["org-collection"]);
        expect(organizationIds()).toEqual([organizationId]);
      });

      it("scopes the table's search index to that organization", () => {
        expect(component().scopedOrganizationId()).toBe(organizationId);
      });

      it("titles the header with the organization name", () => {
        expect(component().title()).toBe("Acme corporation");
      });
    });

    it("falls back to every active item when the segment names no destination", () => {
      scopeTo("acme-corp");

      expect(rowIds()).toEqual(["personal", "in-org", "in-other-org"]);
    });

    it("re-scopes when the route changes without leaving the page", () => {
      scopeTo(organizationId);
      expect(rowIds()).toEqual(["in-org"]);

      scopeTo(MY_VAULT_ROUTE);
      expect(rowIds()).toEqual(["personal"]);

      scopeTo(TRASH_ROUTE);
      expect(rowIds()).toEqual(["trashed-personal", "trashed-in-org"]);
    });

    it("keeps the banners and onboarding on the account's active items across every vault", () => {
      scopeTo(MY_VAULT_ROUTE);

      expect(
        component()
          .activeCiphers()
          .map((cipher: CipherView) => cipher.id),
      ).toEqual(["personal", "in-org", "in-other-org"]);
      expect(component().organizations()).toEqual([organization, otherOrganization]);
    });

    it("assigns to collections from every vault, not just the scoped one", async () => {
      scopeTo(MY_VAULT_ROUTE);

      await handlers().assignToCollections(personal);

      expect(itemActions.assignToCollections).toHaveBeenCalledWith(personal, [
        orgCollection,
        otherOrgCollection,
      ]);
    });
  });

  describe("filter option inputs", () => {
    it("drops the empty-id pseudo-folder that folderViews$ appends", () => {
      folders$.next([buildFolder("folder-1", "Work"), buildFolder("", "No folder")]);
      fixture.detectChanges();

      expect(
        component()
          .folders()
          .map((f: FolderView) => f.id),
      ).toEqual(["folder-1"]);
    });

    it("passes collections and organizations through to the table", () => {
      const collection = { id: "collection-1" } as CollectionView;
      const organization = { id: "org-1" } as Organization;

      collections$.next([collection]);
      organizations$.next([organization]);
      fixture.detectChanges();

      expect(component().collections()).toEqual([collection]);
      expect(component().organizations()).toEqual([organization]);
    });

    it("maps the user's quick-copy-actions preference to the table's copy presentation", () => {
      expect(component().copyPresentation()).toBe("collapsed");

      showQuickCopyActions$.next(true);
      fixture.detectChanges();

      expect(component().copyPresentation()).toBe("expanded");
    });
  });

  describe("scoped collections", () => {
    const collection = (id: CollectionId, name: string) =>
      new CollectionView({ id, organizationId, name });

    const engineering = collection(engineeringId, "Departments/Engineering");
    const platform = collection(platformId, "Departments/Engineering/Platform");
    const design = collection(designId, "Departments/Design");

    beforeEach(() => {
      collections$.next([design, engineering, platform]);
      fixture.detectChanges();
    });

    it("offers the collections of the vault the page is scoped to", () => {
      scopeTo(organizationId);

      expect(component().scopedCollections()).toEqual([design, engineering, platform]);
    });

    // An item belongs to as many shared folders as it was assigned to, so a row in the folder being
    // viewed may live in others too — the column has to be able to name them, and the chip to
    // offer them.
    it("keeps the whole vault on offer once the route drills into a folder", () => {
      scopeTo(organizationId, engineeringId);

      expect(component().scopedCollections()).toEqual([design, engineering, platform]);
    });
  });

  describe("rows for a shared folder", () => {
    it("keeps only the drilled-into folder's items", () => {
      const inFolder = buildCipher({ id: "in-folder", collectionIds: [engineeringId] });
      const inChildFolder = buildCipher({ id: "in-child", collectionIds: [platformId] });
      const elsewhere = buildCipher({ id: "elsewhere", collectionIds: [designId] });
      for (const cipher of [inFolder, inChildFolder, elsewhere]) {
        cipher.organizationId = organizationId;
      }

      ciphers$.next([inFolder, inChildFolder, elsewhere]);
      scopeTo(organizationId, engineeringId);

      expect(component().ciphers()).toEqual([inFolder]);
    });
  });

  describe("row actions", () => {
    it("builds the menu from the shared service, scoped to the user's collections", () => {
      const collection = { id: "collection-1" } as CollectionView;
      const menu = [{ id: "edit" }] as any[];
      cipherRowMenuService.getRowActions.mockReturnValue(menu);

      collections$.next([collection]);
      fixture.detectChanges();

      expect(component().rowActions()).toBe(menu);
      expect(cipherRowMenuService.getRowActions).toHaveBeenLastCalledWith(
        [collection],
        expect.anything(),
      );
    });

    it("routes edit and clone to the web dialogs", async () => {
      const item = buildCipher();

      await handlers().edit(item);
      await handlers().clone(item);

      expect(itemActions.edit).toHaveBeenCalledWith(item);
      expect(itemActions.clone).toHaveBeenCalledWith(item);
    });

    it("passes the user's collections to the assign handler", async () => {
      const item = buildCipher();
      const collection = { id: "collection-1" } as CollectionView;
      collections$.next([collection]);
      fixture.detectChanges();

      await handlers().assignToCollections(item);

      expect(itemActions.assignToCollections).toHaveBeenCalledWith(item, [collection]);
    });
  });

  describe("item activation", () => {
    it("opens the read-only view when an item's name is activated", async () => {
      const item = buildCipher();

      await component().itemAction(item);

      expect(itemActions.view).toHaveBeenCalledWith(item);
      expect(itemActions.edit).not.toHaveBeenCalled();
    });
  });

  describe("toolbar", () => {
    it("adds a cipher of the type chosen from vault-new-cipher-menu's legacy dropdown", async () => {
      await component().addCipher(CipherType.Card);

      expect(itemActions.add).toHaveBeenCalledWith(CipherType.Card);
    });

    it("opens the add-item form for the type chosen from the picker dialog", async () => {
      addItemDialogOpen.mockReturnValue({
        closed: of({ result: AddItemDialogResult.Cipher, cipherType: CipherType.Card }),
      } as unknown as DialogRef<never>);

      await component().openAddItemDialog();

      expect(itemActions.add).toHaveBeenCalledWith(CipherType.Card);
    });

    it("does nothing if the picker dialog is dismissed without a selection", async () => {
      await component().openAddItemDialog();

      expect(itemActions.add).not.toHaveBeenCalled();
    });
  });
});
