import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, convertToParamMap, provideRouter } from "@angular/router";
import { mockAccountServiceWith } from "@bitwarden/common/../spec/fake-account-service";
import { FakeStateProvider } from "@bitwarden/common/../spec/fake-state-provider";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  CollectionTypes,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BitTablePaginatorComponent,
  BitTableV2Component,
  DialogService,
  FilterControl,
  FilterToggleComponent,
  MenuTriggerForDirective,
  ToastService,
} from "@bitwarden/components";

import { PinnedSharedFoldersService } from "../../services/pinned-shared-folders.service";
import { BULK_DELETE_DIALOG, BulkDeleteDialogRef } from "../../tokens/bulk-delete-dialog.token";
import {
  BULK_EDIT_COLLECTION_ACCESS_DIALOG,
  BulkEditCollectionAccessDialogRef,
} from "../../tokens/bulk-edit-collection-access-dialog.token";
import {
  COLLECTION_DIALOG,
  CollectionDialogRef,
  CollectionDialogTab,
} from "../../tokens/collection-dialog.token";

import { SharedFolderPermission } from "./shared-folder-permission";
import { SharedFolderRow } from "./shared-folder-rows";
import {
  SharedFoldersComponent,
  SharedFoldersTableColumn,
  SharedFoldersTableFilters,
} from "./shared-folders.component";

/** A guid, because `parseVaultScope` only reads a `:vaultId` segment that is one. */
const ORGANIZATION_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa" as OrganizationId;

type CollectionOverrides = {
  id?: string;
  organizationId?: string;
  name?: string;
  /** Full control over the folder, which is what `canEdit` and `canDelete` turn on. */
  manage?: boolean;
  readOnly?: boolean;
  hidePasswords?: boolean;
  defaultCollection?: boolean;
};

/** A collection with its branded ids relaxed, so a test can name a folder by a readable id. */
function collection(overrides: CollectionOverrides = {}): CollectionView {
  const {
    id = "col-1",
    organizationId = ORGANIZATION_ID,
    name = "Engineering",
    manage = true,
    readOnly = false,
    hidePasswords = false,
    defaultCollection = false,
  } = overrides;

  const view = new CollectionView({
    id: id as CollectionId,
    organizationId: organizationId as OrganizationId,
    name,
  });
  view.manage = manage;
  view.readOnly = readOnly;
  view.hidePasswords = hidePasswords;
  view.assigned = true;
  if (defaultCollection) {
    view.type = CollectionTypes.DefaultUserCollection;
  }
  return view;
}

/** A collection whose flags resolve to `permission` — see `sharedFolderPermission`. */
function collectionWith(
  permission: SharedFolderPermission,
  overrides: CollectionOverrides = {},
): CollectionView {
  const flags: Record<SharedFolderPermission, CollectionOverrides> = {
    [SharedFolderPermission.Manage]: { manage: true },
    [SharedFolderPermission.Edit]: { manage: false },
    [SharedFolderPermission.EditExceptPass]: { manage: false, hidePasswords: true },
    [SharedFolderPermission.View]: { manage: false, readOnly: true },
    [SharedFolderPermission.ViewExceptPass]: {
      manage: false,
      readOnly: true,
      hidePasswords: true,
    },
  };

  return collection({ ...flags[permission], ...overrides });
}

function cipher(id: string, collectionIds: string[]): CipherView {
  const view = new CipherView();
  view.id = id;
  view.organizationId = ORGANIZATION_ID;
  view.collectionIds = collectionIds;
  return view;
}

function organization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: ORGANIZATION_ID,
    name: "Acme",
    canCreateNewCollections: true,
    canEditAllCiphers: false,
    limitCollectionDeletion: false,
    isAdmin: false,
    ...overrides,
  } as Organization;
}

type SetupOptions = {
  collections?: CollectionView[];
  /** `null` withholds the first emission, which is what leaves the table loading. */
  ciphers?: CipherView[] | null;
  organizations?: Organization[];
  vaultId?: string;
  /** Which dialogs the client provides. */
  dialogs?: {
    collection?: boolean;
    bulkDelete?: boolean;
    bulkEditAccess?: boolean;
  };
};

