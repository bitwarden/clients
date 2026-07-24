import { ComponentRef, signal, WritableSignal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { of } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { Vfo1TerminologyService } from "../../services/vfo1-terminology.service";

import { ItemDetailsV2Component } from "./item-details-v2.component";

describe("ItemDetailsV2Component", () => {
  let component: ItemDetailsV2Component;
  let fixture: ComponentFixture<ItemDetailsV2Component>;
  let componentRef: ComponentRef<ItemDetailsV2Component>;
  let mockVfo1Enabled: WritableSignal<boolean>;

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
    mockVfo1Enabled = signal(false);
    await TestBed.configureTestingModule({
      imports: [ItemDetailsV2Component],
      providers: [
        {
          provide: I18nService,
          useValue: { t: (key: string, p1?: string) => (p1 ? `${key} ${p1}` : key) },
        },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
        {
          provide: EnvironmentService,
          useValue: { environment$: of({ getIconsUrl: () => "https://icons.example.com" }) },
        },
        { provide: DomainSettingsService, useValue: { showFavicons$: of(true) } },
        { provide: Vfo1TerminologyService, useFactory: () => ({ enabled: mockVfo1Enabled }) },
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

  describe("when VFO1Foundation flag is enabled", () => {
    beforeEach(() => {
      mockVfo1Enabled.set(true);
    });

    it("uses 'vault' i18n key for the org item aria-label", () => {
      const orgInstance = Object.assign(new Organization(), {
        id: "org1",
        name: "Organization 1",
      });
      componentRef.setInput("organization", orgInstance);
      fixture.detectChanges();

      const itemDetailsList = fixture.debugElement.queryAll(
        By.css('[data-testid="item-details-list"]'),
      );
      const orgItem = itemDetailsList.find((el) =>
        el.nativeElement.getAttribute("aria-label")?.includes(orgInstance.name),
      );

      expect(orgItem).toBeDefined();
      expect(orgItem!.nativeElement.getAttribute("aria-label")).toBe(
        `vaultAriaLabel ${orgInstance.name}`,
      );
    });

    it("shows personal vault chip when cipher has no organizationId", () => {
      componentRef.setInput("cipher", {
        ...cipher,
        organizationId: null,
        collectionIds: [],
      } as unknown as CipherView);
      fixture.detectChanges();

      const itemDetailsList = fixture.debugElement.queryAll(
        By.css('[data-testid="item-details-list"]'),
      );
      const personalVaultChip = itemDetailsList.find(
        (el) => el.nativeElement.getAttribute("aria-label") === "myVault",
      );

      expect(personalVaultChip).toBeDefined();
      expect(personalVaultChip!.nativeElement.textContent.trim()).toContain("myVault");
    });

    it("does not show personal vault chip when cipher has an organizationId", () => {
      fixture.detectChanges();

      const itemDetailsList = fixture.debugElement.queryAll(
        By.css('[data-testid="item-details-list"]'),
      );
      const personalVaultChip = itemDetailsList.find(
        (el) => el.nativeElement.getAttribute("aria-label") === "myVault",
      );

      expect(personalVaultChip).toBeUndefined();
    });
  });
});
