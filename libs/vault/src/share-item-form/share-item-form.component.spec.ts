import { ChangeDetectionStrategy, Component, viewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ToastService } from "@bitwarden/components";

import { ShareLinkService } from "../share-link.service";

import { ShareItemFormComponent } from "./share-item-form.component";

const mockUserId = "user-123" as UserId;

const mockCipher = Object.assign(new CipherView(), {
  id: "cipher-123",
  name: "Test Login",
  type: CipherType.Login,
  login: { username: "user@example.com", uris: [] },
});

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ShareItemFormComponent],
  template: `<app-share-item-form [cipher]="cipher"></app-share-item-form>`,
})
class TestHostComponent {
  cipher = mockCipher;
  readonly shareItemForm = viewChild.required(ShareItemFormComponent);
}

describe("ShareItemFormComponent", () => {
  let hostFixture: ComponentFixture<TestHostComponent>;
  let component: ShareItemFormComponent;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let toastService: MockProxy<ToastService>;
  let shareLinkService: ShareLinkService;
  let i18nService: MockProxy<I18nService>;

  beforeEach(async () => {
    platformUtilsService = mock<PlatformUtilsService>();
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();
    shareLinkService = new ShareLinkService();

    i18nService.t.mockImplementation((key: string) => key);

    const collectionService = mock<CollectionService>();
    collectionService.decryptedCollections$.mockReturnValue(of([]));

    const folderService = mock<FolderService>();
    folderService.folderViews$.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, TestHostComponent, ShareItemFormComponent],
      providers: [
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
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: ShareLinkService, useValue: shareLinkService },
        { provide: CollectionService, useValue: collectionService },
        { provide: FolderService, useValue: folderService },
      ],
    }).compileComponents();

    hostFixture = TestBed.createComponent(TestHostComponent);
    hostFixture.detectChanges();
    component = hostFixture.componentInstance.shareItemForm();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should start with accordion collapsed", () => {
    expect(component["accordionExpanded"]()).toBe(false);
  });

  it("should not create link when form is invalid", async () => {
    component.form.controls.emails.setValue("");
    await component.createAndCopyLink();
    expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
  });

  it("should create and copy link when form is valid", async () => {
    component.form.controls.emails.setValue("recipient@example.com");

    await component.createAndCopyLink();

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
    component.form.controls.emails.setValue("a@test.com, b@test.com, c@test.com");

    await component.createAndCopyLink();

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
