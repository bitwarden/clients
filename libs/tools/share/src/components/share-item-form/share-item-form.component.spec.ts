import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { SendDeletionDatePreset } from "@bitwarden/common/tools/models/send-deletion-date-preset";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { ToastService } from "@bitwarden/components";
import { newGuid } from "@bitwarden/guid";
import { LogService } from "@bitwarden/logging";
import { OrganizationId } from "@bitwarden/sdk-internal";
import { SendPolicyService } from "@bitwarden/send-ui";

import { ShareLink, ShareLinkService } from "../../services/share-link.service";

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
  let collections$: BehaviorSubject<CollectionView[]>;
  let folderViews$: BehaviorSubject<FolderView[]>;
  // Mock SendPolicyService observables
  let deletionDatePolicyInfo$: BehaviorSubject<{
    deletionHours: SendDeletionDatePreset | null;
    orgId: OrganizationId | null;
  } | null>;
  let allowedDomains$: BehaviorSubject<string[]>;
  let organizations$: BehaviorSubject<
    {
      id: OrganizationId;
      name: string;
    }[]
  >;

  beforeEach(async () => {
    platformUtilsService = mock<PlatformUtilsService>();
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();
    shareLinkService = mock<ShareLinkService>();

    i18nService.t.mockImplementation((key: string) => key);
    shareLinkService["links$"] = new BehaviorSubject<ShareLink[]>([]);

    collections$ = new BehaviorSubject<CollectionView[]>([]);
    const collectionService = mock<CollectionService>();
    collectionService.decryptedCollections$.mockReturnValue(collections$);

    folderViews$ = new BehaviorSubject<FolderView[]>([]);
    const folderService = mock<FolderService>();
    folderService.folderViews$.mockReturnValue(folderViews$);

    deletionDatePolicyInfo$ = new BehaviorSubject<{
      deletionHours: SendDeletionDatePreset | null;
      orgId: OrganizationId | null;
    } | null>(null);
    allowedDomains$ = new BehaviorSubject<string[]>([]);
    organizations$ = new BehaviorSubject<
      {
        id: OrganizationId;
        name: string;
      }[]
    >([]);

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
        { provide: SendPolicyService, useValue: { deletionDatePolicyInfo$, allowedDomains$ } },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
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

  describe("item details", () => {
    const accordion = () => hostFixture.debugElement.query(By.css("bit-accordion"));
    const summary = () => hostFixture.debugElement.query(By.css("#share-item-form_item-summary"));

    it("shows the item without an accordion when it has no folder or collections", () => {
      expect(accordion()).toBeNull();
      expect(summary()).not.toBeNull();
      expect(summary().nativeElement.textContent).toContain("Test Login");
    });

    it("shows the accordion when the item is in a folder", () => {
      folderViews$.next([Object.assign(new FolderView(), { id: "folder-1", name: "Work" })]);
      hostFixture.componentRef.setInput(
        "cipher",
        Object.assign(new CipherView(), { ...mockCipher, folderId: "folder-1" }),
      );
      hostFixture.detectChanges();

      expect(summary()).toBeNull();
      expect(accordion()).not.toBeNull();
      expect(accordion().nativeElement.textContent).toContain("Work");
    });

    it("shows the accordion when the item is in a collection", () => {
      collections$.next([
        Object.assign(Object.create(CollectionView.prototype), { id: "col-1", name: "Team" }),
      ]);
      hostFixture.componentRef.setInput(
        "cipher",
        Object.assign(new CipherView(), { ...mockCipher, collectionIds: ["col-1"] }),
      );
      hostFixture.detectChanges();

      expect(summary()).toBeNull();
      expect(accordion()).not.toBeNull();
      expect(accordion().nativeElement.textContent).toContain("Team");
    });

    it("keeps the accordion hidden when the item's folder no longer exists", () => {
      hostFixture.componentRef.setInput(
        "cipher",
        Object.assign(new CipherView(), { ...mockCipher, folderId: "deleted-folder" }),
      );
      hostFixture.detectChanges();

      expect(accordion()).toBeNull();
      expect(summary()).not.toBeNull();
    });
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
    const orgId = newGuid() as unknown as OrganizationId;
    organizations$.next([{ name: "Test Org", id: orgId }]);
    deletionDatePolicyInfo$.next({ deletionHours: 72, orgId });
    hostFixture.detectChanges();
    const expiryHoursFormControl = component.form.get("expiryHours");
    expect(expiryHoursFormControl?.value).toEqual(72);
    expect(expiryHoursFormControl?.disabled).toEqual(true);
    deletionDatePolicyInfo$.next(null);
  });
});
