import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SelfHostedEnvironment } from "@bitwarden/common/platform/services/default-environment.service";
import { SendDeletionDatePreset } from "@bitwarden/common/tools/models/send-deletion-date-preset";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { UserId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  DIALOG_DATA,
  DialogRef,
  DialogService,
  I18nMockService,
  ToastService,
} from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { SendPolicyService } from "@bitwarden/send-ui";
import { CipherViewComponent } from "@bitwarden/vault";

import { ItemSendDrawerComponent, ItemSendDrawerResult } from "./item-send-drawer.component";

@Component({
  selector: "app-cipher-view",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockCipherViewComponent {
  readonly cipher = input<CipherView>();
  readonly hideChangePasswordLink = input<boolean>(false);
  readonly hideItemHistory = input<boolean>(false);
}

const HOUR = 60 * 60 * 1000;

function createItemSend(id: string, cipher: CipherView, deletionDate: Date): SendView {
  const send = new SendView();
  send.id = id;
  send.accessId = `access-${id}`;
  send.type = SendType.Item;
  send.authType = AuthType.Email;
  send.emails = ["emily@bitwarden.com", "jillian@bitwarden.com"];
  send.key = new Uint8Array([1, 2, 3]);
  send.deletionDate = deletionDate;
  send.expirationDate = deletionDate;
  send.data.data = cipher;
  return send;
}

describe("ItemSendDrawerComponent", () => {
  beforeAll(() => {
    // jsdom does not implement IntersectionObserver; the bit-dialog wrapper this component
    // renders into uses it internally (see libs/components/src/utils/dom-observables.ts).
    global.IntersectionObserver = class {
      constructor() {}
      disconnect() {}
      observe() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      unobserve() {}
    } as any;
  });

  let fixture: ComponentFixture<ItemSendDrawerComponent>;
  let component: ItemSendDrawerComponent;

  let dialogRef: MockProxy<DialogRef<ItemSendDrawerResult>>;
  let dialogService: MockProxy<DialogService>;
  let sendApiService: MockProxy<SendApiService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let toastService: MockProxy<ToastService>;
  let folderService: MockProxy<FolderService>;
  let organizationService: MockProxy<OrganizationService>;
  let deletionDatePolicyInfo$: BehaviorSubject<{ deletionHours: number; orgId: string } | null>;
  let sendViews$: BehaviorSubject<SendView[]>;

  let cipher: CipherView;
  let send: SendView;
  const userId = "user-id" as UserId;
  const deletionDate = new Date(Date.now() + 7 * 24 * HOUR);

  const query = (id: string) => fixture.debugElement.query(By.css(`#${id}`));
  const testId = (id: string) => fixture.debugElement.query(By.css(`[data-testid="${id}"]`));

  async function createComponent() {
    fixture = TestBed.createComponent(ItemSendDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    cipher = new CipherView();
    cipher.id = "cipher-id";
    cipher.name = "Github account";
    cipher.type = CipherType.Login;
    cipher.folderId = "folder-id";

    send = createItemSend("send-id", cipher, deletionDate);

    dialogRef = mock<DialogRef<ItemSendDrawerResult>>();
    dialogService = mock<DialogService>();
    sendApiService = mock<SendApiService>();
    platformUtilsService = mock<PlatformUtilsService>();
    toastService = mock<ToastService>();
    folderService = mock<FolderService>();
    organizationService = mock<OrganizationService>();
    deletionDatePolicyInfo$ = new BehaviorSubject<{ deletionHours: number; orgId: string } | null>(
      null,
    );
    sendViews$ = new BehaviorSubject<SendView[]>([send]);

    const folder = new FolderView();
    folder.name = "Work";
    folderService.getDecrypted$.mockReturnValue(of(folder));
    organizationService.organizations$.mockReturnValue(of([]));

    const environmentService = mock<EnvironmentService>();
    Object.defineProperty(environmentService, "environment$", {
      get: () => of(new SelfHostedEnvironment({ webVault: "https://example.com" })),
    });

    await TestBed.configureTestingModule({
      imports: [ItemSendDrawerComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: { send } },
        { provide: DialogRef, useValue: dialogRef },
        { provide: DialogService, useValue: dialogService },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: userId }) },
        },
        { provide: EnvironmentService, useValue: environmentService },
        { provide: FolderService, useValue: folderService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: SendApiService, useValue: sendApiService },
        { provide: SendService, useValue: { sendViews$ } },
        {
          provide: SendPolicyService,
          useValue: { deletionDatePolicyInfo$ },
        },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              viewSharedItem: "View shared item",
              editSharedItem: "Edit shared item",
              copyShareLink: "Copy share link",
              myVault: "My vault",
              sendDetails: "Send details",
              emails: "Emails",
              linkExpiresAfter: "Link expires after",
              shareLinkExpiryHint: "Expiry hint",
              deletionDate: "Deletion date",
              deletionDateDescV2: "Deletion hint",
              linkExpiryAfterDeletionDate: "The link can't expire after the deletion date.",
              sendDeletionDateSetByOrg: "Set by __$1__",
              oneTimeShare: "One time share",
              activeLinks: "Active links",
              shareLinkExpires: "Expires",
              current: "Current",
              copyLink: "Copy link",
              oneHour: "1 hour",
              oneDay: "1 day",
              days: "__$1__ days",
              durationTimeHours: "__$1__ hours",
              linkCopiedToClipboard: "Link copied to clipboard",
              editedSend: "Send saved",
              deletedSend: "Send deleted",
              errorOccurred: "An error has occurred.",
              save: "Save",
              cancel: "Cancel",
              edit: "Edit",
              delete: "Delete",
              close: "Close",
              loading: "Loading",
              toggleCollapse: "Toggle collapse",
              selectPlaceholder: "-- Select --",
              multiSelectPlaceholder: "-- Type to filter --",
              multiSelectLoading: "Retrieving options...",
              multiSelectNotFound: "No items found",
              multiSelectClearAll: "Clear all",
            }),
        },
      ],
    })
      .overrideComponent(ItemSendDrawerComponent, {
        remove: { imports: [CipherViewComponent] },
        add: { imports: [MockCipherViewComponent] },
      })
      // DialogModule provides its own DialogService, so it has to be overridden rather than provided
      .overrideProvider(DialogService, { useValue: dialogService })
      .compileComponents();
  });

  describe("view mode", () => {
    beforeEach(async () => {
      await createComponent();
    });

    it("shows the read-only item content in an accordion that is open on load", () => {
      const accordion = testId("shared-item-accordion");
      expect(accordion).not.toBeNull();
      expect(accordion.nativeElement.textContent).toContain("Github account");

      const cipherView = fixture.debugElement.query(By.directive(MockCipherViewComponent));
      expect(cipherView).not.toBeNull();
      expect(cipherView.componentInstance.cipher()).toBe(send.data.data);
    });

    it("shows the owner and folder of the shared item", () => {
      expect(testId("shared-item-owner").nativeElement.textContent.trim()).toBe("My vault");
      expect(testId("shared-item-folder").nativeElement.textContent.trim()).toBe("Work");
    });

    it("shows the emails, time until expiry, and deletion date", () => {
      expect(testId("send-emails").nativeElement.textContent.trim()).toBe(
        "emily@bitwarden.com, jillian@bitwarden.com",
      );
      expect(testId("send-expires-after").nativeElement.textContent.trim()).toBe("7 days");
      expect(testId("send-deletion-date").nativeElement.textContent.trim()).not.toBe("");
    });

    it("only shows the one-time share indicator when the Send can be accessed once", async () => {
      expect(testId("send-one-time-share")).toBeNull();

      send.maxAccessCount = 1;
      await createComponent();

      expect(testId("send-one-time-share")).not.toBeNull();
    });

    it("shows the organization name as the owner of organization items", async () => {
      send.data.data!.organizationId = "org-id" as any;
      organizationService.organizations$.mockReturnValue(
        of([{ id: "org-id", name: "Acme" } as Organization]),
      );
      await createComponent();

      expect(testId("shared-item-owner").nativeElement.textContent.trim()).toBe("Acme");
    });

    it("does not render any editable fields", () => {
      expect(query("item-send-drawer_select_expiry")).toBeNull();
      expect(query("item-send-drawer_select_deletion-date")).toBeNull();
      expect(query("item-send-drawer_checkbox_one-time-share")).toBeNull();
      expect(query("item-send-drawer_button_save")).toBeNull();
    });

    it("copies the share link", async () => {
      query("item-send-drawer_button_copy-share-link").nativeElement.click();
      await fixture.whenStable();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(
        "https://example.com/#/send/access-send-id/" + send.urlB64Key,
      );
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "Link copied to clipboard" }),
      );
    });
  });

  describe("edit mode", () => {
    beforeEach(async () => {
      await createComponent();
      query("item-send-drawer_button_edit").nativeElement.click();
      fixture.detectChanges();
    });

    it("shows the expiry, deletion date, and one-time share controls with the current values", () => {
      expect(query("item-send-drawer_select_expiry")).not.toBeNull();
      expect(query("item-send-drawer_select_deletion-date")).not.toBeNull();
      expect(component.form.getRawValue()).toEqual({
        expiry: deletionDate.toString(),
        deletionDate: deletionDate.toString(),
        oneTimeShare: false,
      });
    });

    it("keeps the emails and item content read-only", () => {
      const emails = query("item-send-drawer_textarea_emails").nativeElement as HTMLTextAreaElement;
      expect(emails.readOnly).toBe(true);
      expect(fixture.debugElement.query(By.directive(MockCipherViewComponent))).not.toBeNull();
    });

    it("saves the expiry, deletion date, and one-time share option separately", async () => {
      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValue(now);
      component.form.setValue({
        expiry: SendDeletionDatePreset.OneDay,
        deletionDate: SendDeletionDatePreset.ThreeDays,
        oneTimeShare: true,
      });

      query("item-send-drawer_button_save").nativeElement.click();
      await fixture.whenStable();

      expect(sendApiService.saveView).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "send-id",
          expirationDate: new Date(now + 24 * HOUR),
          deletionDate: new Date(now + 72 * HOUR),
          maxAccessCount: 1,
        }),
        null,
      );
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "Send saved" }),
      );

      fixture.detectChanges();
      expect(query("item-send-drawer_button_edit")).not.toBeNull();
      expect(testId("send-one-time-share")).not.toBeNull();
    });

    it("keeps the current dates and clears one-time share", async () => {
      send.maxAccessCount = 1;
      component.form.setValue({
        expiry: deletionDate.toString(),
        deletionDate: deletionDate.toString(),
        oneTimeShare: false,
      });

      query("item-send-drawer_button_save").nativeElement.click();
      await fixture.whenStable();

      expect(sendApiService.saveView).toHaveBeenCalledWith(
        expect.objectContaining({
          deletionDate,
          expirationDate: deletionDate,
          maxAccessCount: undefined,
        }),
        null,
      );
    });

    it("does not save when the link would expire after the deletion date", async () => {
      component.form.setValue({
        expiry: SendDeletionDatePreset.ThirtyDays,
        deletionDate: SendDeletionDatePreset.OneDay,
        oneTimeShare: false,
      });

      query("item-send-drawer_button_save").nativeElement.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(sendApiService.saveView).not.toHaveBeenCalled();
      expect(component.form.controls.expiry.errors).toEqual({
        expiryAfterDeletionDate: { message: "The link can't expire after the deletion date." },
      });
      expect(fixture.nativeElement.textContent).toContain(
        "The link can't expire after the deletion date.",
      );
    });

    it("shows an error and stays in edit mode when saving fails", async () => {
      sendApiService.saveView.mockRejectedValue(new Error("failed"));

      query("item-send-drawer_button_save").nativeElement.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(query("item-send-drawer_button_save")).not.toBeNull();
    });

    it("returns to view mode without saving when cancelled", () => {
      query("item-send-drawer_button_cancel").nativeElement.click();
      fixture.detectChanges();

      expect(sendApiService.saveView).not.toHaveBeenCalled();
      expect(query("item-send-drawer_button_edit")).not.toBeNull();
    });
  });

  describe("deletion date policy", () => {
    beforeEach(async () => {
      deletionDatePolicyInfo$.next({ deletionHours: SendDeletionDatePreset.ThreeDays, orgId: "o" });
      await createComponent();
      query("item-send-drawer_button_edit").nativeElement.click();
      fixture.detectChanges();
    });

    it("locks the deletion date but keeps the Send's current date", () => {
      expect(component.form.controls.deletionDate.disabled).toBe(true);
      expect(component.form.getRawValue().deletionDate).toBe(deletionDate.toString());
      expect(component.form.controls.expiry.enabled).toBe(true);
    });

    it("does not move the deletion date when saving other changes", async () => {
      component.form.controls.oneTimeShare.setValue(true);

      query("item-send-drawer_button_save").nativeElement.click();
      await fixture.whenStable();

      expect(sendApiService.saveView).toHaveBeenCalledWith(
        expect.objectContaining({ deletionDate, maxAccessCount: 1 }),
        null,
      );
    });
  });

  describe("active links", () => {
    let otherLink: SendView;

    beforeEach(async () => {
      otherLink = createItemSend("other-id", cipher, new Date(Date.now() + 2 * 24 * HOUR));
      otherLink.emails = ["pika@bitwarden.com"];

      const expiredLink = createItemSend("expired-id", cipher, new Date(Date.now() + 24 * HOUR));
      expiredLink.expirationDate = new Date(Date.now() - HOUR);

      const usedLink = createItemSend("used-id", cipher, new Date(Date.now() + 24 * HOUR));
      usedLink.maxAccessCount = 1;
      usedLink.accessCount = 1;

      const otherCipher = new CipherView();
      otherCipher.id = "other-cipher-id";
      const otherItemLink = createItemSend("other-item-id", otherCipher, deletionDate);

      sendViews$.next([send, otherLink, expiredLink, usedLink, otherItemLink]);
      await createComponent();
    });

    it("lists the active links for the same item, soonest deletion first", () => {
      const rows = fixture.debugElement.queryAll(By.css("[data-testid^='active-link-']"));
      expect(rows.map((r) => r.attributes["data-testid"])).toEqual([
        "active-link-other-id",
        "active-link-send-id",
      ]);
    });

    it("marks the link being viewed as current", () => {
      expect(testId("active-link-send-id").nativeElement.textContent).toContain("Current");
      expect(testId("active-link-other-id").nativeElement.textContent).not.toContain("Current");
    });

    it("copies a link from the list", async () => {
      query("item-send-drawer_button_copy-link-other-id").nativeElement.click();
      await fixture.whenStable();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(
        "https://example.com/#/send/access-other-id/" + otherLink.urlB64Key,
      );
    });

    it("edits a link from the list", async () => {
      query("item-send-drawer_button_edit-link-other-id").nativeElement.click();
      fixture.detectChanges();

      expect(query("item-send-drawer_button_save")).not.toBeNull();
      expect(component.form.getRawValue().deletionDate).toBe(otherLink.deletionDate.toString());

      query("item-send-drawer_button_save").nativeElement.click();
      await fixture.whenStable();

      expect(sendApiService.saveView).toHaveBeenCalledWith(
        expect.objectContaining({ id: "other-id" }),
        null,
      );
    });

    it("deletes another link without closing the drawer", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);

      query("item-send-drawer_button_delete-link-other-id").nativeElement.click();
      await fixture.whenStable();

      expect(sendApiService.delete).toHaveBeenCalledWith("other-id");
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("closes the drawer when the current link is deleted from the list", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);

      query("item-send-drawer_button_delete-link-send-id").nativeElement.click();
      await fixture.whenStable();

      expect(sendApiService.delete).toHaveBeenCalledWith("send-id");
      expect(dialogRef.close).toHaveBeenCalledWith(ItemSendDrawerResult.Deleted);
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      await createComponent();
    });

    it("deletes the Send and closes the drawer when confirmed", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);

      query("item-send-drawer_button_delete").nativeElement.click();
      await fixture.whenStable();

      expect(sendApiService.delete).toHaveBeenCalledWith("send-id");
      expect(dialogRef.close).toHaveBeenCalledWith(ItemSendDrawerResult.Deleted);
    });

    it("does nothing when not confirmed", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);

      query("item-send-drawer_button_delete").nativeElement.click();
      await fixture.whenStable();

      expect(sendApiService.delete).not.toHaveBeenCalled();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });
  });
});
