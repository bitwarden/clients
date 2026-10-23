import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { Observable, of, Subject } from "rxjs";

import {
  CollectionTypes,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";

import { PinnedSharedFoldersService } from "../../services/pinned-shared-folders.service";
import {
  BULK_DELETE_DIALOG,
  BulkDeleteDialogRef,
  BulkDeleteDialogResult,
} from "../../tokens/bulk-delete-dialog.token";
import {
  COLLECTION_DIALOG,
  CollectionDialogOutcome,
  CollectionDialogRef,
  CollectionDialogTab,
} from "../../tokens/collection-dialog.token";

import { CollectionOptionsMenuComponent } from "./collection-options-menu.component";

const ORGANIZATION_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa" as OrganizationId;
const COLLECTION_ID = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb" as CollectionId;
const USER_ID = "cccccccc-3333-4333-8333-cccccccccccc" as UserId;

const TRIGGER_SELECTOR = `#test-menu_button_options-${COLLECTION_ID}`;
const PIN_ITEM_SELECTOR = `#test-menu_menu-item_pin-${COLLECTION_ID}`;

type CollectionOverrides = {
  manage?: boolean;
  readOnly?: boolean;
  defaultCollection?: boolean;
};

function collection(overrides: CollectionOverrides = {}): CollectionView {
  const { manage = true, readOnly = false, defaultCollection = false } = overrides;

  const view = new CollectionView({
    id: COLLECTION_ID,
    organizationId: ORGANIZATION_ID,
    name: "Engineering",
  });
  view.manage = manage;
  view.readOnly = readOnly;
  view.assigned = true;
  if (defaultCollection) {
    view.type = CollectionTypes.DefaultUserCollection;
  }
  return view;
}

function organization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: ORGANIZATION_ID,
    name: "Acme",
    limitCollectionDeletion: false,
    isAdmin: false,
    ...overrides,
  } as Organization;
}

type SetupOptions = {
  collection?: CollectionView;
  organization?: Organization;
  /** Which dialogs the client provides — omitting one is how desktop looks today. */
  dialogs?: { collection?: boolean; bulkDelete?: boolean };
  showPin?: boolean;
  pinnedIds?: CollectionId[];
  showDelete?: boolean;
  /** Defaults to an already-resolved active account. Override with a controllable stream (e.g. a
   * `Subject`) to test behavior while `togglePin()`'s `await firstValueFrom(this.userId$)` is
   * still pending. */
  activeAccount$?: Observable<{ id: UserId }>;
};

