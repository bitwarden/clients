import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";
import { ButtonModule, DialogService, MenuModule, NoItemsModule } from "@bitwarden/components";

import { BrowserApi } from "../../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";

import { NewItemDropdownV2Component, NewItemInitialValues } from "./new-item-dropdown-v2.component";

describe("NewItemDropdownV2Component", () => {
  let component: NewItemDropdownV2Component;
  let fixture: ComponentFixture<NewItemDropdownV2Component>;
  let dialogServiceMock: jest.Mocked<DialogService>;
  let browserApiMock: jest.Mocked<typeof BrowserApi>;
  let restrictedItemTypesServiceMock: jest.Mocked<RestrictedItemTypesService>;

  const mockTab = { url: "https://example.com" };

  beforeAll(() => {
    jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockResolvedValue(mockTab as chrome.tabs.Tab);
    jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(false);
    jest.spyOn(Utils, "getHostname").mockReturnValue("example.com");
  });

  beforeEach(async () => {
    dialogServiceMock = mock<DialogService>();
    dialogServiceMock.open.mockClear();

    const activatedRouteMock = {
      snapshot: { paramMap: { get: jest.fn() } },
    };

    const i18nServiceMock = mock<I18nService>();
    const folderServiceMock = mock<FolderService>();
    const folderApiServiceAbstractionMock = mock<FolderApiServiceAbstraction>();
    const accountServiceMock = mock<AccountService>();
    restrictedItemTypesServiceMock = {
      restricted$: new BehaviorSubject<RestrictedCipherType[]>([]),
    } as any;

    await TestBed.configureTestingModule({
      imports: [
        JslibModule,
        CommonModule,
        RouterLink,
        ButtonModule,
        MenuModule,
        NoItemsModule,
        NewItemDropdownV2Component,
      ],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: ConfigService, useValue: { getFeatureFlag: () => Promise.resolve(false) } },
        { provide: DialogService, useValue: dialogServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: BrowserApi, useValue: browserApiMock },
        { provide: FolderService, useValue: folderServiceMock },
        { provide: FolderApiServiceAbstraction, useValue: folderApiServiceAbstractionMock },
        { provide: AccountService, useValue: accountServiceMock },
        { provide: RestrictedItemTypesService, useValue: restrictedItemTypesServiceMock },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NewItemDropdownV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("buildQueryParams", () => {
    it("should build query params for a Login cipher when not popped out", async () => {
      await component.ngOnInit();
      component.initialValues = {
        folderId: "222-333-444",
        organizationId: "444-555-666",
        collectionId: "777-888-999",
      } as NewItemInitialValues;

      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(false);
      jest.spyOn(Utils, "getHostname").mockReturnValue("example.com");

      const params = await component.buildQueryParams(CipherType.Login);

      expect(params).toEqual({
        type: CipherType.Login.toString(),
        collectionId: "777-888-999",
        organizationId: "444-555-666",
        folderId: "222-333-444",
        prefillNameAndURIFromTab: "true",
      });
    });

    it("should build query params for a Login cipher when popped out", async () => {
      component.initialValues = {
        collectionId: "777-888-999",
      } as NewItemInitialValues;

      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(true);

      const params = await component.buildQueryParams(CipherType.Login);

      expect(params).toEqual({
        type: CipherType.Login.toString(),
        collectionId: "777-888-999",
      });
    });

    it("should build query params for a secure note", async () => {
      component.initialValues = {
        collectionId: "777-888-999",
      } as NewItemInitialValues;

      const params = await component.buildQueryParams(CipherType.SecureNote);

      expect(params).toEqual({
        type: CipherType.SecureNote.toString(),
        collectionId: "777-888-999",
      });
    });

    it("should build query params for an Identity", async () => {
      component.initialValues = {
        collectionId: "777-888-999",
      } as NewItemInitialValues;

      const params = await component.buildQueryParams(CipherType.Identity);

      expect(params).toEqual({
        type: CipherType.Identity.toString(),
        collectionId: "777-888-999",
      });
    });

    it("should build query params for a Card", async () => {
      component.initialValues = {
        collectionId: "777-888-999",
      } as NewItemInitialValues;

      const params = await component.buildQueryParams(CipherType.Card);

      expect(params).toEqual({
        type: CipherType.Card.toString(),
        collectionId: "777-888-999",
      });
    });

    it("should build query params for a SshKey", async () => {
      component.initialValues = {
        collectionId: "777-888-999",
      } as NewItemInitialValues;

      const params = await component.buildQueryParams(CipherType.SshKey);

      expect(params).toEqual({
        type: CipherType.SshKey.toString(),
        collectionId: "777-888-999",
      });
    });
  });
});