describe("SharedFoldersComponent", () => {
  let fixture: ComponentFixture<SharedFoldersComponent>;
  let component: SharedFoldersComponent;
  let collections$: BehaviorSubject<CollectionView[]>;
  let ciphers$: BehaviorSubject<CipherView[] | null>;
  let organizations$: BehaviorSubject<Organization[]>;
  let collectionDialog: MockProxy<CollectionDialogRef>;
  let bulkDeleteDialog: MockProxy<BulkDeleteDialogRef>;
  let bulkEditAccessDialog: MockProxy<BulkEditCollectionAccessDialogRef>;
  let pinnedSharedFolders: PinnedSharedFoldersService;
  let toastService: MockProxy<ToastService>;

  async function setup(options: SetupOptions = {}): Promise<void> {
    const {
      collections = [],
      ciphers = [],
      organizations = [organization()],
      vaultId = ORGANIZATION_ID,
      dialogs = {},
    } = options;
    const {
      collection: withCollectionDialog = true,
      bulkDelete: withBulkDeleteDialog = true,
      bulkEditAccess: withBulkEditAccessDialog = true,
    } = dialogs;

    collections$ = new BehaviorSubject(collections);
    ciphers$ = new BehaviorSubject<CipherView[] | null>(ciphers);
    organizations$ = new BehaviorSubject(organizations);

    collectionDialog = mock<CollectionDialogRef>();
    bulkDeleteDialog = mock<BulkDeleteDialogRef>();
    bulkEditAccessDialog = mock<BulkEditCollectionAccessDialogRef>();
    toastService = mock<ToastService>();

    await TestBed.configureTestingModule({
      imports: [SharedFoldersComponent],
      providers: [
        provideRouter([]),
        {
          provide: I18nService,
          // The pipe passes its unused placeholders as empty strings; only real arguments are shown.
          useValue: {
            t: (key: string, ...args: string[]) => [key, ...args.filter(Boolean)].join(":"),
          },
        },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: StateProvider,
          useValue: new FakeStateProvider(mockAccountServiceWith("user-1" as UserId)),
        },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ vaultId })) },
        },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: "user-1" as UserId }) },
        },
        {
          provide: CollectionService,
          useValue: { decryptedCollections$: () => collections$ },
        },
        { provide: CipherService, useValue: { cipherListViews$: () => ciphers$ } },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
        ...(withCollectionDialog
          ? [{ provide: COLLECTION_DIALOG, useValue: collectionDialog }]
          : []),
        ...(withBulkDeleteDialog
          ? [{ provide: BULK_DELETE_DIALOG, useValue: bulkDeleteDialog }]
          : []),
        ...(withBulkEditAccessDialog
          ? [{ provide: BULK_EDIT_COLLECTION_ACCESS_DIALOG, useValue: bulkEditAccessDialog }]
          : []),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SharedFoldersComponent);
    component = fixture.componentInstance;
    pinnedSharedFolders = TestBed.inject(PinnedSharedFoldersService);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function applyFilter(row: SharedFolderRow, values: SharedFoldersTableFilters): boolean {
    return component["filter"](row, values);
  }

  function bitTable(): BitTableV2Component<
    SharedFolderRow,
    SharedFoldersTableColumn,
    SharedFoldersTableFilters
  > {
    return fixture.debugElement.query(By.directive(BitTableV2Component)).componentInstance;
  }

  function filterControl(key: string): FilterControl {
    const control = bitTable()
      .filterControls()
      .find((c) => c.key() === key);
    if (!control) {
      throw new Error(`No FilterControl registered under "${key}"`);
    }
    return control;
  }

  function searchControl(): FilterControl {
    return filterControl("search");
  }

  function row(id: string): SharedFolderRow {
    const found = component["sharedFolders"]().find((r) => r.id === id);
    if (!found) {
      throw new Error(`No row built for "${id}"`);
    }
    return found;
  }

  describe("loading the organization's folders", () => {
    it("renders a row per shared folder", async () => {
      await setup({
        collections: [
          collection({ id: "a", name: "Engineering" }),
          collection({ id: "b", name: "Finance" }),
        ],
        ciphers: [
          ...Array.from({ length: 42 }, (_, i) => cipher(`c${i}`, ["a"])),
          ...Array.from({ length: 8 }, (_, i) => cipher(`d${i}`, ["b"])),
        ],
      });
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain("Engineering");
      expect(text).toContain("42");
      expect(text).toContain("Finance");
      expect(text).toContain("8");
    });

    it("leaves out other organizations' collections and the organization's My items", async () => {
      await setup({
        collections: [
          collection({ id: "mine", name: "Engineering" }),
          collection({
            id: "theirs",
            organizationId: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
            name: "Contoso shared",
          }),
          collection({ id: "my-items", name: "My items", defaultCollection: true }),
        ],
      });
      fixture.detectChanges();

      expect(
        bitTable()
          .filtered()
          .map((r) => r.id),
      ).toEqual(["mine"]);
    });

    it("lists only top-level folders, with a nested folder count beneath each that has any", async () => {
      await setup({
        collections: [
          collection({ id: "eng", name: "Engineering" }),
          collection({ id: "backend", name: "Engineering/Backend" }),
          collection({ id: "frontend", name: "Engineering/Frontend" }),
          collection({ id: "finance", name: "Finance" }),
          collection({ id: "payroll", name: "Finance/Payroll" }),
          collection({ id: "sales", name: "Sales" }),
        ],
      });
      fixture.detectChanges();

      expect(
        bitTable()
          .filtered()
          .map((r) => r.id),
      ).toEqual(["eng", "finance", "sales"]);

      const subtitles = Array.from(
        fixture.nativeElement.querySelectorAll("bit-cell [slot=secondary]") as NodeListOf<Element>,
        (element) => element.textContent?.trim(),
      );
      expect(subtitles).toEqual(["nestedSharedFolderCount", "nestedSharedFolderSingular"]);
    });

    it("lists nothing for a vaultId that names no organization", async () => {
      await setup({ collections: [collection({ id: "a" })], vaultId: "my-vault" });
      fixture.detectChanges();

      expect(bitTable().filtered()).toEqual([]);
    });

    it("shows the loading state until the ciphers first decrypt", async () => {
      await setup({ collections: [collection({ id: "a" })], ciphers: null });
      fixture.detectChanges();

      expect(component["loading"]()).toBe(true);

      ciphers$.next([]);
      fixture.detectChanges();

      expect(component["loading"]()).toBe(false);
    });

    it("re-renders as the collections stream re-emits", async () => {
      await setup({ collections: [collection({ id: "a", name: "Engineering" })] });
      fixture.detectChanges();

      collections$.next([
        collection({ id: "a", name: "Engineering" }),
        collection({ id: "b", name: "Finance" }),
      ]);
      fixture.detectChanges();

      expect(bitTable().filtered()).toHaveLength(2);
    });

    it("links each folder's name to the drill-in beneath this list", async () => {
      await setup({
        collections: [
          collection({ id: "col-a", name: "Engineering" }),
          collection({ id: "col-b", name: "Finance" }),
        ],
      });
      fixture.detectChanges();

      const links = fixture.debugElement
        .queryAll(By.css("a[bitLink]"))
        .map((link) => (link.nativeElement as HTMLAnchorElement).getAttribute("href"));

      expect(links).toEqual([
        `/vault/${ORGANIZATION_ID}/shared-folders/col-a`,
        `/vault/${ORGANIZATION_ID}/shared-folders/col-b`,
      ]);
    });

    // The stubbed `I18nService` echoes the key, so a cell renders the message key rather than the
    // label — enough to assert the table translates the permission at all.
    it("renders each permission's translated label", async () => {
      await setup({
        collections: [
          collectionWith(SharedFolderPermission.Manage, { id: "a" }),
          collectionWith(SharedFolderPermission.View, { id: "b" }),
          collectionWith(SharedFolderPermission.ViewExceptPass, { id: "c" }),
          collectionWith(SharedFolderPermission.Edit, { id: "d" }),
          collectionWith(SharedFolderPermission.EditExceptPass, { id: "e" }),
        ],
      });
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain("manage");
      expect(text).toContain("viewItems");
      expect(text).toContain("viewItemsHidePass");
      expect(text).toContain("editItems");
      expect(text).toContain("editItemsHidePass");
    });

    it("sorts the permissions column by permission rather than by label", async () => {
      await setup();
      const sortByPermission = component["sortByPermission"];
      const shuffled = [
        { permissions: SharedFolderPermission.Manage },
        { permissions: SharedFolderPermission.Edit },
        { permissions: SharedFolderPermission.View },
        { permissions: SharedFolderPermission.EditExceptPass },
        { permissions: SharedFolderPermission.ViewExceptPass },
      ] as SharedFolderRow[];

      expect([...shuffled].sort(sortByPermission).map((r) => r.permissions)).toEqual([
        SharedFolderPermission.ViewExceptPass,
        SharedFolderPermission.View,
        SharedFolderPermission.EditExceptPass,
        SharedFolderPermission.Edit,
        SharedFolderPermission.Manage,
      ]);
    });

    it("declares the name, permissions, items, and options columns in order", async () => {
      await setup({ collections: [collection()] });
      fixture.detectChanges();

      expect(
        bitTable()
          .effectiveColumns()
          .map((column) => column.name()),
      ).toEqual(["name", "permissions", "items", "options"]);
    });
  });

  describe("the empty state", () => {
    function clearFiltersButton(): HTMLButtonElement {
      const button = fixture.nativeElement.querySelector(
        "#shared-folders_button_clear-filters",
      ) as HTMLButtonElement | null;
      if (!button) {
        throw new Error("The empty state's Clear all button is not rendered");
      }
      return button;
    }

    it("invites the Add button when there are no shared folders at all", async () => {
      await setup();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain("noSharedFoldersAdded");
      expect(text).toContain("noSharedFoldersAddedDescription");
    });

    it("switches to the no-matches copy once rows are filtered down to none", async () => {
      await setup({ collections: [collection({ id: "a", name: "Engineering" })] });
      fixture.detectChanges();

      searchControl().setValue("finance");
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(bitTable().filtered()).toEqual([]);
      expect(text).toContain("noMatchingItems");
      expect(text).toContain("clearFiltersOrTryAnother");
    });

    it("offers Clear all only while a chip filter is active", async () => {
      await setup({
        collections: [
          collectionWith(SharedFolderPermission.Manage, { id: "a", name: "Engineering" }),
          collectionWith(SharedFolderPermission.View, { id: "b", name: "Finance" }),
        ],
      });
      fixture.detectChanges();

      // A search term alone leaves nothing for Clear all to clear.
      searchControl().setValue("nothing matches this");
      fixture.detectChanges();
      expect(clearFiltersButton().classList).toContain("tw-hidden");

      filterControl("permissions").setValue([SharedFolderPermission.View]);
      fixture.detectChanges();
      expect(clearFiltersButton().classList).not.toContain("tw-hidden");
    });

    it("clears the chip filters without disturbing the search term", async () => {
      await setup({
        collections: [
          collectionWith(SharedFolderPermission.Manage, { id: "a", name: "Engineering" }),
          collectionWith(SharedFolderPermission.View, { id: "b", name: "Finance" }),
        ],
      });
      fixture.detectChanges();

      searchControl().setValue("engineering");
      filterControl("permissions").setValue([SharedFolderPermission.View]);
      fixture.detectChanges();

      clearFiltersButton().click();
      fixture.detectChanges();

      expect(filterControl("permissions").active()).toBe(false);
      expect(bitTable().filtered()).toEqual([expect.objectContaining({ name: "Engineering" })]);
    });
  });

  describe("filtering", () => {
    const stub = (overrides: Partial<SharedFolderRow> = {}): SharedFolderRow =>
      ({
        name: "Engineering",
        permissions: SharedFolderPermission.Manage,
        items: 4,
        ...overrides,
      }) as SharedFolderRow;

    beforeEach(async () => {
      await setup();
    });

    it("matches everything when the search is empty", () => {
      expect(applyFilter(stub(), {})).toBe(true);
      expect(applyFilter(stub(), { search: "" })).toBe(true);
      expect(applyFilter(stub(), { search: "   " })).toBe(true);
    });

    it("matches on a case-insensitive substring of the name", () => {
      expect(applyFilter(stub({ name: "Engineering" }), { search: "gine" })).toBe(true);
      expect(applyFilter(stub({ name: "Engineering" }), { search: "ENGIN" })).toBe(true);
      expect(applyFilter(stub({ name: "Engineering" }), { search: "finance" })).toBe(false);
    });

    it("does not match on the permission or the item count", () => {
      expect(
        applyFilter(stub({ permissions: SharedFolderPermission.Manage }), { search: "manage" }),
      ).toBe(false);
      expect(applyFilter(stub({ items: 42 }), { search: "42" })).toBe(false);
    });

    it("narrows the rendered rows as the search term changes", () => {
      collections$.next([
        collection({ id: "a", name: "Engineering" }),
        collection({ id: "b", name: "Finance" }),
      ]);
      fixture.detectChanges();

      searchControl().setValue("fin");
      fixture.detectChanges();

      expect(bitTable().filtered()).toEqual([expect.objectContaining({ name: "Finance" })]);
    });
  });

  describe("the permissions chip", () => {
    it("offers each permission the rows carry, in display order", async () => {
      await setup({
        collections: [
          collectionWith(SharedFolderPermission.Manage, { id: "a" }),
          collectionWith(SharedFolderPermission.View, { id: "b" }),
          collectionWith(SharedFolderPermission.Edit, { id: "c" }),
          collectionWith(SharedFolderPermission.Manage, { id: "d" }),
        ],
      });

      expect(component["permissionOptions"]()).toEqual([
        SharedFolderPermission.View,
        SharedFolderPermission.Edit,
        SharedFolderPermission.Manage,
      ]);
    });

    it("is omitted when the rows offer fewer than two distinct permissions", async () => {
      await setup({
        collections: [
          collectionWith(SharedFolderPermission.Manage, { id: "a" }),
          collectionWith(SharedFolderPermission.Manage, { id: "b" }),
        ],
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("bit-filter-menu")).toBeNull();
    });

    it("is rendered when the rows offer more than one distinct permission", async () => {
      await setup({
        collections: [
          collectionWith(SharedFolderPermission.Manage, { id: "a" }),
          collectionWith(SharedFolderPermission.View, { id: "b" }),
        ],
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("bit-filter-menu")).not.toBeNull();
    });

    it("narrows the rendered rows as the selection changes", async () => {
      await setup({
        collections: [
          collectionWith(SharedFolderPermission.Manage, { id: "a", name: "Engineering" }),
          collectionWith(SharedFolderPermission.View, { id: "b", name: "Finance" }),
        ],
      });
      fixture.detectChanges();

      filterControl("permissions").setValue([SharedFolderPermission.View]);
      fixture.detectChanges();

      expect(bitTable().filtered()).toEqual([expect.objectContaining({ name: "Finance" })]);
    });

    it("intersects with the search term", async () => {
      await setup({
        collections: [
          collectionWith(SharedFolderPermission.Manage, { id: "a", name: "Engineering" }),
          collectionWith(SharedFolderPermission.View, { id: "b", name: "Finance" }),
          collectionWith(SharedFolderPermission.Manage, { id: "c", name: "Finance archive" }),
        ],
      });
      fixture.detectChanges();

      searchControl().setValue("fin");
      filterControl("permissions").setValue([SharedFolderPermission.Manage]);
      fixture.detectChanges();

      expect(bitTable().filtered()).toEqual([expect.objectContaining({ name: "Finance archive" })]);
    });
  });

  describe("the Pinned toggle", () => {
    const PINNED_USER = "user-1" as UserId;

    async function setupPinnable(): Promise<void> {
      await setup({
        collections: [
          collectionWith(SharedFolderPermission.Manage, { id: "a", name: "Engineering" }),
          collectionWith(SharedFolderPermission.View, { id: "b", name: "Finance" }),
          collectionWith(SharedFolderPermission.Manage, { id: "c", name: "Finance archive" }),
        ],
      });
      await pinnedSharedFolders.pin(PINNED_USER, "b" as CollectionId);
      await pinnedSharedFolders.pin(PINNED_USER, "c" as CollectionId);
      fixture.detectChanges();
    }

    function names(): string[] {
      return bitTable()
        .filtered()
        .map((r) => r.name);
    }

    it("is offered ahead of the Permissions chip, with the pin icon", async () => {
      await setupPinnable();

      const toggle = fixture.nativeElement.querySelector("bit-filter-toggle") as HTMLElement;
      const menu = fixture.nativeElement.querySelector("bit-filter-menu") as HTMLElement;
      expect(toggle).not.toBeNull();
      expect(toggle.textContent).toContain("pinned");
      expect(toggle.querySelector(".bwi-pin")).not.toBeNull();
      expect(toggle.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("is offered when the Permissions chip is hidden", async () => {
      await setup({
        collections: [
          collectionWith(SharedFolderPermission.Manage, { id: "a" }),
          collectionWith(SharedFolderPermission.Manage, { id: "b" }),
        ],
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("bit-filter-menu")).toBeNull();
      expect(fixture.nativeElement.querySelector("bit-filter-toggle")).not.toBeNull();
    });

    function pinnedToggle(): { button: HTMLButtonElement; tooltip: string } {
      const toggle = fixture.debugElement.query(By.directive(FilterToggleComponent));
      return {
        button: toggle.nativeElement.querySelector("button") as HTMLButtonElement,
        tooltip: (toggle.componentInstance as FilterToggleComponent).disabledTooltip(),
      };
    }

    it("is offered, but disabled with a reason, while nothing is pinned", async () => {
      await setup({ collections: [collection({ id: "a" })] });
      fixture.detectChanges();

      expect(filterControl("pinned")).toBeDefined();
      const { button, tooltip } = pinnedToggle();
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(tooltip).toBe("noPinnedFoldersTooltip");
    });

    it("is enabled, without a reason, once a folder is pinned", async () => {
      await setupPinnable();

      const { button, tooltip } = pinnedToggle();
      expect(button.getAttribute("aria-disabled")).not.toBe("true");
      expect(tooltip).toBe("");
    });

    it("is disabled again when the last pin is removed", async () => {
      await setupPinnable();

      await pinnedSharedFolders.unpin(PINNED_USER, "b" as CollectionId);
      await pinnedSharedFolders.unpin(PINNED_USER, "c" as CollectionId);
      fixture.detectChanges();

      const { button, tooltip } = pinnedToggle();
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(tooltip).toBe("noPinnedFoldersTooltip");
    });

    it("stays enabled while on, so it can be turned off after the last pin is removed", async () => {
      await setupPinnable();
      filterControl("pinned").setValue(true);
      fixture.detectChanges();

      await pinnedSharedFolders.unpin(PINNED_USER, "b" as CollectionId);
      await pinnedSharedFolders.unpin(PINNED_USER, "c" as CollectionId);
      fixture.detectChanges();

      expect(pinnedToggle().button.getAttribute("aria-disabled")).not.toBe("true");

      pinnedToggle().button.click();
      fixture.detectChanges();

      expect(filterControl("pinned").active()).toBe(false);
    });

    it("cannot be turned on by a click while nothing is pinned", async () => {
      await setup({ collections: [collection({ id: "a" })] });
      fixture.detectChanges();

      pinnedToggle().button.click();
      fixture.detectChanges();

      expect(filterControl("pinned").active()).toBe(false);
    });

    it("keeps every row while off", async () => {
      await setupPinnable();

      expect(names()).toEqual(["Engineering", "Finance", "Finance archive"]);

      filterControl("pinned").setValue(false);
      fixture.detectChanges();
      expect(names()).toHaveLength(3);
    });

    it("keeps only the pinned rows while on", async () => {
      await setupPinnable();

      filterControl("pinned").setValue(true);
      fixture.detectChanges();

      expect(names()).toEqual(["Finance", "Finance archive"]);
    });

    it("follows a pin or unpin made while it is on", async () => {
      await setupPinnable();
      filterControl("pinned").setValue(true);
      fixture.detectChanges();

      await pinnedSharedFolders.unpin(PINNED_USER, "b" as CollectionId);
      await pinnedSharedFolders.pin(PINNED_USER, "a" as CollectionId);
      fixture.detectChanges();

      expect(names()).toEqual(["Engineering", "Finance archive"]);
    });

    it("intersects with the permissions chip and the search term", async () => {
      await setupPinnable();

      filterControl("pinned").setValue(true);
      filterControl("permissions").setValue([SharedFolderPermission.Manage]);
      fixture.detectChanges();
      expect(names()).toEqual(["Finance archive"]);

      filterControl("permissions").setValue(undefined);
      searchControl().setValue("fin");
      fixture.detectChanges();
      expect(names()).toEqual(["Finance", "Finance archive"]);

      searchControl().setValue("engineering");
      fixture.detectChanges();
      expect(names()).toEqual([]);
    });

    it("counts as an active chip filter, and Clear all resets it", async () => {
      await setup({
        collections: [collection({ id: "a", name: "Engineering" })],
      });
      fixture.detectChanges();
      const clearAll = (): HTMLButtonElement =>
        fixture.nativeElement.querySelector("#shared-folders_button_clear-filters");

      // Nothing pinned, so turning the toggle on leaves no rows and the empty state in view.
      filterControl("pinned").setValue(true);
      fixture.detectChanges();
      expect(filterControl("pinned").active()).toBe(true);
      expect(clearAll().classList).not.toContain("tw-hidden");

      clearAll().click();
      fixture.detectChanges();

      expect(filterControl("pinned").active()).toBe(false);
      expect(names()).toEqual(["Engineering"]);
    });

    it("shows the no-matches empty state when on with nothing pinned", async () => {
      await setup({ collections: [collection({ id: "a", name: "Engineering" })] });
      fixture.detectChanges();

      filterControl("pinned").setValue(true);
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(names()).toEqual([]);
      expect(text).toContain("noMatchingItems");
      expect(text).toContain("clearFiltersOrTryAnother");
    });

    it("matches every row for an unset value", async () => {
      await setup();
      const stub = { id: "x" } as SharedFolderRow;

      expect(applyFilter(stub, {})).toBe(true);
      expect(applyFilter(stub, { pinned: false })).toBe(true);
      expect(applyFilter(stub, { pinned: true })).toBe(false);
    });
  });

  describe("the pin icon in the Name cell", () => {
    const icon = (id: string): HTMLElement | null =>
      fixture.nativeElement.querySelector(`#shared-folders_icon_pinned-${id}`);

    it("shows after the name of a pinned row only", async () => {
      await setup({
        collections: [collection({ id: "a", name: "Engineering" }), collection({ id: "b" })],
      });
      await pinnedSharedFolders.pin("user-1" as UserId, "a" as CollectionId);
      fixture.detectChanges();

      expect(icon("a")).not.toBeNull();
      expect(icon("a")?.getAttribute("aria-label")).toBe("pinned");
      expect(icon("a")?.previousElementSibling?.id).toBe("shared-folders_link_name-a");
      expect(icon("b")).toBeNull();
    });

    it("shows for a nested folder's row too", async () => {
      await setup({ collections: [collection({ id: "a", name: "Engineering/Platform" })] });
      await pinnedSharedFolders.pin("user-1" as UserId, "a" as CollectionId);
      fixture.detectChanges();

      expect(icon("a")).not.toBeNull();
    });

    it("comes and goes as the pin state changes", async () => {
      await setup({ collections: [collection({ id: "a" })] });
      fixture.detectChanges();
      expect(icon("a")).toBeNull();

      await pinnedSharedFolders.pin("user-1" as UserId, "a" as CollectionId);
      fixture.detectChanges();
      expect(icon("a")).not.toBeNull();

      await pinnedSharedFolders.unpin("user-1" as UserId, "a" as CollectionId);
      fixture.detectChanges();
      expect(icon("a")).toBeNull();
    });
  });

  describe("row actions", () => {
    /**
     * Every row's Options menu trigger. Found by directive because `bitMenuTriggerFor` is bound,
     * and a property binding leaves no attribute in the DOM to match.
     */
    function menuTriggers(): HTMLElement[] {
      return (
        fixture.debugElement
          .queryAll(By.directive(MenuTriggerForDirective))
          .map((trigger) => trigger.nativeElement as HTMLElement)
          // The bulk actions bar has an overflow trigger of its own, outside the rows.
          .filter((trigger) => trigger.closest("bit-row") != null)
      );
    }

    /** The ids of the items in the first row's open menu, in order. */
    function openMenuItemIds(): string[] {
      menuTriggers()[0].click();
      fixture.detectChanges();
      return Array.from(document.querySelectorAll("[bitMenuItem]")).map((item) => item.id);
    }

    it("keeps the options column for a client with no collection dialog", async () => {
      await setup({ collections: [collection()], dialogs: { collection: false } });
      fixture.detectChanges();

      expect(
        bitTable()
          .effectiveColumns()
          .map((column) => column.name()),
      ).toEqual(["name", "permissions", "items", "options"]);
      expect(menuTriggers()).toHaveLength(1);
    });

    it("keeps the options column narrow and the options track flexible", async () => {
      await setup({ collections: [collection()] });
      fixture.detectChanges();

      expect(bitTable().gridTemplateColumns()).toContain("minmax(100px, 160px)");
      expect(bitTable().gridTemplateColumns()).toContain("minmax(80px, 1fr)");
      expect(menuTriggers()).toHaveLength(1);
    });

    it("offers Pin to sidebar for a folder the member can neither edit nor delete", async () => {
      await setup({ collections: [collectionWith(SharedFolderPermission.View)] });
      fixture.detectChanges();

      expect(row("col-1").canEdit).toBe(false);
      expect(row("col-1").canDelete).toBe(false);
      expect(menuTriggers()).toHaveLength(1);
      expect(openMenuItemIds()).toEqual(["shared-folders_menu-item_pin-col-1"]);
    });

    it("offers only Pin to sidebar to a client with no collection dialog", async () => {
      await setup({
        collections: [collectionWith(SharedFolderPermission.Manage)],
        dialogs: { collection: false },
      });
      fixture.detectChanges();

      expect(openMenuItemIds()).toEqual(["shared-folders_menu-item_pin-col-1"]);
    });

    it("offers only Pin to sidebar on desktop, which provides the bulk delete dialog but no collection dialog", async () => {
      await setup({
        collections: [collectionWith(SharedFolderPermission.Manage)],
        dialogs: { collection: false, bulkDelete: true },
      });
      fixture.detectChanges();

      expect(openMenuItemIds()).toEqual(["shared-folders_menu-item_pin-col-1"]);
    });

    it("offers Edit and Access but not Delete when the organization limits collection deletion", async () => {
      await setup({
        collections: [collectionWith(SharedFolderPermission.Manage)],
        organizations: [organization({ limitCollectionDeletion: true })],
      });
      fixture.detectChanges();

      expect(row("col-1").canEdit).toBe(true);
      expect(row("col-1").canDelete).toBe(false);
      expect(openMenuItemIds()).toEqual([
        "shared-folders_menu-item_pin-col-1",
        "shared-folders_menu-item_edit-col-1",
        "shared-folders_menu-item_access-col-1",
      ]);
    });

    it("puts Pin to sidebar before Edit, Access, and Delete", async () => {
      await setup({ collections: [collectionWith(SharedFolderPermission.Manage)] });
      fixture.detectChanges();

      expect(openMenuItemIds()).toEqual([
        "shared-folders_menu-item_pin-col-1",
        "shared-folders_menu-item_edit-col-1",
        "shared-folders_menu-item_access-col-1",
        "shared-folders_menu-item_delete-col-1",
      ]);
    });

    /** Opens the first row's menu and clicks the item with `id`. */
    async function clickMenuItem(id: string): Promise<void> {
      menuTriggers()[0].click();
      fixture.detectChanges();
      const item = document.querySelector<HTMLElement>(`#${id}`);
      if (item == null) {
        throw new Error(`No menu item "${id}"`);
      }
      item.click();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it("pins an unpinned folder for the active user from the row menu", async () => {
      await setup({ collections: [collection({ id: "col-a" })] });
      fixture.detectChanges();

      await clickMenuItem("shared-folders_menu-item_pin-col-a");

      expect(await firstValueFrom(pinnedSharedFolders.pinnedIds$("user-1" as UserId))).toEqual([
        "col-a",
      ]);
    });

    it("offers Unpin from sidebar for a pinned folder, and unpins it", async () => {
      await setup({ collections: [collection({ id: "col-a" })] });
      await pinnedSharedFolders.pin("user-1" as UserId, "col-a" as CollectionId);
      fixture.detectChanges();

      menuTriggers()[0].click();
      fixture.detectChanges();
      const pinItem = document.querySelector("#shared-folders_menu-item_pin-col-a");
      expect(pinItem?.textContent).toContain("unpinFromSidebar");

      (pinItem as HTMLElement).click();
      await fixture.whenStable();

      expect(await firstValueFrom(pinnedSharedFolders.pinnedIds$("user-1" as UserId))).toEqual([]);
    });

    it("labels the item Pin to sidebar for an unpinned folder", async () => {
      await setup({ collections: [collection({ id: "col-a" })] });
      fixture.detectChanges();

      menuTriggers()[0].click();
      fixture.detectChanges();

      const pinItem = document.querySelector("#shared-folders_menu-item_pin-col-a");
      expect(pinItem?.textContent).toContain("pinToSidebar");
      expect(pinItem?.textContent).not.toContain("unpinFromSidebar");
    });

    it("toasts after pinning, naming the folder", async () => {
      await setup({ collections: [collection({ id: "col-a", name: "Engineering" })] });
      fixture.detectChanges();

      await clickMenuItem("shared-folders_menu-item_pin-col-a");

      expect(toastService.showToast).toHaveBeenCalledTimes(1);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "folderPinnedToSidebar:Engineering",
      });
    });

    it("toasts after unpinning, naming the folder", async () => {
      await setup({ collections: [collection({ id: "col-a", name: "Engineering" })] });
      await pinnedSharedFolders.pin("user-1" as UserId, "col-a" as CollectionId);
      fixture.detectChanges();

      await clickMenuItem("shared-folders_menu-item_pin-col-a");

      expect(toastService.showToast).toHaveBeenCalledTimes(1);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "folderUnpinnedFromSidebar:Engineering",
      });
    });

    it("does not toast before the pin has been written", async () => {
      await setup({ collections: [collection({ id: "col-a" })] });
      fixture.detectChanges();
      let finishPin!: () => void;
      jest.spyOn(pinnedSharedFolders, "pin").mockReturnValue(
        new Promise<void>((resolve) => {
          finishPin = resolve;
        }),
      );

      await clickMenuItem("shared-folders_menu-item_pin-col-a");
      expect(toastService.showToast).not.toHaveBeenCalled();

      finishPin();
      await fixture.whenStable();
      expect(toastService.showToast).toHaveBeenCalledTimes(1);
    });

    it("does not toast before the unpin has been written", async () => {
      await setup({ collections: [collection({ id: "col-a" })] });
      await pinnedSharedFolders.pin("user-1" as UserId, "col-a" as CollectionId);
      fixture.detectChanges();
      let finishUnpin!: () => void;
      jest.spyOn(pinnedSharedFolders, "unpin").mockReturnValue(
        new Promise<void>((resolve) => {
          finishUnpin = resolve;
        }),
      );

      await clickMenuItem("shared-folders_menu-item_pin-col-a");
      expect(toastService.showToast).not.toHaveBeenCalled();

      finishUnpin();
      await fixture.whenStable();
      expect(toastService.showToast).toHaveBeenCalledTimes(1);
    });

    it("opens the collection dialog on the info tab to edit a folder", async () => {
      await setup({ collections: [collection({ id: "col-a" })] });
      fixture.detectChanges();

      await clickMenuItem("shared-folders_menu-item_edit-col-a");

      expect(collectionDialog.open).toHaveBeenCalledWith({
        organizationId: ORGANIZATION_ID,
        collectionId: "col-a",
        initialTab: CollectionDialogTab.Info,
      });
    });

    it("opens the collection dialog on the access tab to edit a folder's access", async () => {
      await setup({ collections: [collection({ id: "col-a" })] });
      fixture.detectChanges();

      await clickMenuItem("shared-folders_menu-item_access-col-a");

      expect(collectionDialog.open).toHaveBeenCalledWith({
        organizationId: ORGANIZATION_ID,
        collectionId: "col-a",
        initialTab: CollectionDialogTab.Access,
      });
    });

    it("deletes a folder through the bulk delete dialog, which owns the confirmation", async () => {
      const folder = collection({ id: "col-a" });
      await setup({ collections: [folder] });
      fixture.detectChanges();

      await clickMenuItem("shared-folders_menu-item_delete-col-a");

      expect(bulkDeleteDialog.open).toHaveBeenCalledWith({
        organization: expect.objectContaining({ id: ORGANIZATION_ID }),
        collections: [folder],
      });
    });
  });

  describe("the Add button", () => {
    function addButton(): HTMLButtonElement {
      const button = fixture.nativeElement.querySelector(
        "#shared-folders_button_add",
      ) as HTMLButtonElement | null;
      if (!button) {
        throw new Error("The toolbar's Add button is not rendered");
      }
      return button;
    }

    it("is offered to a member who may create collections", async () => {
      await setup();
      fixture.detectChanges();

      expect(addButton().classList).not.toContain("tw-hidden");
    });

    it("is withheld from a member who may not", async () => {
      await setup({ organizations: [organization({ canCreateNewCollections: false })] });
      fixture.detectChanges();

      expect(addButton().classList).toContain("tw-hidden");
    });

    it("is withheld from a client with no collection dialog", async () => {
      await setup({ dialogs: { collection: false } });
      fixture.detectChanges();

      expect(addButton().classList).toContain("tw-hidden");
    });

    it("opens the collection dialog for the route's organization when pressed", async () => {
      await setup();
      fixture.detectChanges();

      addButton().click();

      expect(collectionDialog.open).toHaveBeenCalledWith({ organizationId: ORGANIZATION_ID });
    });
  });

  describe("bulk actions", () => {
    function selectionModel() {
      const model = bitTable().selectionModel();
      if (!model) {
        throw new Error("The table has no selection model");
      }
      return model;
    }

    it("leaves selection off for a client with neither bulk dialog", async () => {
      await setup({
        collections: [collection()],
        dialogs: { bulkDelete: false, bulkEditAccess: false },
      });
      fixture.detectChanges();

      expect(bitTable().selectionModel()).toBeUndefined();
      expect(fixture.nativeElement.querySelector("bit-bulk-actions-bar")).toBeNull();
    });

    it("leaves selection off when the member can act on none of the listed folders", async () => {
      await setup({ collections: [collectionWith(SharedFolderPermission.View)] });
      fixture.detectChanges();

      expect(bitTable().selectionModel()).toBeUndefined();
      expect(fixture.nativeElement.querySelector("bit-bulk-actions-bar")).toBeNull();
    });

    it("turns on multi-select and renders the bar once an action applies", async () => {
      await setup({ collections: [collection({ id: "a" }), collection({ id: "b" })] });
      fixture.detectChanges();

      selectionModel().select(...bitTable().filtered());

      expect(selectionModel().count()).toBe(2);
      const bar: HTMLElement = fixture.nativeElement.querySelector("bit-bulk-actions-bar");
      expect(bar.textContent).toContain("editAccess");
      expect(bar.textContent).toContain("delete");
    });

    it("drops Delete for a client with no bulk delete dialog", async () => {
      await setup({ collections: [collection()], dialogs: { bulkDelete: false } });
      fixture.detectChanges();

      const bar: HTMLElement = fixture.nativeElement.querySelector("bit-bulk-actions-bar");
      expect(bar.textContent).toContain("editAccess");
      expect(bar.textContent).not.toContain("delete");
    });

    it("keeps the selection while change detection runs", async () => {
      await setup({ collections: [collection({ id: "a" })] });
      fixture.detectChanges();

      const [first] = bitTable().filtered();
      selectionModel().select(first);
      fixture.detectChanges();

      expect(selectionModel().selected()).toEqual([first]);
    });

    it("re-points the selection at rebuilt rows carrying the same folders", async () => {
      await setup({ collections: [collection({ id: "a" }), collection({ id: "b" })] });
      fixture.detectChanges();

      const [first] = bitTable().filtered();
      selectionModel().select(first);
      fixture.detectChanges();

      // The rows come from a stream, so any sync re-emits fresh objects for the same folders.
      collections$.next([collection({ id: "a" }), collection({ id: "b" })]);
      fixture.detectChanges();

      // The row is still selected — as the object the table now renders, not the one it replaced.
      expect(selectionModel().count()).toBe(1);
      expect(selectionModel().isSelected(bitTable().filtered()[0])).toBe(true);
      expect(selectionModel().selected()).not.toContain(first);
    });

    it("drops selected folders the rows no longer hold", async () => {
      await setup({ collections: [collection({ id: "a" }), collection({ id: "b" })] });
      fixture.detectChanges();

      selectionModel().select(...bitTable().filtered());
      fixture.detectChanges();
      expect(selectionModel().count()).toBe(2);

      // What a completed bulk delete leaves behind: the deleted folder is gone from the stream.
      collections$.next([collection({ id: "b" })]);
      fixture.detectChanges();

      expect(selectionModel().count()).toBe(1);
      expect(selectionModel().isSelected(bitTable().filtered()[0])).toBe(true);
    });

    it("empties the selection, and hides the bar, once every selected folder is gone", async () => {
      await setup({ collections: [collection({ id: "a" }), collection({ id: "b" })] });
      fixture.detectChanges();

      selectionModel().select(...bitTable().filtered());
      fixture.detectChanges();

      collections$.next([]);
      fixture.detectChanges();

      expect(component["selectedRows"]()).toEqual([]);

      // The bar removes itself at a count of zero, so a stale count would leave it announcing a
      // selection that no longer exists — and with no rows left, the bar goes with them.
      expect(fixture.nativeElement.querySelector("bit-bulk-actions-bar")).toBeNull();
    });

    it("hands Edit access the selected folders' collections", async () => {
      const first = collection({ id: "a" });
      await setup({ collections: [first, collection({ id: "b" })] });
      fixture.detectChanges();

      selectionModel().select(bitTable().filtered()[0]);
      fixture.detectChanges();

      await component["editSelectedAccess"]();

      expect(bulkEditAccessDialog.open).toHaveBeenCalledWith({
        organizationId: ORGANIZATION_ID,
        collections: [first],
      });
    });

    it("hands Delete the selected folders' collections", async () => {
      const first = collection({ id: "a" });
      await setup({ collections: [first, collection({ id: "b" })] });
      fixture.detectChanges();

      selectionModel().select(bitTable().filtered()[0]);
      fixture.detectChanges();

      await component["deleteSelected"]();

      expect(bulkDeleteDialog.open).toHaveBeenCalledWith({
        organization: expect.objectContaining({ id: ORGANIZATION_ID }),
        collections: [first],
      });
    });

    it("hands an action the rebuilt rows rather than the ones it was selected on", async () => {
      await setup({ collections: [collection({ id: "a", name: "Engineering" })] });
      fixture.detectChanges();

      selectionModel().select(bitTable().filtered()[0]);
      fixture.detectChanges();

      collections$.next([collection({ id: "a", name: "Renamed" })]);
      fixture.detectChanges();

      await component["editSelectedAccess"]();

      expect(bulkEditAccessDialog.open).toHaveBeenCalledWith({
        organizationId: ORGANIZATION_ID,
        collections: [expect.objectContaining({ id: "a", name: "Renamed" })],
      });
    });

    // Both dialogs refuse a batch they can't carry out whole, so disabling says so before the click.
    it("disables each action once the selection includes a folder it can't act on", async () => {
      await setup({
        collections: [
          collectionWith(SharedFolderPermission.Manage, { id: "a" }),
          collectionWith(SharedFolderPermission.View, { id: "b" }),
        ],
      });
      fixture.detectChanges();

      const [managed, viewOnly] = bitTable().filtered();

      // The selection reaches the component through `selectedChange`, so each change needs a pass.
      selectionModel().select(managed);
      fixture.detectChanges();
      expect(component["bulkEditAccessDisabled"]()).toBe(false);
      expect(component["bulkDeleteDisabled"]()).toBe(false);

      selectionModel().select(viewOnly);
      fixture.detectChanges();
      expect(component["bulkEditAccessDisabled"]()).toBe(true);
      expect(component["bulkDeleteDisabled"]()).toBe(true);
    });
  });

  describe("pagination", () => {
    /** The window height the fit divides — `jsdom`'s, restored after a test that changes it. */
    const windowHeight = window.innerHeight;

    /**
     * `jsdom` lays nothing out, so every rect is zero. Giving the rows a geometry leaves
     * `window.innerHeight` (768 in `jsdom`) as the height to fill.
     */
    function layOutRows({ top, height }: { top: number; height: number }): void {
      jest
        .spyOn(Element.prototype, "getBoundingClientRect")
        .mockReturnValue({ top, height } as DOMRect);
    }

    /** `count` folders, named so a search can narrow them. */
    function folders(count: number): CollectionView[] {
      return Array.from({ length: count }, (_, i) =>
        collection({ id: `col-${i}`, name: `Folder ${i}` }),
      );
    }

    /**
     * Settles the fit. The measurement runs in a render effect — which this zone-based fixture
     * flushes on a tick, not inside `detectChanges` — and feeds back into the page size, so the
     * rows it settles on need a further pass to reach the DOM.
     */
    function settle(): void {
      fixture.detectChanges();
      tick();
      fixture.detectChanges();
    }

    function renderedRows(): HTMLElement[] {
      return fixture.debugElement.queryAll(By.css("bit-row")).map((r) => r.nativeElement);
    }

    function paginator(): HTMLElement {
      const element = fixture.nativeElement.querySelector(
        "bit-table-paginator",
      ) as HTMLElement | null;
      if (!element) {
        throw new Error("The paginator is not rendered");
      }
      return element;
    }

    function paginatorComponent(): BitTablePaginatorComponent {
      return fixture.debugElement.query(By.directive(BitTablePaginatorComponent))
        .componentInstance as BitTablePaginatorComponent;
    }

    afterEach(() => {
      jest.restoreAllMocks();
      Object.defineProperty(window, "innerHeight", {
        value: windowHeight,
        configurable: true,
      });
    });

    // 768 (the window) less 300 (the rows' top) less 84 (the paginator and its gutter) is 384px of
    // room, which holds six 56px rows with 48px to spare.
    it("holds as many rows as the window fits", fakeAsync(async () => {
      await setup({ collections: folders(20) });
      layOutRows({ top: 300, height: 56 });

      settle();

      expect(renderedRows()).toHaveLength(6);
    }));

    // The same 584px of room holds ten 56px rows but only seven 76px ones, so the fit divides by
    // the measured height rather than the nominal one.
    it("fits fewer of a taller row", fakeAsync(async () => {
      await setup({ collections: folders(20) });
      layOutRows({ top: 100, height: 76 });

      settle();

      expect(renderedRows()).toHaveLength(7);
    }));

    it("pages rather than shrinking a page below five rows", fakeAsync(async () => {
      await setup({ collections: folders(20) });
      // Only 68px of room — a page of one row, without the floor.
      layOutRows({ top: 616, height: 56 });

      settle();

      expect(renderedRows()).toHaveLength(5);
    }));

    it("shows the paginator once the window can't fit every folder", fakeAsync(async () => {
      await setup({ collections: folders(20) });
      layOutRows({ top: 300, height: 56 });

      settle();

      expect(paginator().classList).not.toContain("tw-hidden");
    }));

    it("hides the paginator while every folder fits", fakeAsync(async () => {
      await setup({ collections: folders(6) });
      layOutRows({ top: 300, height: 56 });

      settle();

      expect(renderedRows()).toHaveLength(6);
      expect(paginator().classList).toContain("tw-hidden");
    }));

    it("re-fits the page as the window is resized", fakeAsync(async () => {
      await setup({ collections: folders(20) });
      layOutRows({ top: 300, height: 56 });
      settle();

      Object.defineProperty(window, "innerHeight", { value: 1216, configurable: true });
      window.dispatchEvent(new Event("resize"));
      // Past the audit window that collapses a burst of resize events.
      tick(200);
      settle();

      // 1216 less the same 384px of chrome leaves 832px of room — fourteen 56px rows.
      expect(renderedRows()).toHaveLength(14);
    }));

    it("pages the folders the filters leave, not all of them", fakeAsync(async () => {
      await setup({ collections: folders(20) });
      layOutRows({ top: 300, height: 56 });
      settle();

      // "Folder 1" and "Folder 10" through "Folder 19" — eleven of the twenty, six to a page.
      searchControl().setValue("Folder 1");
      settle();

      expect(renderedRows()).toHaveLength(6);
      expect(paginator().classList).not.toContain("tw-hidden");
    }));

    // The rows-per-page select lives in the paginator, so hiding a one-page paginator would take
    // away the control that asked for the longer page.
    it("keeps the paginator while a hand-picked size fits every folder on one page", fakeAsync(async () => {
      await setup({ collections: folders(20) });
      layOutRows({ top: 300, height: 56 });
      settle();

      paginatorComponent().pageSize.set(25);
      settle();

      expect(renderedRows()).toHaveLength(20);
      expect(paginator().classList).not.toContain("tw-hidden");
    }));

    it("offers the fitted size alongside the standard ones", fakeAsync(async () => {
      await setup({ collections: folders(20) });
      layOutRows({ top: 300, height: 56 });

      settle();

      expect(component["pageSizeOptions"]()).toEqual([6, 10, 25, 50, 100]);
    }));
  });
});
