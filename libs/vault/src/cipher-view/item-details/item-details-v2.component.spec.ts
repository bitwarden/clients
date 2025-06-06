import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionView } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { ItemDetailsV2Component } from "./item-details-v2.component";

describe("ItemDetailsV2Component", () => {
  let component: ItemDetailsV2Component;
  let fixture: ComponentFixture<ItemDetailsV2Component>;

  const cipher = {
    id: "cipher1",
    collectionIds: ["col1", "col2"],
    organizationId: "org1",
    folderId: "folder1",
    name: "cipher name",
  } as CipherView;

  const organization = {
    id: "org1",
    name: "Organization 1",
  } as Organization;

  const collection = {
    id: "col1",
    name: "Collection 1",
  } as CollectionView;

  const collection2 = {
    id: "col2",
    name: "Collection 2",
  } as CollectionView;

  const folder = {
    id: "folder1",
    name: "Folder 1",
  } as FolderView;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemDetailsV2Component],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ItemDetailsV2Component);
    component = fixture.componentInstance;
    component.cipher = cipher;
    component.organization = organization;
    component.collections = [collection, collection2];
    component.folder = folder;
    fixture.detectChanges();
  });

  it("displays all available fields", () => {
    const itemName = fixture.debugElement.query(By.css('[data-testid="item-name"]'));
    const owner = fixture.debugElement.query(By.css('[data-testid="owner"]'));
    const collections = fixture.debugElement.queryAll(By.css('[data-testid="collections"] li'));
    const folderElement = fixture.debugElement.query(By.css('[data-testid="folder"]'));

    expect(itemName.nativeElement.value).toBe(cipher.name);
    expect(owner.nativeElement.textContent.trim()).toBe(organization.name);
    expect(collections.map((c) => c.nativeElement.textContent.trim())).toEqual([
      collection.name,
      collection2.name,
    ]);
    expect(folderElement.nativeElement.textContent.trim()).toBe(folder.name);
  });

  it("does not render owner when `hideOwner` is true", () => {
    component.hideOwner = true;
    fixture.detectChanges();

    const owner = fixture.debugElement.query(By.css('[data-testid="owner"]'));
    expect(owner).toBeNull();
  });
});
