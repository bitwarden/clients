import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { I18nPipe } from "@bitwarden/ui-common";
import { Vfo1TerminologyService } from "@bitwarden/vault";

import { WebVaultItemActionsService } from "../services/vault-item-actions.service";

import { VaultNextComponent } from "./vault-next.component";

describe("VaultNextComponent", () => {
  const userId = "user-1" as UserId;

  let fixture: ComponentFixture<VaultNextComponent>;
  let itemActions: MockProxy<WebVaultItemActionsService>;
  let restrictedItemTypesService: MockProxy<RestrictedItemTypesService>;

  let ciphers$: Subject<CipherView[] | null>;
  let folders$: BehaviorSubject<FolderView[]>;
  let collections$: BehaviorSubject<CollectionView[]>;
  let organizations$: BehaviorSubject<Organization[]>;
  let userCanArchive$: BehaviorSubject<boolean>;
  let hasPremium$: BehaviorSubject<boolean>;
  let orgDataOwnership$: BehaviorSubject<boolean>;
  let vfo1Enabled: boolean;

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

  const rowActions = () => component().rowActions() as any[];
  const rowAction = (id: string) => rowActions().find((action) => action.id === id);

  beforeEach(async () => {
    ciphers$ = new Subject<CipherView[] | null>();
    folders$ = new BehaviorSubject<FolderView[]>([]);
    collections$ = new BehaviorSubject<CollectionView[]>([]);
    organizations$ = new BehaviorSubject<Organization[]>([]);
    userCanArchive$ = new BehaviorSubject(true);
    hasPremium$ = new BehaviorSubject(true);
    orgDataOwnership$ = new BehaviorSubject(false);
    vfo1Enabled = false;

    itemActions = mock<WebVaultItemActionsService>();

    restrictedItemTypesService = mock<RestrictedItemTypesService>();
    restrictedItemTypesService.restricted$ = of([]);
    restrictedItemTypesService.isCipherRestricted.mockReturnValue(false);

    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: userId } as Account);

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    const cipherService = mock<CipherService>();
    cipherService.cipherListViews$.mockReturnValue(ciphers$ as never);

    const folderService = mock<FolderService>();
    folderService.folderViews$.mockReturnValue(folders$);

    const collectionService = mock<CollectionService>();
    collectionService.decryptedCollections$.mockReturnValue(collections$);

    const organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(organizations$);

    const cipherArchiveService = mock<CipherArchiveService>();
    cipherArchiveService.userCanArchive$.mockReturnValue(userCanArchive$);

    const billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(hasPremium$);

    const policyService = mock<PolicyService>();
    policyService.policyAppliesToUser$.mockReturnValue(orgDataOwnership$);

    const vfo1TerminologyService = mock<Vfo1TerminologyService>();
    vfo1TerminologyService.enabled = (() => vfo1Enabled) as never;
    vfo1TerminologyService.iconClass.mockImplementation((icon) =>
      vfo1Enabled && icon === "bwi-collection-shared" ? "bwi-shared-folder" : icon,
    );

    await TestBed.configureTestingModule({
      imports: [VaultNextComponent],
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: BillingAccountProfileStateService, useValue: billingAccountProfileStateService },
        { provide: CipherArchiveService, useValue: cipherArchiveService },
        { provide: CipherService, useValue: cipherService },
        { provide: CollectionService, useValue: collectionService },
        { provide: FolderService, useValue: folderService },
        { provide: I18nService, useValue: i18nService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: PolicyService, useValue: policyService },
        { provide: RestrictedItemTypesService, useValue: restrictedItemTypesService },
        { provide: Vfo1TerminologyService, useValue: vfo1TerminologyService },
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
          .map((c) => c.id),
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
          .map((f) => f.id),
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
  });

  describe("row actions", () => {
    it("gates archive behind premium when the user cannot archive", () => {
      expect(rowAction("archive").premiumGated(buildCipher())).toBe(false);

      userCanArchive$.next(false);
      fixture.detectChanges();

      expect(rowAction("archive").premiumGated(buildCipher())).toBe(true);
    });

    it("shows favorite or unfavorite based on the item's current state", () => {
      expect(rowAction("favorite").show(buildCipher({ favorite: false }))).toBe(true);
      expect(rowAction("favorite").show(buildCipher({ favorite: true }))).toBe(false);
      expect(rowAction("unfavorite").show(buildCipher({ favorite: true }))).toBe(true);
      expect(rowAction("unfavorite").show(buildCipher({ favorite: false }))).toBe(false);
    });

    it("hides attachments for an archived item once archive access is lost", () => {
      const archived = buildCipher({ archivedDate: new Date() });
      expect(rowAction("attachments").show(archived)).toBe(true);

      userCanArchive$.next(false);
      fixture.detectChanges();

      expect(rowAction("attachments").show(archived)).toBe(false);
    });

    it("hides clone for an archived item when organization data ownership is enforced", () => {
      const archived = buildCipher({ archivedDate: new Date() });
      expect(rowAction("clone").show(archived)).toBe(true);

      orgDataOwnership$.next(true);
      fixture.detectChanges();

      expect(rowAction("clone").show(archived)).toBe(false);
    });

    it("only offers assign-to-shared-folders when the user belongs to an organization", () => {
      expect(rowAction("assignToCollections").show(buildCipher())).toBe(false);

      organizations$.next([{ id: "org-1" } as Organization]);
      fixture.detectChanges();

      expect(rowAction("assignToCollections").show(buildCipher())).toBe(true);
    });

    it("uses shared folder terminology when the VFO1 flag is on", () => {
      expect(rowAction("assignToCollections").label).toBe("assignToCollections");

      vfo1Enabled = true;
      // The label is read through the terminology service, so force a recompute.
      organizations$.next([{ id: "org-1" } as Organization]);
      fixture.detectChanges();

      expect(rowAction("assignToCollections").label).toBe("addToSharedFolder");
    });

    it("hides restore and unarchive for an ordinary item, and shows them for their own state", () => {
      expect(rowAction("restore").show(buildCipher())).toBe(false);
      expect(rowAction("restore").show(buildCipher({ deletedDate: new Date() }))).toBe(true);

      expect(rowAction("unarchive").show(buildCipher())).toBe(false);
      expect(rowAction("unarchive").show(buildCipher({ archivedDate: new Date() }))).toBe(true);
    });

    it("marks delete as destructive and hides it without edit permission", () => {
      expect(rowAction("delete").variant).toBe("danger");
      expect(rowAction("delete").show(buildCipher({ edit: false }))).toBe(false);
    });
  });

  describe("dispatching actions", () => {
    const dispatch = async (event: unknown) => {
      await (fixture.componentInstance as any).onAction(event);
    };

    it("opens the read-only view when an item's name is activated", async () => {
      const item = buildCipher();

      await dispatch((fixture.componentInstance as any).itemAction(item));

      expect(itemActions.view).toHaveBeenCalledWith(item);
      expect(itemActions.edit).not.toHaveBeenCalled();
    });

    it("routes each event to its handler", async () => {
      const item = buildCipher();

      await dispatch({ type: "editCipher", item });
      await dispatch({ type: "clone", item });
      await dispatch({ type: "toggleFavorite", item });
      await dispatch({ type: "archive", items: [item] });
      await dispatch({ type: "unarchive", items: [item] });
      await dispatch({ type: "restore", items: [item] });
      await dispatch({ type: "delete", items: [{ cipher: item }] });

      expect(itemActions.edit).toHaveBeenCalledWith(item);
      expect(itemActions.clone).toHaveBeenCalledWith(item);
      expect(itemActions.toggleFavorite).toHaveBeenCalledWith(item);
      expect(itemActions.archive).toHaveBeenCalledWith(item);
      expect(itemActions.unarchive).toHaveBeenCalledWith(item);
      expect(itemActions.restore).toHaveBeenCalledWith(item);
      expect(itemActions.delete).toHaveBeenCalledWith(item);
    });

    it("passes premium state and organizations to the attachments handler", async () => {
      const item = buildCipher();
      const organization = { id: "org-1" } as Organization;
      organizations$.next([organization]);
      hasPremium$.next(false);
      fixture.detectChanges();

      await dispatch({ type: "viewAttachments", item });

      expect(itemActions.viewAttachments).toHaveBeenCalledWith(item, false, [organization]);
    });

    it("passes the user's collections to the assign handler", async () => {
      const item = buildCipher();
      const collection = { id: "collection-1" } as CollectionView;
      collections$.next([collection]);
      fixture.detectChanges();

      await dispatch({ type: "assignToCollections", items: [item] });

      expect(itemActions.assignToCollections).toHaveBeenCalledWith(item, [collection]);
    });

    it("ignores a delete event carrying no cipher", async () => {
      await dispatch({ type: "delete", items: [{ collection: {} as CollectionView }] });

      expect(itemActions.delete).not.toHaveBeenCalled();
    });
  });

  describe("toolbar", () => {
    it("opens the add-item form", async () => {
      await (fixture.componentInstance as any).addItem();

      expect(itemActions.add).toHaveBeenCalled();
    });
  });
});
