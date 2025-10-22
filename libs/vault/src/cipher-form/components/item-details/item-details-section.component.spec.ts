import { CommonModule } from "@angular/common";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionType, CollectionTypes, CollectionView } from "@bitwarden/admin-console/common";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SelectComponent } from "@bitwarden/components";

import {
  CipherFormConfig,
  OptionalInitialValues,
} from "../../abstractions/cipher-form-config.service";
import { CipherFormContainer } from "../../cipher-form-container";

import { ItemDetailsSectionComponent } from "./item-details-section.component";

const createMockCollection = (
  id: string,
  name: string,
  organizationId: string,
  readOnly = false,
  canEdit = true,
  type: CollectionType = CollectionTypes.DefaultUserCollection,
): CollectionView => {
  const cv = new CollectionView({
    name,
    organizationId: organizationId as OrganizationId,
    id: id as CollectionId,
  });
  cv.readOnly = readOnly;
  cv.manage = true;
  cv.type = type;
  cv.externalId = "";
  cv.hidePasswords = false;
  cv.assigned = true;
  cv.canEditName = jest.fn().mockReturnValue(true);
  cv.canEditItems = jest.fn().mockReturnValue(canEdit);
  cv.canEdit = jest.fn();
  cv.canDelete = jest.fn();
  cv.canViewCollectionInfo = jest.fn();

  return cv;
};

