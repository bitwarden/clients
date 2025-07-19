import { ComponentRef } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionView } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ClientType } from "@bitwarden/common/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { ItemDetailsV2Component } from "./item-details-v2.component";

describe("ItemDetailsV2Component", () => {
  let component: ItemDetailsV2Component;
  let fixture: ComponentFixture<ItemDetailsV2Component>;
  let componentRef: ComponentRef<ItemDetailsV2Component>;

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
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: PlatformUtilsService, useValue: { getClientType: () => ClientType.Web } },
        {
          provide: EnvironmentService,
          useValue: { environment$: of({ getIconsUrl: () => "https://icons.example.com" }) },
        },
        { provide: DomainSettingsService, useValue: { showFavicons$: of(true) } },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ItemDetailsV2Component);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput("cipher", cipher);
    componentRef.setInput("organization", organization);
    componentRef.setInput("collections", [collection, collection2]);
    componentRef.setInput("folder", folder);
    jest.spyOn(component, "hasSmallScreen").mockReturnValue(false); // Mocking small screen check
    fixture.detectChanges();
  });

  it("displays all available fields", () => {
    const itemName = fixture.debugElement.query(By.css('[data-testid="item-name"]'));
    const itemDetailsList = fixture.debugElement.queryAll(
      By.css('[data-testid="item-details-list"]'),
    );

    expect(itemName.nativeElement.textContent.trim()).toEqual(cipher.name);
    expect(itemDetailsList.length).toBe(4); // Organization, Collection, Collection2, Folder
    expect(itemDetailsList[0].nativeElement.textContent.trim()).toContain(organization.name);
    expect(itemDetailsList[1].nativeElement.textContent.trim()).toContain(collection.name);
    expect(itemDetailsList[2].nativeElement.textContent.trim()).toContain(collection2.name);
    expect(itemDetailsList[3].nativeElement.textContent.trim()).toContain(folder.name);
  });

  it("does not render owner when `hideOwner` is true", () => {
    componentRef.setInput("hideOwner", true);
    fixture.detectChanges();

    const owner = fixture.debugElement.query(By.css('[data-testid="owner"]'));
    expect(owner).toBeNull();
  });
});
