import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";
import { DialogService } from "@bitwarden/components";
import { GlobalStateProvider } from "@bitwarden/state";
import { FakeGlobalStateProvider } from "@bitwarden/state-test-utils";
import { AddEditFolderDialogComponent, AddItemGridComponent } from "@bitwarden/vault";

import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";

import { NewItemPageComponent } from "./new-item-page.component";

describe("NewItemPageComponent", () => {
  let component: NewItemPageComponent;
  let fixture: ComponentFixture<NewItemPageComponent>;
  let accountServiceMock: jest.Mocked<AccountService>;
  let billingAccountProfileStateServiceMock: jest.Mocked<BillingAccountProfileStateService>;
  let restrictedItemTypesServiceMock: { restricted$: BehaviorSubject<RestrictedCipherType[]> };

  const mockActiveAccount = { id: "user-1" as any };

  let navigate: jest.SpyInstance;

  beforeEach(async () => {
    accountServiceMock = mock<AccountService>();
    billingAccountProfileStateServiceMock = mock<BillingAccountProfileStateService>();
    restrictedItemTypesServiceMock = {
      restricted$: new BehaviorSubject<RestrictedCipherType[]>([]),
    };

    accountServiceMock.activeAccount$ = of(mockActiveAccount) as any;
    billingAccountProfileStateServiceMock.hasPremiumFromAnySource$.mockReturnValue(of(false));

    const activatedRouteMock = {
      queryParams: of({}),
      snapshot: { paramMap: { get: jest.fn() } },
    };

    jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(false);

    await TestBed.configureTestingModule({
      imports: [NewItemPageComponent, RouterTestingModule],
      providers: [
        { provide: AccountService, useValue: accountServiceMock },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingAccountProfileStateServiceMock,
        },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: RestrictedItemTypesService, useValue: restrictedItemTypesServiceMock },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewItemPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);
  });

  const newItemGrid = () => fixture.debugElement.query(By.directive(AddItemGridComponent));

  describe("onCipherSelected", () => {
    it("navigates to /add-cipher with correct query params for a non-login cipher", async () => {
      newItemGrid().triggerEventHandler("cipherSelected", CipherType.SecureNote);

      const navigateCall = navigate.mock.calls[0];
      const queryParams = navigateCall[1].queryParams;

      expect(navigate).toHaveBeenCalledWith(
        ["/add-cipher"],
        expect.objectContaining({
          queryParams: expect.objectContaining({
            type: CipherType.SecureNote.toString(),
          }),
        }),
      );
      expect(queryParams.prefillNameAndURIFromTab).toBeUndefined();
    });

    it("adds prefillNameAndURIFromTab=true for Login cipher when not popped out", () => {
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(false);

      component["onCipherSelected"](CipherType.Login);

      expect(navigate).toHaveBeenCalledWith(
        ["/add-cipher"],
        expect.objectContaining({
          queryParams: expect.objectContaining({
            type: CipherType.Login.toString(),
            prefillNameAndURIFromTab: "true",
          }),
        }),
      );
    });

    it("does NOT add prefillNameAndURIFromTab for Login cipher when popped out", () => {
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(true);

      newItemGrid().triggerEventHandler("cipherSelected", CipherType.Login);

      const navigateCall = navigate.mock.calls[0];
      const queryParams = navigateCall[1].queryParams;
      expect(queryParams.prefillNameAndURIFromTab).toBeUndefined();
    });

    it("passes folderId, organizationId, and collectionId from route params", async () => {
      const activatedRoute = TestBed.inject(ActivatedRoute);
      (activatedRoute as any).queryParams = of({
        folderId: "folder-1",
        organizationId: "org-1",
        collectionId: "col-1",
      });

      // Recreate component with new route params
      fixture = TestBed.createComponent(NewItemPageComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      // Allow async switchMap to resolve
      await fixture.whenStable();

      newItemGrid().triggerEventHandler("cipherSelected", CipherType.Identity);

      expect(navigate).toHaveBeenCalledWith(
        ["/add-cipher"],
        expect.objectContaining({
          queryParams: expect.objectContaining({
            type: CipherType.Identity.toString(),
            folderId: "folder-1",
            organizationId: "org-1",
            collectionId: "col-1",
          }),
        }),
      );
    });
  });

  describe("onFolderSelected", () => {
    it("opens the AddEditFolderDialogComponent", () => {
      const openSpy = jest
        .spyOn(AddEditFolderDialogComponent, "open")
        .mockImplementation(() => ({}) as any);

      newItemGrid().triggerEventHandler("folderSelected", null);

      expect(openSpy).toHaveBeenCalled();
    });
  });
});
