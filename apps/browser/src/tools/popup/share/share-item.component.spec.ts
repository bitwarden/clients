import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ToastService } from "@bitwarden/components";

import { PopupRouterCacheService } from "../../../platform/popup/view-cache/popup-router-cache.service";

import { ShareItemComponent } from "./share-item.component";
import { ShareLinkService } from "./share-link.service";

describe("ShareItemComponent", () => {
  let component: ShareItemComponent;
  let fixture: ComponentFixture<ShareItemComponent>;
  let cipherService: MockProxy<CipherService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let toastService: MockProxy<ToastService>;
  let shareLinkService: ShareLinkService;
  let i18nService: MockProxy<I18nService>;

  const queryParams$ = new BehaviorSubject<Record<string, string>>({
    cipherId: "cipher-123" as CipherId,
  });

  const mockCipher = Object.assign(new CipherView(), {
    id: "cipher-123",
    name: "Test Login",
    type: CipherType.Login,
    login: { username: "user@example.com", uris: [] },
  });

  const mockUserId = "user-123" as UserId;

  beforeEach(async () => {
    cipherService = mock<CipherService>();
    platformUtilsService = mock<PlatformUtilsService>();
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();
    shareLinkService = new ShareLinkService();

    i18nService.t.mockImplementation((key: string) => key);

    cipherService.cipherView$.mockReturnValue(of(mockCipher));

    const collectionService = mock<CollectionService>();
    collectionService.decryptedCollections$.mockReturnValue(of([]));

    const folderService = mock<FolderService>();
    folderService.folderViews$.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, RouterTestingModule, ShareItemComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { queryParams: queryParams$ },
        },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({
              id: mockUserId,
              ...mockAccountInfoWith({
                email: "test@email.com",
                name: "Test User",
              }),
            }),
          },
        },
        { provide: CipherService, useValue: cipherService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: ShareLinkService, useValue: shareLinkService },
        { provide: CollectionService, useValue: collectionService },
        { provide: FolderService, useValue: folderService },
        {
          provide: PopupRouterCacheService,
          useValue: mock<PopupRouterCacheService>(),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should load cipher from route query params", () => {
    expect(cipherService.cipherView$).toHaveBeenCalledWith(mockUserId, "cipher-123");
  });

  it("should start with accordion collapsed", () => {
    expect(component["accordionExpanded"]()).toBe(false);
  });

  it("should not create link when form is invalid", async () => {
    component["form"].controls.emails.setValue("");
    await component["createAndCopyLink"]();
    expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
  });

  it("should create and copy link when form is valid", async () => {
    component["form"].controls.emails.setValue("recipient@example.com");

    await component["createAndCopyLink"]();

    expect(platformUtilsService.copyToClipboard).toHaveBeenCalled();
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "success",
        message: "linkSavedAndCopied",
      }),
    );
  });

  it("should parse comma-delimited emails correctly", async () => {
    const createSpy = jest.spyOn(shareLinkService, "createShareLink");
    component["form"].controls.emails.setValue("a@test.com, b@test.com, c@test.com");

    await component["createAndCopyLink"]();

    expect(createSpy).toHaveBeenCalledWith(
      "cipher-123",
      ["a@test.com", "b@test.com", "c@test.com"],
      168,
      false,
    );
  });

  it("should copy link to clipboard", async () => {
    const mockLink = {
      id: "link-1",
      cipherId: "cipher-123" as CipherId,
      emails: ["test@test.com"],
      expiresAt: new Date(),
      oneTimeShare: false,
      url: "https://vault.bitwarden.com/share/abc",
    };

    await component["copyLink"](mockLink);

    expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(
      "https://vault.bitwarden.com/share/abc",
    );
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "success",
        message: "linkCopiedToClipboard",
      }),
    );
  });

  it("should delete a link and show toast", async () => {
    const deleteSpy = jest.spyOn(shareLinkService, "deleteLink");
    const mockLink = {
      id: "link-1",
      cipherId: "cipher-123" as CipherId,
      emails: ["test@test.com"],
      expiresAt: new Date(),
      oneTimeShare: false,
      url: "https://vault.bitwarden.com/share/abc",
    };

    await component["deleteLink"](mockLink);

    expect(deleteSpy).toHaveBeenCalledWith("link-1");
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "success",
        message: "shareLinkDeleted",
      }),
    );
  });
});
