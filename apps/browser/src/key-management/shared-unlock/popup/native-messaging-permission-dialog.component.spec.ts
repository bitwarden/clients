import { DIALOG_DATA } from "@angular/cdk/dialog";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, DialogService } from "@bitwarden/components";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";

import {
  NativeMessagingPermissionDialogComponent,
  NativeMessagingPermissionDialogParams,
  NativeMessagingPermissionDialogType,
} from "./native-messaging-permission-dialog.component";

describe("NativeMessagingPermissionDialogComponent", () => {
  let component: NativeMessagingPermissionDialogComponent;
  let fixture: ComponentFixture<NativeMessagingPermissionDialogComponent>;

  const dialogRef = mock<DialogRef<boolean>>();
  const dialogService = mock<DialogService>();
  const i18nService = mock<I18nService>();
  const platformUtilsService = mock<PlatformUtilsService>();

  let requestPermissionSpy: jest.SpyInstance;

  async function createComponent(params?: NativeMessagingPermissionDialogParams) {
    await TestBed.configureTestingModule({
      imports: [NativeMessagingPermissionDialogComponent],
      providers: [
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: i18nService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        {
          provide: DIALOG_DATA,
          useValue: params ?? null,
        },
      ],
    })
      // DialogModule (imported by the component) provides a real DialogService; override it
      // with the mock at the component's element injector so it shadows the module provider.
      .overrideComponent(NativeMessagingPermissionDialogComponent, {
        add: { providers: [{ provide: DialogService, useValue: dialogService }] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(NativeMessagingPermissionDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    i18nService.t.mockImplementation((key) => key);
    platformUtilsService.isFirefox.mockReturnValue(false);
    requestPermissionSpy = jest.spyOn(BrowserApi, "requestPermission");
    requestPermissionSpy.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.resetAllMocks();
    TestBed.resetTestingModule();
  });

  describe("continue()", () => {
    it("closes with true when the nativeMessaging permission is granted", async () => {
      requestPermissionSpy.mockResolvedValue(true);
      await createComponent({ type: NativeMessagingPermissionDialogType.Biometrics });

      await component.continue();

      expect(requestPermissionSpy).toHaveBeenCalledWith({ permissions: ["nativeMessaging"] });
      expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it("closes with false when the nativeMessaging permission is denied", async () => {
      requestPermissionSpy.mockResolvedValue(false);
      await createComponent({ type: NativeMessagingPermissionDialogType.Biometrics });

      await component.continue();

      expect(dialogRef.close).toHaveBeenCalledWith(false);
    });

    it("closes with false and shows the sidebar dialog when the request throws on Firefox + sidebar", async () => {
      requestPermissionSpy.mockRejectedValue(new Error("permission request failed"));
      platformUtilsService.isFirefox.mockReturnValue(true);
      jest.spyOn(BrowserPopupUtils, "inSidebar").mockReturnValue(true);
      await createComponent({ type: NativeMessagingPermissionDialogType.Biometrics });

      await component.continue();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "nativeMessaginPermissionSidebarTitle" },
        content: { key: "nativeMessaginPermissionSidebarDesc" },
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
        type: "info",
      });
      expect(dialogRef.close).toHaveBeenCalledWith(false);
    });

    it("closes with false without the sidebar dialog when the request throws elsewhere", async () => {
      requestPermissionSpy.mockRejectedValue(new Error("permission request failed"));
      platformUtilsService.isFirefox.mockReturnValue(false);
      jest.spyOn(BrowserPopupUtils, "inSidebar").mockReturnValue(false);
      await createComponent({ type: NativeMessagingPermissionDialogType.Biometrics });

      await component.continue();

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(dialogRef.close).toHaveBeenCalledWith(false);
    });
  });

  describe("description copy", () => {
    it("renders the biometrics description key for the biometrics type", async () => {
      await createComponent({ type: NativeMessagingPermissionDialogType.Biometrics });

      const description = fixture.debugElement.query(By.css("p")).nativeElement as HTMLElement;
      expect(description.textContent).toContain("biometricPermissionDesc");
    });

    it("renders the shared unlock description key for the shared unlock type", async () => {
      await createComponent({ type: NativeMessagingPermissionDialogType.SharedUnlock });

      const description = fixture.debugElement.query(By.css("p")).nativeElement as HTMLElement;
      expect(description.textContent).toContain("sharedUnlockDesktopPermissionDesc");
    });
  });

  describe("open()", () => {
    beforeEach(() => {
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(true);
    });

    it("opens the dialog via the DialogService", async () => {
      const service = mock<DialogService>();

      NativeMessagingPermissionDialogComponent.open(service, {
        type: NativeMessagingPermissionDialogType.Biometrics,
      });

      expect(service.open).toHaveBeenCalledWith(
        NativeMessagingPermissionDialogComponent,
        expect.objectContaining({ positionStrategy: expect.anything() }),
      );
    });

    it("passes params as dialog data", () => {
      const service = mock<DialogService>();
      const params: NativeMessagingPermissionDialogParams = {
        type: NativeMessagingPermissionDialogType.SharedUnlock,
      };

      NativeMessagingPermissionDialogComponent.open(service, params);

      expect(service.open).toHaveBeenCalledWith(
        NativeMessagingPermissionDialogComponent,
        expect.objectContaining({ data: params }),
      );
    });

    it("throws and does not open the dialog when not in a popout", () => {
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValue(false);
      const service = mock<DialogService>();

      expect(() =>
        NativeMessagingPermissionDialogComponent.open(service, {
          type: NativeMessagingPermissionDialogType.Biometrics,
        }),
      ).toThrow();
      expect(service.open).not.toHaveBeenCalled();
    });
  });
});
