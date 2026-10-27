import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import {
  CollectionTypes,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

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

const TRIGGER_SELECTOR = `#test-menu_button_options-${COLLECTION_ID}`;

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
  dialogs?: { collection?: boolean; bulkDelete?: boolean };
};

describe("CollectionOptionsMenuComponent", () => {
  let fixture: ComponentFixture<CollectionOptionsMenuComponent>;
  let component: CollectionOptionsMenuComponent;
  let collectionDialog: MockProxy<CollectionDialogRef>;
  let bulkDeleteDialog: MockProxy<BulkDeleteDialogRef>;

  async function setup(options: SetupOptions = {}): Promise<void> {
    const { collection: col = collection(), organization: org = organization() } = options;
    const { collection: withCollectionDialog = true, bulkDelete: withBulkDeleteDialog = true } =
      options.dialogs ?? {};

    collectionDialog = mock<CollectionDialogRef>();
    collectionDialog.open.mockResolvedValue(CollectionDialogOutcome.Saved);
    bulkDeleteDialog = mock<BulkDeleteDialogRef>();
    bulkDeleteDialog.open.mockResolvedValue(BulkDeleteDialogResult.Deleted);

    await TestBed.configureTestingModule({
      imports: [CollectionOptionsMenuComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
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
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function trigger(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector(TRIGGER_SELECTOR);
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

  it("opens the collection dialog on the Info tab and emits a non-delete result", async () => {
    await setup();
    const emitted = jest.fn();
    component.actionResult.subscribe(emitted);

    await component["editCollection"](CollectionDialogTab.Info);

    expect(collectionDialog.open).toHaveBeenCalledWith({
      organizationId: ORGANIZATION_ID,
      collectionId: COLLECTION_ID,
      initialTab: CollectionDialogTab.Info,
    });
    expect(emitted).toHaveBeenCalledWith({
      deleted: false,
      organizationId: ORGANIZATION_ID,
      collectionId: COLLECTION_ID,
    });
  });

  it("opens the collection dialog on the Access tab and emits a non-delete result", async () => {
    await setup();
    const emitted = jest.fn();
    component.actionResult.subscribe(emitted);

    await component["editCollection"](CollectionDialogTab.Access);

    expect(collectionDialog.open).toHaveBeenCalledWith({
      organizationId: ORGANIZATION_ID,
      collectionId: COLLECTION_ID,
      initialTab: CollectionDialogTab.Access,
    });
    expect(emitted).toHaveBeenCalledWith({
      deleted: false,
      organizationId: ORGANIZATION_ID,
      collectionId: COLLECTION_ID,
    });
  });

  it("emits a deleted result when editing the Access tab deletes the folder (the member's own self-unassignment)", async () => {
    await setup();
    collectionDialog.open.mockResolvedValue(CollectionDialogOutcome.Deleted);
    const emitted = jest.fn();
    component.actionResult.subscribe(emitted);

    await component["editCollection"](CollectionDialogTab.Access);

    expect(emitted).toHaveBeenCalledWith({
      deleted: true,
      organizationId: ORGANIZATION_ID,
      collectionId: COLLECTION_ID,
    });
  });

  it("opens the bulk delete dialog for just this folder and emits a deleted result", async () => {
    const org = organization();
    await setup({ organization: org });
    const emitted = jest.fn();
    component.actionResult.subscribe(emitted);

    await component["delete"]();

    expect(bulkDeleteDialog.open).toHaveBeenCalledWith({
      organization: org,
      collections: [component.collection()],
    });
    expect(emitted).toHaveBeenCalledWith({
      deleted: true,
      organizationId: ORGANIZATION_ID,
      collectionId: COLLECTION_ID,
    });
  });

  it("emits a non-delete result when the bulk delete dialog is canceled", async () => {
    await setup();
    bulkDeleteDialog.open.mockResolvedValue(BulkDeleteDialogResult.Canceled);
    const emitted = jest.fn();
    component.actionResult.subscribe(emitted);

    await component["delete"]();

    expect(emitted).toHaveBeenCalledWith({
      deleted: false,
      organizationId: ORGANIZATION_ID,
      collectionId: COLLECTION_ID,
    });
  });
});
