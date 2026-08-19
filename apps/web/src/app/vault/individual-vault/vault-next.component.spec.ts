import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
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
  VaultCopyButtonsService,
} from "@bitwarden/vault";

import { WebVaultItemActionsService } from "../services/vault-item-actions.service";

import { VaultNextComponent } from "./vault-next.component";

describe("VaultNextComponent", () => {
  const userId = "user-1" as UserId;

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
        { provide: CipherRowMenuService, useValue: cipherRowMenuService },
        { provide: CipherService, useValue: cipherService },
        { provide: CollectionService, useValue: collectionService },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: FolderService, useValue: folderService },
        { provide: I18nService, useValue: i18nService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: RestrictedItemTypesService, useValue: restrictedItemTypesService },
        { provide: VaultCopyButtonsService, useValue: copyButtonsService },
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
