import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";
import { DialogService } from "@bitwarden/components";
import { GlobalStateProvider } from "@bitwarden/state";
import { FakeGlobalStateProvider } from "@bitwarden/state-test-utils";
import {
  AddEditFolderDialogComponent,
  AddItemGridComponent,
  AddItemGridResult,
} from "@bitwarden/vault";

import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";

import { NewItemPageComponent } from "./new-item-page.component";

describe("NewItemPageComponent", () => {
  let fixture: ComponentFixture<NewItemPageComponent>;
  let restrictedItemTypesServiceMock: { restricted$: BehaviorSubject<RestrictedCipherType[]> };

  let navigate: jest.SpyInstance;
  let queryParams$: BehaviorSubject<Record<string, string>>;
  let organizationService: MockProxy<OrganizationService>;

  beforeEach(async () => {
    restrictedItemTypesServiceMock = {
      restricted$: new BehaviorSubject<RestrictedCipherType[]>([]),
    };

    queryParams$ = new BehaviorSubject<Record<string, string>>({});
    const activatedRouteMock = {
      queryParams: queryParams$,
      snapshot: { paramMap: { get: jest.fn() } },
    };

    jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(false);

    organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [NewItemPageComponent, RouterTestingModule],
      providers: [
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: RestrictedItemTypesService, useValue: restrictedItemTypesServiceMock },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
        { provide: OrganizationService, useValue: organizationService },
        {
          provide: AccountService,
          useValue: mockAccountServiceWith("user-1" as UserId),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewItemPageComponent);
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    navigate = jest.spyOn(router, "navigate").mockResolvedValue(true);
  });

  const newItemGrid = () => fixture.debugElement.query(By.directive(AddItemGridComponent));

  it("passes correct creation flags to the grid", () => {
    expect(newItemGrid().componentInstance.canCreateSshKey()).toBe(true);
    expect(newItemGrid().componentInstance.canCreateFolder()).toBe(true);
    expect(newItemGrid().componentInstance.canCreateCollection()).toBe(false);
    expect(newItemGrid().componentInstance.canCreateCipher()).toBe(true);
  });

  describe("canCreateCipher", () => {
    it("is true when no organizationId is set", async () => {
      await fixture.whenStable();
      expect((fixture.componentInstance as any).canCreateCipher()).toBe(true);
    });

    it("is true when the target organization is enabled", async () => {
      organizationService.organizations$.mockReturnValue(
        of([{ id: "org-1", enabled: true } as any]),
      );
      queryParams$.next({ organizationId: "org-1" });
      await fixture.whenStable();

      expect((fixture.componentInstance as any).canCreateCipher()).toBe(true);
    });

    it("is false when the target organization is suspended (disabled)", async () => {
      organizationService.organizations$.mockReturnValue(
        of([{ id: "org-1", enabled: false } as any]),
      );
      queryParams$.next({ organizationId: "org-1" });
      await fixture.whenStable();

      expect((fixture.componentInstance as any).canCreateCipher()).toBe(false);
    });
  });

  describe("onItemSelected", () => {
    describe("cipher", () => {
      it("navigates to /add-cipher with correct query params for a non-login cipher", async () => {
        newItemGrid().triggerEventHandler("itemSelected", {
          result: AddItemGridResult.Cipher,
          cipherType: CipherType.SecureNote,
        });

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

        newItemGrid().triggerEventHandler("itemSelected", {
          result: AddItemGridResult.Cipher,
          cipherType: CipherType.Login,
        });

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

        newItemGrid().triggerEventHandler("itemSelected", {
          result: AddItemGridResult.Cipher,
          cipherType: CipherType.Login,
        });

        const navigateCall = navigate.mock.calls[0];
        const queryParams = navigateCall[1].queryParams;
        expect(queryParams.prefillNameAndURIFromTab).toBeUndefined();
      });

      it("does not navigate when canCreateCipher is false, e.g. because the organization is suspended", async () => {
        organizationService.organizations$.mockReturnValue(
          of([{ id: "org-1", enabled: false } as any]),
        );
        queryParams$.next({ organizationId: "org-1" });
        await fixture.whenStable();

        newItemGrid().triggerEventHandler("itemSelected", {
          result: AddItemGridResult.Cipher,
          cipherType: CipherType.SecureNote,
        });

        expect(navigate).not.toHaveBeenCalled();
      });

      it("passes folderId, organizationId, and collectionId from route params", async () => {
        queryParams$.next({ folderId: "folder-1", organizationId: "org-1", collectionId: "col-1" });
        await fixture.whenStable();

        newItemGrid().triggerEventHandler("itemSelected", {
          result: AddItemGridResult.Cipher,
          cipherType: CipherType.Identity,
        });

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

    describe("folder", () => {
      it("opens the AddEditFolderDialogComponent", () => {
        const openSpy = jest
          .spyOn(AddEditFolderDialogComponent, "open")
          .mockImplementation(() => ({}) as any);

        newItemGrid().triggerEventHandler("itemSelected", { result: AddItemGridResult.Folder });

        expect(openSpy).toHaveBeenCalled();
      });
    });
  });
});
