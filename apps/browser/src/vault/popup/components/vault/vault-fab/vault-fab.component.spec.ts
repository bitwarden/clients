import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CIPHER_MENU_ITEMS } from "@bitwarden/common/vault/types/cipher-menu-items";
import { DialogService, IconModule, MenuModule } from "@bitwarden/components";
import { AddEditFolderDialogComponent, VaultFabComponent } from "@bitwarden/vault";

import { BrowserApi } from "../../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";

import { AppVaultFabComponent, FabNewItemInitialValues } from "./vault-fab.component";

describe("AppVaultFabComponent", () => {
  let fixture: ComponentFixture<AppVaultFabComponent>;
  let component: AppVaultFabComponent;
  let router: Router;
  let dialogServiceMock: jest.Mocked<DialogService>;
  let configServiceMock: jest.Mocked<ConfigService>;
  let restrictedItemTypesServiceMock: jest.Mocked<RestrictedItemTypesService>;

  const newItemTypesFlagSubject = new BehaviorSubject<boolean>(false);
  const restrictedSubject = new BehaviorSubject<{ cipherType: CipherType }[]>([]);
  const mockTab = { id: 1, url: "https://example.com", windowId: 1 } as chrome.tabs.Tab;

  beforeAll(() => {
    jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockResolvedValue(mockTab);
    jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(false);
  });

  beforeEach(async () => {
    dialogServiceMock = mock<DialogService>();
    configServiceMock = mock<ConfigService>();
    restrictedItemTypesServiceMock = mock<RestrictedItemTypesService>();
    configServiceMock.getFeatureFlag$.mockReturnValue(newItemTypesFlagSubject.asObservable());
    restrictedItemTypesServiceMock.restricted$ = restrictedSubject.asObservable();
    newItemTypesFlagSubject.next(false);
    restrictedSubject.next([]);

    await TestBed.configureTestingModule({
      imports: [
        AppVaultFabComponent,
        JslibModule,
        CommonModule,
        VaultFabComponent,
        MenuModule,
        IconModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: ConfigService, useValue: configServiceMock },
        { provide: DialogService, useValue: dialogServiceMock },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: RestrictedItemTypesService, useValue: restrictedItemTypesServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppVaultFabComponent);
    component = fixture.componentInstance;
    // Provide a default initialValues so getInitialValues() doesn't throw on render.
    fixture.componentRef.setInput("initialValues", {});
    router = TestBed.inject(Router);
    jest.spyOn(router, "navigate").mockResolvedValue(true);
    fixture.detectChanges();
  });

  it("creates", () => {
    expect(component).toBeTruthy();
  });

  describe("buildQueryParams", () => {
    it("prefills org, collections, and folder when exactly one of each is provided", async () => {
      const initialValues: FabNewItemInitialValues = {
        folderIds: ["folder-1"],
        organizationIds: ["org-1"],
        collectionIds: ["col-1"],
      };
      fixture.componentRef.setInput("initialValues", initialValues);
      // Wait for the constructor's tab promise to resolve.
      await Promise.resolve();

      const params = component["buildQueryParams"](CipherType.Login);

      expect(params).toEqual({
        type: CipherType.Login.toString(),
        folderId: "folder-1",
        organizationId: "org-1",
        collectionIds: "col-1",
        prefillNameAndURIFromTab: "true",
      });
    });

    it("joins multiple collectionIds with a comma when one org is selected", () => {
      fixture.componentRef.setInput("initialValues", {
        organizationIds: ["org-1"],
        collectionIds: ["col-1", "col-2"],
      });

      const params = component["buildQueryParams"](CipherType.Card);

      expect(params.collectionIds).toBe("col-1,col-2");
    });

    it("omits org and collections when multiple orgs are selected", () => {
      fixture.componentRef.setInput("initialValues", {
        organizationIds: ["org-1", "org-2"],
        collectionIds: ["col-1"],
        folderIds: ["folder-1"],
      });

      const params = component["buildQueryParams"](CipherType.Card);

      expect(params.organizationId).toBeUndefined();
      expect(params.collectionIds).toBeUndefined();
      expect(params.folderId).toBe("folder-1");
    });

    it("omits folder when multiple folders are selected", () => {
      fixture.componentRef.setInput("initialValues", {
        folderIds: ["folder-1", "folder-2"],
      });

      const params = component["buildQueryParams"](CipherType.Card);

      expect(params.folderId).toBeUndefined();
    });

    it("omits prefillNameAndURIFromTab for Login when tab is not available", () => {
      component["tab"] = undefined;
      fixture.componentRef.setInput("initialValues", {});

      const params = component["buildQueryParams"](CipherType.Login);

      expect(params.prefillNameAndURIFromTab).toBeUndefined();
    });

    it("omits prefillNameAndURIFromTab for Login when popped out", () => {
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValueOnce(true);
      fixture.componentRef.setInput("initialValues", { folderIds: ["f1"] });

      const params = component["buildQueryParams"](CipherType.Login);

      expect(params.prefillNameAndURIFromTab).toBeUndefined();
    });

    it("omits prefillNameAndURIFromTab for non-Login types", () => {
      fixture.componentRef.setInput("initialValues", {});

      const params = component["buildQueryParams"](CipherType.SecureNote);

      expect(params.prefillNameAndURIFromTab).toBeUndefined();
    });
  });

  describe("navigateToNewItemPage", () => {
    it("navigates to /new-item with prefilled values from a single org/folder", () => {
      const navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);
      fixture.componentRef.setInput("initialValues", {
        folderIds: ["f1"],
        organizationIds: ["o1"],
        collectionIds: ["c1"],
      });

      component["navigateToNewItemPage"]();

      expect(navigate).toHaveBeenCalledWith(["/new-item"], {
        queryParams: { folderId: "f1", organizationId: "o1", collectionIds: "c1" },
      });
    });

    it("navigates with undefined values when initialValues is empty", () => {
      const navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);
      fixture.componentRef.setInput("initialValues", {});

      component["navigateToNewItemPage"]();

      expect(navigate).toHaveBeenCalledWith(["/new-item"], {
        queryParams: { folderId: undefined, organizationId: undefined, collectionIds: undefined },
      });
    });

    it("omits org and collections when multiple orgs are selected", () => {
      const navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);
      fixture.componentRef.setInput("initialValues", {
        organizationIds: ["o1", "o2"],
        collectionIds: ["c1"],
        folderIds: ["f1"],
      });

      component["navigateToNewItemPage"]();

      expect(navigate).toHaveBeenCalledWith(["/new-item"], {
        queryParams: { folderId: "f1", organizationId: undefined, collectionIds: undefined },
      });
    });

    it("omits folder when multiple folders are selected", () => {
      const navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);
      fixture.componentRef.setInput("initialValues", {
        folderIds: ["f1", "f2"],
      });

      component["navigateToNewItemPage"]();

      expect(navigate).toHaveBeenCalledWith(["/new-item"], {
        queryParams: { folderId: undefined, organizationId: undefined, collectionIds: undefined },
      });
    });
  });

  describe("openFolderDialog", () => {
    it("opens the AddEditFolderDialogComponent", () => {
      const openSpy = jest
        .spyOn(AddEditFolderDialogComponent, "open")
        .mockReturnValue(undefined as any);

      component["openFolderDialog"]();

      expect(openSpy).toHaveBeenCalledWith(expect.any(DialogService));
    });
  });

  describe("cipherMenuItems", () => {
    it("shows all cipher types when no restrictions are active", () => {
      restrictedSubject.next([]);
      fixture.detectChanges();

      expect(component["cipherMenuItems"]()).toEqual(CIPHER_MENU_ITEMS);
    });

    it("excludes cipher types blocked by the RestrictedItemTypes policy", () => {
      restrictedSubject.next([{ cipherType: CipherType.Card }]);
      fixture.detectChanges();

      const items = component["cipherMenuItems"]();
      expect(items.some((item) => item.type === CipherType.Card)).toBe(false);
      expect(items.length).toBe(CIPHER_MENU_ITEMS.length - 1);
    });
  });

  describe("PM32009NewItemTypes flag", () => {
    it("navigates to /new-item when the flag is on and the FAB is clicked", () => {
      newItemTypesFlagSubject.next(true);
      fixture.detectChanges();
      const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);

      const fab = fixture.nativeElement.querySelector("button[type=button]");
      fab.click();

      expect(navigateSpy).toHaveBeenCalledWith(["/new-item"], expect.any(Object));
    });
  });
});
