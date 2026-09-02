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
import { DialogService, IconModule, MenuModule } from "@bitwarden/components";
import { AddEditFolderDialogComponent, VaultFabComponent } from "@bitwarden/vault";

import { BrowserApi } from "../../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";
import { NewItemInitialValues } from "../new-item-dropdown/new-item-dropdown.component";

import { AppVaultFabComponent } from "./vault-fab.component";

describe("AppVaultFabComponent", () => {
  let fixture: ComponentFixture<AppVaultFabComponent>;
  let component: AppVaultFabComponent;
  let router: Router;
  let dialogServiceMock: jest.Mocked<DialogService>;
  let configServiceMock: jest.Mocked<ConfigService>;

  const newItemTypesFlagSubject = new BehaviorSubject<boolean>(false);
  const mockTab = { id: 1, url: "https://example.com", windowId: 1 } as chrome.tabs.Tab;

  beforeAll(() => {
    jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockResolvedValue(mockTab);
    jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(false);
  });

  beforeEach(async () => {
    dialogServiceMock = mock<DialogService>();
    configServiceMock = mock<ConfigService>();
    configServiceMock.getFeatureFlag$.mockReturnValue(newItemTypesFlagSubject.asObservable());
    newItemTypesFlagSubject.next(false);

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
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppVaultFabComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    jest.spyOn(router, "navigate").mockResolvedValue(true);
    fixture.detectChanges();
  });

  describe("buildQueryParams", () => {
    const initialValues: NewItemInitialValues = {
      folderId: "folder-1",
      organizationId: "org-1" as any,
      collectionId: "col-1" as any,
    };

    it("includes prefillNameAndURIFromTab for Login when not popped out and tab is available", async () => {
      fixture.componentRef.setInput("initialValues", initialValues);
      // Wait for the constructor's tab promise to resolve.
      await Promise.resolve();

      const params = component["buildQueryParams"](CipherType.Login);

      expect(params).toEqual({
        type: CipherType.Login.toString(),
        folderId: "folder-1",
        organizationId: "org-1",
        collectionId: "col-1",
        prefillNameAndURIFromTab: "true",
      });
    });

    it("omits prefillNameAndURIFromTab for Login when popped out", () => {
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValueOnce(true);
      fixture.componentRef.setInput("initialValues", initialValues);

      const params = component["buildQueryParams"](CipherType.Login);

      expect(params).toEqual({
        type: CipherType.Login.toString(),
        folderId: "folder-1",
        organizationId: "org-1",
        collectionId: "col-1",
      });
    });

    it("omits prefillNameAndURIFromTab for non-Login types", () => {
      fixture.componentRef.setInput("initialValues", initialValues);

      const params = component["buildQueryParams"](CipherType.Card);

      expect(params).toEqual({
        type: CipherType.Card.toString(),
        folderId: "folder-1",
        organizationId: "org-1",
        collectionId: "col-1",
      });
    });

    it("includes undefined values when initialValues is not set", () => {
      const params = component["buildQueryParams"](CipherType.SecureNote);

      expect(params).toEqual({
        type: CipherType.SecureNote.toString(),
        folderId: undefined,
        organizationId: undefined,
        collectionId: undefined,
      });
    });
  });

  describe("navigateToNewItemPage", () => {
    it("navigates to /new-item with initialValues as query params", () => {
      const navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);
      fixture.componentRef.setInput("initialValues", {
        folderId: "f1",
        organizationId: "o1" as any,
        collectionId: "c1" as any,
      });

      component["navigateToNewItemPage"]();

      expect(navigate).toHaveBeenCalledWith(["/new-item"], {
        queryParams: { folderId: "f1", organizationId: "o1", collectionId: "c1" },
      });
    });

    it("passes undefined query params when initialValues is not set", () => {
      const navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);

      component["navigateToNewItemPage"]();

      expect(navigate).toHaveBeenCalledWith(["/new-item"], {
        queryParams: { folderId: undefined, organizationId: undefined, collectionId: undefined },
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

  describe("PM32009NewItemTypes flag", () => {
    it("calls navigateToNewItemPage when the flag is on and the FAB is clicked", () => {
      newItemTypesFlagSubject.next(true);
      fixture.detectChanges();
      const navigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);

      const fab = fixture.nativeElement.querySelector("button[type=button]");
      fab.click();

      expect(navigateSpy).toHaveBeenCalledWith(["/new-item"], expect.any(Object));
    });
  });
});
