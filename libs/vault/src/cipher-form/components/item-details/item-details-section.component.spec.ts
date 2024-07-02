import { CommonModule } from "@angular/common";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";

import { CipherFormConfig } from "../../abstractions/cipher-form-config.service";
import { CipherFormContainer } from "../../cipher-form-container";

import { ItemDetailsSectionComponent } from "./item-details-section.component";

describe("ItemDetailsSectionComponent", () => {
  let component: ItemDetailsSectionComponent;
  let fixture: ComponentFixture<ItemDetailsSectionComponent>;
  let cipherFormProvider: MockProxy<CipherFormContainer>;
  let i18nService: MockProxy<I18nService>;

  beforeEach(async () => {
    cipherFormProvider = mock<CipherFormContainer>();
    i18nService = mock<I18nService>();

    await TestBed.configureTestingModule({
      imports: [ItemDetailsSectionComponent, CommonModule, ReactiveFormsModule],
      providers: [
        { provide: CipherFormContainer, useValue: cipherFormProvider },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ItemDetailsSectionComponent);
    component = fixture.componentInstance;
    component.config = {
      collections: [],
      organizations: [],
      folders: [],
    } as CipherFormConfig;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("ngOnInit", () => {
    it("should throw an error if no organizations are available for ownership and personal ownership is not allowed", async () => {
      component.config.allowPersonalOwnership = false;
      component.config.organizations = [];
      await expect(component.ngOnInit()).rejects.toThrow(
        "No organizations available for ownership.",
      );
    });

    it("should initialize form with default values if no originalCipher is provided", fakeAsync(async () => {
      component.config.allowPersonalOwnership = true;
      component.config.organizations = [{ id: "org1" } as Organization];
      await component.ngOnInit();
      tick();
      expect(cipherFormProvider.patchCipher).toHaveBeenLastCalledWith({
        name: "",
        organizationId: null,
        folderId: null,
        collectionIds: [],
        favorite: false,
      });
    }));

    it("should initialize form with values from originalCipher if provided", fakeAsync(async () => {
      component.config.allowPersonalOwnership = true;
      component.config.organizations = [{ id: "org1" } as Organization];
      component.config.collections = [
        { id: "col1", name: "Collection 1", organizationId: "org1" } as CollectionView,
      ];
      component.originalCipherView = {
        name: "cipher1",
        organizationId: "org1",
        folderId: "folder1",
        collectionIds: ["col1"],
        favorite: true,
      } as CipherView;

      await component.ngOnInit();
      tick();

      expect(cipherFormProvider.patchCipher).toHaveBeenLastCalledWith({
        name: "cipher1",
        organizationId: "org1",
        folderId: "folder1",
        collectionIds: ["col1"],
        favorite: true,
      });
    }));

    it("should disable organizationId control if ownership change is not allowed", async () => {
      component.config.allowPersonalOwnership = false;
      component.config.organizations = [{ id: "org1" } as Organization];
      jest.spyOn(component, "allowOwnershipChange", "get").mockReturnValue(false);

      await component.ngOnInit();

      expect(component.itemDetailsForm.controls.organizationId.disabled).toBe(true);
    });
  });

  describe("toggleFavorite", () => {
    it("should toggle the favorite control value", () => {
      component.itemDetailsForm.controls.favorite.setValue(false);
      component.toggleFavorite();
      expect(component.itemDetailsForm.controls.favorite.value).toBe(true);
      component.toggleFavorite();
      expect(component.itemDetailsForm.controls.favorite.value).toBe(false);
    });
  });

  describe("favoriteIcon", () => {
    it("should return the correct icon based on favorite value", () => {
      component.itemDetailsForm.controls.favorite.setValue(false);
      expect(component.favoriteIcon).toBe("bwi-star");
      component.itemDetailsForm.controls.favorite.setValue(true);
      expect(component.favoriteIcon).toBe("bwi-star-f");
    });
  });

  describe("allowOwnershipChange", () => {
    it("should not allow ownership change in edit mode", () => {
      component.config.mode = "edit";
      expect(component.allowOwnershipChange).toBe(false);
    });

    it("should allow ownership change if personal ownership is allowed and there is at least one organization", () => {
      component.config.allowPersonalOwnership = true;
      component.config.organizations = [{ id: "org1" } as Organization];
      expect(component.allowOwnershipChange).toBe(true);
    });

    it("should allow ownership change if personal ownership is not allowed but there is more than one organization", () => {
      component.config.allowPersonalOwnership = false;
      component.config.organizations = [
        { id: "org1" } as Organization,
        { id: "org2" } as Organization,
      ];
      expect(component.allowOwnershipChange).toBe(true);
    });
  });

  describe("defaultOwner", () => {
    it("should return null if personal ownership is allowed", () => {
      component.config.allowPersonalOwnership = true;
      expect(component.defaultOwner).toBeNull();
    });

    it("should return the first organization id if personal ownership is not allowed", () => {
      component.config.allowPersonalOwnership = false;
      component.config.organizations = [{ id: "org1" } as Organization];
      expect(component.defaultOwner).toBe("org1");
    });
  });

  describe("showOwnership", () => {
    it("should return true if ownership change is allowed or in edit mode with at least one organization", () => {
      jest.spyOn(component, "allowOwnershipChange", "get").mockReturnValue(true);
      expect(component.showOwnership).toBe(true);

      jest.spyOn(component, "allowOwnershipChange", "get").mockReturnValue(false);
      component.config.mode = "edit";
      component.config.organizations = [{ id: "org1" } as Organization];
      expect(component.showOwnership).toBe(true);
    });

    it("should hide the ownership control if showOwnership is false", async () => {
      jest.spyOn(component, "showOwnership", "get").mockReturnValue(false);
      fixture.detectChanges();
      await fixture.whenStable();
      const ownershipControl = fixture.nativeElement.querySelector(
        "bit-select[formcontrolname='organizationId']",
      );
      expect(ownershipControl).toBeNull();
    });

    it("should show the ownership control if showOwnership is true", async () => {
      jest.spyOn(component, "allowOwnershipChange", "get").mockReturnValue(true);
      fixture.detectChanges();
      await fixture.whenStable();
      const ownershipControl = fixture.nativeElement.querySelector(
        "bit-select[formcontrolname='organizationId']",
      );
      expect(ownershipControl).not.toBeNull();
    });
  });

  describe("cloneMode", () => {
    it("should append '- Clone' to the title if in clone mode", async () => {
      component.config.mode = "clone";
      component.config.allowPersonalOwnership = true;
      component.originalCipherView = {
        name: "cipher1",
        organizationId: null,
        folderId: null,
        collectionIds: null,
        favorite: false,
      } as CipherView;

      i18nService.t.calledWith("clone").mockReturnValue("Clone");

      await component.ngOnInit();

      expect(component.itemDetailsForm.controls.name.value).toBe("cipher1 - Clone");
    });

    it("should select the first organization if personal ownership is not allowed", async () => {
      component.config.mode = "clone";
      component.config.allowPersonalOwnership = false;
      component.config.organizations = [
        { id: "org1" } as Organization,
        { id: "org2" } as Organization,
      ];
      component.originalCipherView = {
        name: "cipher1",
        organizationId: null,
        folderId: null,
        collectionIds: [],
        favorite: false,
      } as CipherView;

      await component.ngOnInit();

      expect(component.itemDetailsForm.controls.organizationId.value).toBe("org1");
    });
  });

  describe("collectionOptions", () => {
    it("should reset and disable/hide collections control when no organization is selected", async () => {
      component.config.allowPersonalOwnership = true;
      component.itemDetailsForm.controls.organizationId.setValue(null);

      fixture.detectChanges();
      await fixture.whenStable();

      const collectionSelect = fixture.nativeElement.querySelector(
        "bit-multi-select[formcontrolname='collectionIds']",
      );

      expect(component.itemDetailsForm.controls.collectionIds.value).toEqual(null);
      expect(component.itemDetailsForm.controls.collectionIds.disabled).toBe(true);
      expect(collectionSelect).toBeNull();
    });

    it("should enable/show collection control when an organization is selected", async () => {
      component.config.allowPersonalOwnership = true;
      component.config.organizations = [{ id: "org1" } as Organization];
      component.config.collections = [
        { id: "col1", name: "Collection 1", organizationId: "org1" } as CollectionView,
        { id: "col2", name: "Collection 2", organizationId: "org1" } as CollectionView,
      ];

      fixture.detectChanges();
      await fixture.whenStable();

      component.itemDetailsForm.controls.organizationId.setValue("org1");

      fixture.detectChanges();
      await fixture.whenStable();

      const collectionSelect = fixture.nativeElement.querySelector(
        "bit-multi-select[formcontrolname='collectionIds']",
      );

      expect(component.itemDetailsForm.controls.collectionIds.enabled).toBe(true);
      expect(collectionSelect).not.toBeNull();
    });

    it("should set collectionIds to originalCipher collections on first load", async () => {
      component.config.mode = "clone";
      component.originalCipherView = {
        name: "cipher1",
        organizationId: "org1",
        folderId: "folder1",
        collectionIds: ["col1", "col2"],
        favorite: true,
      } as CipherView;
      component.config.organizations = [{ id: "org1" } as Organization];
      component.config.collections = [
        { id: "col1", name: "Collection 1", organizationId: "org1" } as CollectionView,
        { id: "col2", name: "Collection 2", organizationId: "org1" } as CollectionView,
        { id: "col3", name: "Collection 3", organizationId: "org1" } as CollectionView,
      ];

      fixture.detectChanges();
      await fixture.whenStable();

      expect(cipherFormProvider.patchCipher).toHaveBeenLastCalledWith(
        expect.objectContaining({
          collectionIds: ["col1", "col2"],
        }),
      );
    });

    it("should automatically select the first collection if only one is available", async () => {
      component.config.allowPersonalOwnership = true;
      component.config.organizations = [{ id: "org1" } as Organization];
      component.config.collections = [
        { id: "col1", name: "Collection 1", organizationId: "org1" } as CollectionView,
      ];

      fixture.detectChanges();
      await fixture.whenStable();

      component.itemDetailsForm.controls.organizationId.setValue("org1");

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.itemDetailsForm.controls.collectionIds.value).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "col1" })]),
      );
    });

    it("should show readonly hint if readonly collections are present", async () => {
      component.config.mode = "edit";
      component.originalCipherView = {
        name: "cipher1",
        organizationId: "org1",
        folderId: "folder1",
        collectionIds: ["col1", "col2", "col3"],
        favorite: true,
      } as CipherView;
      component.config.organizations = [{ id: "org1" } as Organization];
      component.config.collections = [
        { id: "col1", name: "Collection 1", organizationId: "org1" } as CollectionView,
        { id: "col2", name: "Collection 2", organizationId: "org1" } as CollectionView,
        {
          id: "col3",
          name: "Collection 3",
          organizationId: "org1",
          readOnly: true,
        } as CollectionView,
      ];

      await component.ngOnInit();
      fixture.detectChanges();

      const collectionHint = fixture.nativeElement.querySelector(
        "bit-hint[data-testid='view-only-hint']",
      );

      expect(collectionHint).not.toBeNull();
    });
  });
});