describe("CollectionOptionsMenuComponent", () => {
  let fixture: ComponentFixture<CollectionOptionsMenuComponent>;
  let component: CollectionOptionsMenuComponent;
  let collectionDialog: MockProxy<CollectionDialogRef>;
  let bulkDeleteDialog: MockProxy<BulkDeleteDialogRef>;
  let pinnedSharedFolders: MockProxy<PinnedSharedFoldersService>;
  let toastService: MockProxy<ToastService>;

  async function setup(options: SetupOptions = {}): Promise<void> {
    const { collection: col = collection(), organization: org = organization() } = options;
    const { collection: withCollectionDialog = true, bulkDelete: withBulkDeleteDialog = true } =
      options.dialogs ?? {};
    const { showPin = false, pinnedIds = [], showDelete = true } = options;
    const { activeAccount$ = of({ id: USER_ID }) } = options;

    collectionDialog = mock<CollectionDialogRef>();
    collectionDialog.open.mockResolvedValue(CollectionDialogOutcome.Saved);
    bulkDeleteDialog = mock<BulkDeleteDialogRef>();
    bulkDeleteDialog.open.mockResolvedValue(BulkDeleteDialogResult.Deleted);
    pinnedSharedFolders = mock<PinnedSharedFoldersService>({ activePinnedIds: signal(pinnedIds) });
    toastService = mock<ToastService>();

    await TestBed.configureTestingModule({
      imports: [CollectionOptionsMenuComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string, ...args: string[]) => key } },
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: PinnedSharedFoldersService, useValue: pinnedSharedFolders },
        { provide: ToastService, useValue: toastService },
        ...(withCollectionDialog
          ? [{ provide: COLLECTION_DIALOG, useValue: collectionDialog }]
          : []),
        ...(withBulkDeleteDialog
          ? [{ provide: BULK_DELETE_DIALOG, useValue: bulkDeleteDialog }]
          : []),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionOptionsMenuComponent);
    fixture.componentRef.setInput("collection", col);
    fixture.componentRef.setInput("organization", org);
    fixture.componentRef.setInput("triggerIcon", "bwi-ellipsis-v");
    fixture.componentRef.setInput("idPrefix", "test-menu");
    fixture.componentRef.setInput("showPin", showPin);
    fixture.componentRef.setInput("showDelete", showDelete);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function trigger(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector(TRIGGER_SELECTOR);
  }

  /** Opens the menu (`bit-menu` renders its items into a CDK overlay on `document.body`), if not
   * already open, and finds the Pin/Unpin item. */
  function pinItem(): HTMLButtonElement | null {
    let item = document.querySelector<HTMLButtonElement>(PIN_ITEM_SELECTOR);
    if (item == null) {
      trigger()?.click();
      fixture.detectChanges();
      item = document.querySelector<HTMLButtonElement>(PIN_ITEM_SELECTOR);
    }
    return item;
  }

  it("renders no trigger for a folder the member can neither edit nor delete", async () => {
    await setup({ collection: collection({ manage: false, readOnly: true }) });

    expect(trigger()).toBeNull();
  });

  it("renders no trigger for the organization's default collection even with manage", async () => {
    await setup({ collection: collection({ manage: true, defaultCollection: true }) });

    expect(trigger()).toBeNull();
  });

  it("renders no trigger for a client that provides neither dialog", async () => {
    await setup({ dialogs: { collection: false, bulkDelete: false } });

    expect(trigger()).toBeNull();
  });

  it("offers Edit info/Edit access and Delete together for a manageable folder when both dialogs are provided", async () => {
    await setup();

    expect(trigger()).not.toBeNull();
    expect(component["showEditActions"]()).toBe(true);
    expect(component["showDeleteAction"]()).toBe(true);
  });

  it("still offers Edit when organization is undefined, since canEdit tolerates that", async () => {
    await setup();
    fixture.componentRef.setInput("organization", undefined);
    fixture.detectChanges();

    expect(trigger()).not.toBeNull();
    expect(component["showEditActions"]()).toBe(true);
  });

  it("withholds Delete while organization is undefined, since canDelete needs it to honor limitCollectionDeletion", async () => {
    await setup();
    fixture.componentRef.setInput("organization", undefined);
    fixture.detectChanges();

    expect(component["showDeleteAction"]()).toBe(false);
  });

  it("offers only Delete for a client that provides no collection dialog", async () => {
    await setup({ dialogs: { collection: false, bulkDelete: true } });

    expect(trigger()).not.toBeNull();
    expect(component["showEditActions"]()).toBe(false);
    expect(component["showDeleteAction"]()).toBe(true);
  });

  it("offers only Edit info/Edit access for a client that provides no bulk delete dialog", async () => {
    await setup({ dialogs: { collection: true, bulkDelete: false } });

    expect(trigger()).not.toBeNull();
    expect(component["showEditActions"]()).toBe(true);
    expect(component["showDeleteAction"]()).toBe(false);
  });

  it("opens the collection dialog on the Info tab", async () => {
    await setup();

    await component["editCollection"](CollectionDialogTab.Info);

    expect(collectionDialog.open).toHaveBeenCalledWith({
      organizationId: ORGANIZATION_ID,
      collectionId: COLLECTION_ID,
      initialTab: CollectionDialogTab.Info,
    });
  });

  it("opens the collection dialog on the Access tab", async () => {
    await setup();

    await component["editCollection"](CollectionDialogTab.Access);

    expect(collectionDialog.open).toHaveBeenCalledWith({
      organizationId: ORGANIZATION_ID,
      collectionId: COLLECTION_ID,
      initialTab: CollectionDialogTab.Access,
    });
  });

  it("opens the bulk delete dialog for just this folder", async () => {
    const org = organization();
    await setup({ organization: org });

    await component["delete"]();

    expect(bulkDeleteDialog.open).toHaveBeenCalledWith({
      organization: org,
      collections: [component.collection()],
    });
  });

  describe("showPin", () => {
    it("renders no trigger for a client with neither dialog and showPin off", async () => {
      await setup({ dialogs: { collection: false, bulkDelete: false }, showPin: false });

      expect(trigger()).toBeNull();
    });

    it("renders the trigger for a client with neither dialog once showPin is on", async () => {
      await setup({ dialogs: { collection: false, bulkDelete: false }, showPin: true });

      expect(trigger()).not.toBeNull();
    });

    it("renders no trigger for the organization's default collection even with showPin on", async () => {
      await setup({
        dialogs: { collection: false, bulkDelete: false },
        showPin: true,
        collection: collection({ defaultCollection: true }),
      });

      expect(trigger()).toBeNull();
    });

    it("does not render the pin item when showPin is off, even with other actions available", async () => {
      await setup({ showPin: false });

      expect(trigger()).not.toBeNull();
      expect(pinItem()).toBeNull();
    });

    it("labels the item Pin to sidebar and shows the pin icon for an unpinned folder", async () => {
      await setup({ showPin: true, pinnedIds: [] });

      expect(pinItem()?.textContent).toContain("pinToSidebar");
      expect(pinItem()?.textContent).not.toContain("unpinFromSidebar");
      expect(pinItem()?.querySelector(".bwi-pin")).not.toBeNull();
      expect(pinItem()?.querySelector(".bwi-unpin")).toBeNull();
    });

    it("labels the item Unpin from sidebar and shows the unpin icon for a pinned folder", async () => {
      await setup({ showPin: true, pinnedIds: [COLLECTION_ID] });

      expect(pinItem()?.textContent).toContain("unpinFromSidebar");
      expect(pinItem()?.querySelector(".bwi-unpin")).not.toBeNull();
      expect(pinItem()?.querySelector(".bwi-pin")).toBeNull();
    });

    it("pins an unpinned folder for the active user and toasts", async () => {
      await setup({
        showPin: true,
        pinnedIds: [],
        collection: collection({ manage: false, readOnly: true }),
      });

      await component["togglePin"]();

      expect(pinnedSharedFolders.pin).toHaveBeenCalledWith(USER_ID, COLLECTION_ID);
      expect(pinnedSharedFolders.unpin).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "folderPinnedToSidebar",
      });
    });

    it("unpins a pinned folder for the active user and toasts", async () => {
      await setup({
        showPin: true,
        pinnedIds: [COLLECTION_ID],
        collection: collection({ manage: false, readOnly: true }),
      });

      await component["togglePin"]();

      expect(pinnedSharedFolders.unpin).toHaveBeenCalledWith(USER_ID, COLLECTION_ID);
      expect(pinnedSharedFolders.pin).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "folderUnpinnedFromSidebar",
      });
    });

    it("targets the folder in view when togglePin() started, not one the input changed to mid-await (regression for 960eeb7be2)", async () => {
      const otherCollection = collection();
      otherCollection.id = "dddddddd-4444-4444-8444-dddddddddddd" as CollectionId;
      const activeAccount$ = new Subject<{ id: UserId }>();
      await setup({ showPin: true, pinnedIds: [], activeAccount$ });

      const togglePin = component["togglePin"]();
      fixture.componentRef.setInput("collection", otherCollection);
      fixture.detectChanges();
      activeAccount$.next({ id: USER_ID });
      await togglePin;

      expect(pinnedSharedFolders.pin).toHaveBeenCalledWith(USER_ID, COLLECTION_ID);
      expect(pinnedSharedFolders.pin).not.toHaveBeenCalledWith(USER_ID, otherCollection.id);
    });
  });

  describe("showDelete", () => {
    it("offers Delete by default when the bulk delete dialog is provided", async () => {
      await setup();

      expect(component["showDeleteAction"]()).toBe(true);
    });

    it("withholds Delete when showDelete is off, even with the bulk delete dialog provided and manage permission", async () => {
      await setup({ showDelete: false });

      expect(component["showDeleteAction"]()).toBe(false);
    });

    it("withholds the whole trigger when showDelete is off and nothing else applies", async () => {
      await setup({ dialogs: { collection: false }, showDelete: false, showPin: false });

      expect(trigger()).toBeNull();
    });

    it("still offers Pin when showDelete is off but showPin is on", async () => {
      await setup({ dialogs: { collection: false }, showDelete: false, showPin: true });

      expect(trigger()).not.toBeNull();
      expect(component["showDeleteAction"]()).toBe(false);
    });
  });
});
