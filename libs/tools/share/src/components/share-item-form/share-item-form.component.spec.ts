import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { PolicyType } from "@bitwarden/sdk-internal";

import { ShareLink, ShareLinkService } from "../..";

import { ShareItemFormComponent } from "./share-item-form.component";

const mockUserId = "user-123" as UserId;

const mockCipher = Object.assign(new CipherView(), {
  id: "cipher-123",
  name: "Test Login",
  type: CipherType.Login,
  login: { username: "user@example.com", uris: [] },
});

describe("ShareItemFormComponent", () => {
  let hostFixture: ComponentFixture<ShareItemFormComponent>;
  let component: ShareItemFormComponent;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let toastService: MockProxy<ToastService>;
  let shareLinkService: MockProxy<ShareLinkService>;
  let i18nService: MockProxy<I18nService>;
  let policyService: MockProxy<PolicyService>;
  const policies = new BehaviorSubject<Policy[]>([]);

  beforeEach(async () => {
    platformUtilsService = mock<PlatformUtilsService>();
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();
    shareLinkService = mock<ShareLinkService>();

    i18nService.t.mockImplementation((key: string) => key);
    shareLinkService["links$"] = new BehaviorSubject<ShareLink[]>([]);

    const collectionService = mock<CollectionService>();
    collectionService.decryptedCollections$.mockReturnValue(of([]));

    const folderService = mock<FolderService>();
    folderService.folderViews$.mockReturnValue(of([]));

    policyService = mock<PolicyService>();
    policyService.policiesByType$.mockReturnValue(policies);

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, ShareItemFormComponent],
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
        { provide: PolicyService, useValue: policyService },
        { provide: LogService, useValue: mock<LogService>() },
      ],
    }).compileComponents();

    hostFixture = TestBed.createComponent(ShareItemFormComponent);
    component = hostFixture.componentInstance;
    hostFixture.componentRef.setInput("cipher", mockCipher);
    hostFixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should not create link when form is invalid", async () => {
    component.form.controls.emails.setValue("");
    await component.createAndCopyLink();
    expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
  });

  it("should create and copy link when form is valid", async () => {
    component.form.controls.emails.setValue("recipient@example.com");
    shareLinkService.createShareLink.mockResolvedValue("https://send.bitwarden.com/access-id/key");

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
    component.form.controls.emails.setValue("a@test.com, b@test.com, c@test.com");
    shareLinkService.createShareLink.mockResolvedValue("https://send.bitwarden.com/access-id/key");

    await component.createAndCopyLink();

    expect(shareLinkService.createShareLink).toHaveBeenCalledWith(
      mockCipher,
      ["a@test.com", "b@test.com", "c@test.com"],
      168,
      false,
    );
  });

  it("should copy link to clipboard", async () => {
    const mockLink = {
      cipherId: "cipher-123" as CipherId,
      sendId: "send-1",
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
    const mockLink = {
      cipherId: "cipher-123" as CipherId,
      sendId: "send-1",
      emails: ["test@test.com"],
      expiresAt: new Date(),
      oneTimeShare: false,
      url: "https://vault.bitwarden.com/share/abc",
    };

    await component["deleteLink"](mockLink);

    expect(shareLinkService.deleteLink).toHaveBeenCalledWith("send-1");
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "success",
        message: "shareLinkDeleted",
      }),
    );
  });

  it("should set the deletion date field to comply with any Send Controls policies", async () => {
    policies.next([{ type: PolicyType.SendControls, data: { deletionHours: 72 } } as Policy]);
    hostFixture.detectChanges();
    const expiryHoursFormControl = component.form.get("expiryHours");
    expect(expiryHoursFormControl?.value).toEqual(72);
    expect(expiryHoursFormControl?.disabled).toEqual(true);
  });
});