describe("ItemDetailsSectionComponent", () => {
  let component: ItemDetailsSectionComponent;
  let fixture: ComponentFixture<ItemDetailsSectionComponent>;
  let cipherFormProvider: MockProxy<CipherFormContainer>;
  let i18nService: MockProxy<I18nService>;
  let mockConfigService: MockProxy<ConfigService>;
  let mockPolicyService: MockProxy<PolicyService>;

  const activeAccount$ = new BehaviorSubject<{ email: string }>({ email: "test@example.com" });
  const getInitialCipherView = jest.fn<CipherView | null, []>(() => null);
  const initializedWithCachedCipher = jest.fn(() => false);
  const disableFormFields = jest.fn();
  const enableFormFields = jest.fn();

  beforeEach(async () => {
    getInitialCipherView.mockClear();
    initializedWithCachedCipher.mockClear();
    disableFormFields.mockClear();
    enableFormFields.mockClear();

    cipherFormProvider = mock<CipherFormContainer>({
      getInitialCipherView,
      initializedWithCachedCipher,
      disableFormFields,
      enableFormFields,
    });
    i18nService = mock<I18nService>();
    i18nService.collator = {
      compare: (a: string, b: string) => a.localeCompare(b),
    } as Intl.Collator;

    mockConfigService = mock<ConfigService>();
    mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
    mockPolicyService = mock<PolicyService>();
    mockPolicyService.policiesByType$.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [ItemDetailsSectionComponent, CommonModule, ReactiveFormsModule],
      providers: [
        { provide: CipherFormContainer, useValue: cipherFormProvider },
        { provide: I18nService, useValue: i18nService },
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PolicyService, useValue: mockPolicyService },
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
    it("should throw an error if no organizations are available for ownership and organization data ownership is enabled", async () => {
      component.config.organizationDataOwnershipDisabled = false;
      component.config.organizations = [];
      await expect(component.ngOnInit()).rejects.toThrow(
        "No organizations available for ownership.",
      );
    });

    it("should initialize form with default values if no originalCipher is provided", fakeAsync(async () => {
      component.config.organizationDataOwnershipDisabled = true;
      component.config.organizations = [{ id: "org1" } as Organization];
      await component.ngOnInit();
      tick();

      expect(cipherFormProvider.patchCipher).toHaveBeenCalled();
      const patchFn = cipherFormProvider.patchCipher.mock.lastCall![0];

      const updatedCipher = patchFn(new CipherView());

      expect(updatedCipher.name).toBe("");
      expect(updatedCipher.organizationId).toBeNull();
      expect(updatedCipher.folderId).toBeNull();
      expect(updatedCipher.collectionIds).toEqual([]);
      expect(updatedCipher.favorite).toBe(false);
    }));

    it("should initialize form with values from originalCipher if provided", fakeAsync(async () => {
      component.config.organizationDataOwnershipDisabled = true;
      component.config.organizations = [{ id: "org1" } as Organization];
      component.config.collections = [
        createMockCollection("col1", "Collection 1", "org1") as CollectionView,
      ];

      getInitialCipherView.mockReturnValueOnce({
        name: "cipher1",
        organizationId: "org1",
        folderId: "folder1",
        collectionIds: ["col1"],
        favorite: true,
      } as CipherView);

      await component.ngOnInit();
      tick();

      expect(cipherFormProvider.patchCipher).toHaveBeenCalled();
      const patchFn = cipherFormProvider.patchCipher.mock.lastCall![0];

      const updatedCipher = patchFn(new CipherView());

      expect(updatedCipher.name).toBe("cipher1");
      expect(updatedCipher.organizationId).toBe("org1");
      expect(updatedCipher.folderId).toBe("folder1");
      expect(updatedCipher.collectionIds).toEqual(["col1"]);
      expect(updatedCipher.favorite).toBe(true);
    }));

    it("should disable organizationId control if ownership change is not allowed", async () => {
      component.config.organizationDataOwnershipDisabled = false;
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
    it("should not allow ownership change if in edit mode and the cipher is owned by an organization", () => {
      component.config.mode = "edit";
      component.originalCipherView = {
        organizationId: "org1",
      } as CipherView;
      expect(component.allowOwnershipChange).toBe(false);
    });

    it("should allow ownership change if organization data ownership is disabled and there is at least one organization", () => {
      component.config.organizationDataOwnershipDisabled = true;
      component.config.organizations = [{ id: "org1", name: "org1" } as Organization];
      fixture.detectChanges();
      expect(component.allowOwnershipChange).toBe(true);
    });

    it("should allow ownership change if organization data ownership is enabled but there is more than one organization", () => {
      component.config.organizationDataOwnershipDisabled = false;
      component.config.organizations = [
        { id: "org1", name: "org1" } as Organization,
        { id: "org2", name: "org2" } as Organization,
      ];
      fixture.detectChanges();
      expect(component.allowOwnershipChange).toBe(true);
    });
  });

  describe("defaultOwner", () => {
    it("should return null if organization data ownership is disabled", () => {
      component.config.organizationDataOwnershipDisabled = true;
      expect(component.defaultOwner).toBeNull();
    });

    it("should return the first organization id if organization data ownership is enabled", () => {
      component.config.organizationDataOwnershipDisabled = false;
      component.config.organizations = [{ id: "org1", name: "Organization 1" } as Organization];
      fixture.detectChanges();
      expect(component.defaultOwner).toBe("org1");
    });
  });

  describe("showOrganizationDataOwnershipOption", () => {
    it("should show organization data ownership when the configuration allows", () => {
      component.config.mode = "edit";
      component.config.organizationDataOwnershipDisabled = true;
      component.originalCipherView = {} as CipherView;
      component.config.organizations = [{ id: "134-433-22" } as Organization];
      fixture.detectChanges();

      const select = fixture.debugElement.query(By.directive(SelectComponent));
      const { value, label } = select.componentInstance.items()[0];

      expect(value).toBeNull();
      expect(label).toBe("test@example.com");
    });

    it("should show organization data ownership when the control is disabled", async () => {
      component.config.mode = "edit";
      component.config.organizationDataOwnershipDisabled = false;
      component.originalCipherView = {} as CipherView;
      component.config.organizations = [{ id: "134-433-22" } as Organization];
      await component.ngOnInit();
      fixture.detectChanges();

      const select = fixture.debugElement.query(By.directive(SelectComponent));

      const { value, label } = select.componentInstance.items()[0];
      expect(value).toBeNull();
      expect(label).toBe("test@example.com");
    });
  });

  describe("showOwnership", () => {
    it("should return true if ownership change is allowed or in edit mode with at least one organization", () => {
      component.config.organizationDataOwnershipDisabled = true;
      jest.spyOn(component, "allowOwnershipChange", "get").mockReturnValue(true);
      expect(component.showOwnership).toBe(true);

      jest.spyOn(component, "allowOwnershipChange", "get").mockReturnValue(false);
      component.config.mode = "edit";
      component.config.organizations = [{ id: "org1" } as Organization];
      fixture.detectChanges();
      expect(component.showOwnership).toBe(true);
    });

    it("should hide the ownership control if showOwnership is false", async () => {
      component.config.organizationDataOwnershipDisabled = true;
      jest.spyOn(component, "showOwnership", "get").mockReturnValue(false);
      fixture.detectChanges();
      await fixture.whenStable();
      const ownershipControl = fixture.nativeElement.querySelector(
        "bit-select[formcontrolname='organizationId']",
      );
      expect(ownershipControl).toBeNull();
    });

    it("should show the ownership control if showOwnership is true", async () => {
      component.config.organizationDataOwnershipDisabled = true;
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
    beforeEach(() => {
      component.config.mode = "clone";
    });

    it("should append '- Clone' to the title if in clone mode", async () => {
      component.config.organizationDataOwnershipDisabled = true;
      const cipher = {
        name: "cipher1",
        organizationId: null,
        folderId: null,
        collectionIds: null,
        favorite: false,
      } as CipherView;

      getInitialCipherView.mockReturnValueOnce(cipher);

      i18nService.t.calledWith("clone").mockReturnValue("Clone");

      await component.ngOnInit();

      expect(component.itemDetailsForm.controls.name.value).toBe("cipher1 - Clone");
    });

    it("does not append clone when the cipher was populated from the cache", async () => {
      component.config.organizationDataOwnershipDisabled = true;
      const cipher = {
        name: "from cache cipher",
        organizationId: null,
        folderId: null,
        collectionIds: null,
        favorite: false,
      } as CipherView;

      getInitialCipherView.mockReturnValueOnce(cipher);

      initializedWithCachedCipher.mockReturnValueOnce(true);

      i18nService.t.calledWith("clone").mockReturnValue("Clone");

      await component.ngOnInit();

      expect(component.itemDetailsForm.controls.name.value).toBe("from cache cipher");
    });

    it("should select the first organization if organization data ownership is enabled", async () => {
      component.config.organizationDataOwnershipDisabled = false;
      component.config.organizations = [
        { id: "org1", name: "org1" } as Organization,
        { id: "org2", name: "org2" } as Organization,
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
      component.config.organizationDataOwnershipDisabled = true;
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

    it("should enable/show collection control when an organization is selected", fakeAsync(() => {
      component.config.organizationDataOwnershipDisabled = true;
      component.config.organizations = [{ id: "org1" } as Organization];
      component.config.collections = [
        createMockCollection("col1", "Collection 1", "org1") as CollectionView,
        createMockCollection("col2", "Collection 2", "org1") as CollectionView,
      ];

      fixture.detectChanges();
      tick();

      component.itemDetailsForm.controls.organizationId.setValue("org1");

      tick();
      fixture.detectChanges();

      const collectionSelect = fixture.nativeElement.querySelector(
        "bit-multi-select[formcontrolname='collectionIds']",
      );

      expect(component.itemDetailsForm.controls.collectionIds.enabled).toBe(true);
      expect(collectionSelect).not.toBeNull();
    }));

    it("should set collectionIds to originalCipher collections on first load", async () => {
      component.config.mode = "clone";
      getInitialCipherView.mockReturnValueOnce({
        name: "cipher1",
        organizationId: "org1",
        folderId: "folder1",
        collectionIds: ["col1", "col2"],
        favorite: true,
      } as CipherView);
      component.config.organizations = [{ id: "org1" } as Organization];
      component.config.collections = [
        createMockCollection("col1", "Collection 1", "org1") as CollectionView,
        createMockCollection("col2", "Collection 2", "org1") as CollectionView,
        createMockCollection("col3", "Collection 3", "org1") as CollectionView,
      ];

      fixture.detectChanges();
      await fixture.whenStable();

      expect(cipherFormProvider.patchCipher).toHaveBeenCalled();
      const patchFn = cipherFormProvider.patchCipher.mock.lastCall![0];

      const updatedCipher = patchFn(new CipherView());

      expect(updatedCipher.collectionIds).toEqual(["col1", "col2"]);
    });

    it("should automatically select the first collection if only one is available", async () => {
      component.config.organizationDataOwnershipDisabled = true;
      component.config.organizations = [{ id: "org1" } as Organization];
      component.config.collections = [
        createMockCollection("col1", "Collection 1", "org1") as CollectionView,
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
      getInitialCipherView.mockReturnValueOnce({
        name: "cipher1",
        organizationId: "org1",
        folderId: "folder1",
        collectionIds: ["col1", "col2", "col3"],
        favorite: true,
      } as CipherView);
      component.originalCipherView = {
        name: "cipher1",
        organizationId: "org1",
        folderId: "folder1",
        collectionIds: ["col1", "col2", "col3"],
        favorite: true,
      } as CipherView;
      component.config.organizations = [{ id: "org1" } as Organization];
      component.config.collections = [
        createMockCollection("col1", "Collection 1", "org1", true, false) as CollectionView,
        createMockCollection("col2", "Collection 2", "org1", true, false) as CollectionView,
        createMockCollection("col3", "Collection 3", "org1", true) as CollectionView,
      ];

      await component.ngOnInit();
      fixture.detectChanges();

      const collectionHint = fixture.nativeElement.querySelector(
        "bit-hint[data-testid='view-only-hint']",
      );

      expect(collectionHint).not.toBeNull();
    });

    it("should allow all collections to be altered when `config.admin` is true", async () => {
      component.config.admin = true;
      component.config.organizationDataOwnershipDisabled = true;
      component.config.organizations = [{ id: "org1" } as Organization];
      component.config.collections = [
        createMockCollection("col1", "Collection 1", "org1", true, false) as CollectionView,
        createMockCollection("col2", "Collection 2", "org1", true, false) as CollectionView,
        createMockCollection("col3", "Collection 3", "org1", false, false) as CollectionView,
      ];

      fixture.detectChanges();
      await fixture.whenStable();

      component.itemDetailsForm.controls.organizationId.setValue("org1");

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component["collectionOptions"].map((c) => c.id)).toEqual(["col1", "col2", "col3"]);
    });

    it("should exclude default collections when the cipher is only assigned to shared collections", async () => {
      component.config.admin = false;
      component.config.organizationDataOwnershipDisabled = true;
      component.config.organizations = [{ id: "org1" } as Organization];
      component.config.collections = new Array(4)
        .fill(null)
        .map((_, i) => i + 1)
        .map(
          (i) =>
            createMockCollection(
              `col${i}`,
              `Collection ${i}`,
              "org1",
              false,
              false,
              i < 4 ? CollectionTypes.SharedCollection : CollectionTypes.DefaultUserCollection,
            ) as CollectionView,
        );
      component.originalCipherView = {
        name: "cipher1",
        organizationId: "org1",
        folderId: "folder1",
        collectionIds: ["col2", "col3"],
        favorite: true,
      } as CipherView;
      fixture.detectChanges();
      await fixture.whenStable();

      component.itemDetailsForm.controls.organizationId.setValue("org1");

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component["collectionOptions"].map((c) => c.id)).toEqual(["col1", "col2", "col3"]);
    });
  });

  describe("readonlyCollections", () => {
    beforeEach(() => {
      component.config.mode = "edit";
      component.config.admin = true;
      component.config.collections = [
        createMockCollection("col1", "Collection 1", "org1", true, false) as CollectionView,
        createMockCollection("col2", "Collection 2", "org1", false, true) as CollectionView,
        createMockCollection("col3", "Collection 3", "org1", true, false) as CollectionView,
      ];
      component.originalCipherView = {
        name: "cipher1",
        organizationId: "org1",
        folderId: "folder1",
        collectionIds: ["col1", "col2", "col3"],
        favorite: true,
      } as CipherView;

      getInitialCipherView.mockReturnValue(component.originalCipherView);

      component.config.organizations = [{ id: "org1" } as Organization];
    });

    it("should not show collections as readonly when `config.admin` is true", async () => {
      component.config.isAdminConsole = true;
      await component.ngOnInit();
      fixture.detectChanges();

      // Filters out all collections
      expect(component["readOnlyCollections"]).toEqual([]);

      // Non-admin, keep readonly collections
      component.config.admin = false;

      await component.ngOnInit();
      fixture.detectChanges();
      expect(component["readOnlyCollectionsNames"]).toEqual(["Collection 1", "Collection 3"]);
    });
  });

  describe("organizationOptions", () => {
    it("should sort the organizations by name", async () => {
      component.config.mode = "edit";
      component.config.organizations = [
        { id: "org2", name: "org2" } as Organization,
        { id: "org1", name: "org1" } as Organization,
      ];
      component.originalCipherView = {} as CipherView;

      await component.ngOnInit();
      fixture.detectChanges();

      const select = fixture.debugElement.query(By.directive(SelectComponent));
      const { label } = select.componentInstance.items()[0];

      expect(label).toBe("org1");
    });
  });

  describe("getDefaultCollectionId", () => {
    it("returns matching default when flag & policy match", async () => {
      const def = createMockCollection("def1", "Def", "orgA");
      component.config.collections = [def] as CollectionView[];
      component.config.organizationDataOwnershipDisabled = false;
      component.config.initialValues = { collectionIds: [] } as OptionalInitialValues;
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockPolicyService.policiesByType$.mockReturnValue(of([{ organizationId: "orgA" } as Policy]));

      const id = await (component as any).getDefaultCollectionId("orgA");
      expect(id).toEqual("def1");
    });

    it("returns undefined when no default found", async () => {
      component.config.collections = [createMockCollection("c1", "C1", "orgB")] as CollectionView[];
      component.config.initialValues = { collectionIds: [] } as OptionalInitialValues;
      mockConfigService.getFeatureFlag.mockResolvedValue(true);
      mockPolicyService.policiesByType$.mockReturnValue(of([{ organizationId: "orgA" } as Policy]));

      const result = await (component as any).getDefaultCollectionId("orgA");
      expect(result).toBeUndefined();
    });
  });

  describe("form status when editing a cipher", () => {
    beforeEach(() => {
      component.config.mode = "edit";
      component.config.originalCipher = new Cipher();
      component.originalCipherView = {
        name: "cipher1",
        organizationId: null,
        folderId: "folder1",
        collectionIds: ["col1", "col2", "col3"],
        favorite: true,
      } as unknown as CipherView;
    });

    describe("when personal ownership is not allowed", () => {
      beforeEach(() => {
        component.config.organizationDataOwnershipDisabled = false; // disallow personal ownership
        component.config.organizations = [{ id: "orgId" } as Organization];
      });

      describe("cipher does not belong to an organization", () => {
        beforeEach(() => {
          getInitialCipherView.mockReturnValue(component.originalCipherView!);
        });

        it("enables organizationId", async () => {
          await component.ngOnInit();

          expect(component.itemDetailsForm.controls.organizationId.disabled).toBe(false);
        });

        it("disables the rest of the form", async () => {
          await component.ngOnInit();

          expect(disableFormFields).toHaveBeenCalled();
          expect(enableFormFields).not.toHaveBeenCalled();
        });
      });

      describe("cipher belongs to an organization", () => {
        beforeEach(() => {
          component.originalCipherView.organizationId = "org-id";
          getInitialCipherView.mockReturnValue(component.originalCipherView);
        });

        it("enables the rest of the form", async () => {
          await component.ngOnInit();

          expect(disableFormFields).not.toHaveBeenCalled();
          expect(enableFormFields).toHaveBeenCalled();
        });
      });

      describe("setFormState behavior with null/undefined", () => {
        it("calls disableFormFields when organizationId value is null", async () => {
          component.originalCipherView.organizationId = null as any;
          getInitialCipherView.mockReturnValue(component.originalCipherView);

          await component.ngOnInit();

          expect(disableFormFields).toHaveBeenCalled();
        });

        it("calls disableFormFields when organizationId value is undefined", async () => {
          component.originalCipherView.organizationId = undefined;
          getInitialCipherView.mockReturnValue(component.originalCipherView);

          await component.ngOnInit();

          expect(disableFormFields).toHaveBeenCalled();
        });

        it("calls enableFormFields when organizationId has a string value", async () => {
          component.originalCipherView.organizationId = "org-id" as any;
          getInitialCipherView.mockReturnValue(component.originalCipherView);

          await component.ngOnInit();

          expect(enableFormFields).toHaveBeenCalled();
        });
      });
    });

    describe("when an ownership change is not allowed", () => {
      beforeEach(() => {
        component.config.organizationDataOwnershipDisabled = true; // allow personal ownership
        component.originalCipherView!.organizationId = undefined;
      });

      it("disables organizationId when the cipher is owned by an organization", async () => {
        component.originalCipherView!.organizationId = "orgId";

        await component.ngOnInit();

        expect(component.itemDetailsForm.controls.organizationId.disabled).toBe(true);
      });

      it("disables organizationId when personal ownership is allowed and the user has no organizations available", async () => {
        component.config.organizations = [];

        await component.ngOnInit();

        expect(component.itemDetailsForm.controls.organizationId.disabled).toBe(true);
      });
    });
  });
});
