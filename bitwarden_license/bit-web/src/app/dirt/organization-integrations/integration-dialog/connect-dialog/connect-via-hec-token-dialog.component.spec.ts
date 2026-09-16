import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";

import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { IntegrationType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { IntegrationDialogResultStatus } from "../integration-dialog-result-status";

import {
  ConnectViaHecTokenDialogComponent,
  ConnectViaHecTokenDialogParams,
  ConnectViaHecTokenDialogResult,
  openConnectViaHecTokenDialog,
} from "./connect-via-hec-token-dialog.component";

beforeAll(() => {
  // Mock element.animate for jsdom
  // the animate function is not available in jsdom, so we provide a mock implementation
  // This is necessary for tests that rely on animations
  // This mock does not perform any actual animations, it just provides a structure that allows tests
  // to run without throwing errors related to missing animate function
  if (!HTMLElement.prototype.animate) {
    HTMLElement.prototype.animate = function () {
      return {
        play: () => {},
        pause: () => {},
        finish: () => {},
        cancel: () => {},
        reverse: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
        onfinish: null,
        oncancel: null,
        startTime: 0,
        currentTime: 0,
        playbackRate: 1,
        playState: "idle",
        replaceState: "active",
        effect: null,
        finished: Promise.resolve(),
        id: "",
        remove: () => {},
        timeline: null,
        ready: Promise.resolve(),
      } as unknown as Animation;
    };
  }
});

describe("ConnectHuntressDialogComponent", () => {
  let component: ConnectViaHecTokenDialogComponent;
  let fixture: ComponentFixture<ConnectViaHecTokenDialogComponent>;
  let dialogRefMock = mock<DialogRef<ConnectViaHecTokenDialogResult>>();
  const mockI18nService = mock<I18nService>();
  const mockToastService = mock<ToastService>();

  const integrationMock: Integration = {
    name: "Huntress",
    image: "test-image.png",
    linkURL: "https://example.com",
    imageDarkMode: "test-image-dark.png",
    newBadgeExpiration: "2024-12-31",
    description: "Test Description",
    canSetupConnection: true,
    type: IntegrationType.EVENT,
  } as Integration;

  const connectInfo: ConnectViaHecTokenDialogParams = {
    settings: integrationMock,
  };

  beforeEach(async () => {
    dialogRefMock = mock<DialogRef<ConnectViaHecTokenDialogResult>>();

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, SharedModule, BrowserAnimationsModule],
      providers: [
        FormBuilder,
        { provide: DIALOG_DATA, useValue: connectInfo },
        { provide: DialogRef, useValue: dialogRefMock },
        { provide: I18nPipe, useValue: mock<I18nPipe>() },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ConnectViaHecTokenDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    mockI18nService.t.mockImplementation((key) => key);
  });

  it("should create the component", () => {
    expect(component).toBeTruthy();
  });

  it("should initialize form with empty values and service name", () => {
    expect(component.formGroup.value).toEqual({
      url: "",
      token: "",
      service: "Huntress",
    });
  });

  it("should have required validators for url and token fields", () => {
    component.formGroup.setValue({ url: "", token: "", service: "" });
    expect(component.formGroup.valid).toBeFalsy();

    component.formGroup.setValue({
      url: "https://hec.huntress.io/services/collector",
      token: "test-token",
      service: "Huntress",
    });
    expect(component.formGroup.valid).toBeTruthy();
  });

  it("should require url to be at least 7 characters long", () => {
    component.formGroup.setValue({
      url: "test",
      token: "token",
      service: "Huntress",
    });
    expect(component.formGroup.valid).toBeFalsy();

    component.formGroup.setValue({
      url: "https://hec.huntress.io",
      token: "token",
      service: "Huntress",
    });
    expect(component.formGroup.valid).toBeTruthy();
  });

  it("should call dialogRef.close with correct result on submit", async () => {
    component.formGroup.setValue({
      url: "https://hec.huntress.io/services/collector",
      token: "test-token",
      service: "Huntress",
    });

    await component.submit();

    expect(dialogRefMock.close).toHaveBeenCalledWith({
      integrationSettings: integrationMock,
      url: "https://hec.huntress.io/services/collector",
      token: "test-token",
      service: "Huntress",
      success: IntegrationDialogResultStatus.Edited,
    });
  });

  it("should not submit when form is invalid", async () => {
    component.formGroup.setValue({
      url: "",
      token: "",
      service: "Huntress",
    });

    await component.submit();

    expect(dialogRefMock.close).not.toHaveBeenCalled();
    expect(component.formGroup.touched).toBeTruthy();
  });

  it("should return false for isUpdateAvailable when no config exists", () => {
    component.hecConfiguration = null;
    expect(component.isUpdateAvailable).toBeFalsy();
  });

  it("should return true for isUpdateAvailable when config exists", () => {
    component.hecConfiguration = { uri: "test", token: "test" } as any;
    expect(component.isUpdateAvailable).toBeTruthy();
  });

  it("should return false for canDelete when no config exists", () => {
    component.hecConfiguration = null;
    expect(component.canDelete).toBeFalsy();
  });

  it("should return true for canDelete when config exists", () => {
    component.hecConfiguration = { uri: "test", token: "test" } as any;
    expect(component.canDelete).toBeTruthy();
  });

  describe("with saveCallback", () => {
    let toastServiceMock: MockProxy<ToastService>;
    let dialogRefWithCallback: MockProxy<DialogRef<ConnectViaHecTokenDialogResult>>;
    let connectInfoWithCallback: ConnectViaHecTokenDialogParams;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      toastServiceMock = mock<ToastService>();
      dialogRefWithCallback = mock<DialogRef<ConnectViaHecTokenDialogResult>>();

      connectInfoWithCallback = {
        settings: integrationMock,
        saveCallback: jest.fn(),
      };

      await TestBed.configureTestingModule({
        imports: [ReactiveFormsModule, SharedModule, BrowserAnimationsModule],
        providers: [
          FormBuilder,
          { provide: DIALOG_DATA, useValue: connectInfoWithCallback },
          { provide: DialogRef, useValue: dialogRefWithCallback },
          { provide: I18nPipe, useValue: mock<I18nPipe>() },
          { provide: I18nService, useValue: mockI18nService },
          { provide: ToastService, useValue: toastServiceMock },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(ConnectViaHecTokenDialogComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      mockI18nService.t.mockImplementation((key) => key);
    });

    it("should show error toast and keep dialog open when saveCallback returns an error string", async () => {
      (connectInfoWithCallback.saveCallback as jest.Mock).mockResolvedValue(
        "Authentication failed: invalid token.",
      );
      component.formGroup.setValue({
        url: "https://hec.huntress.io/services/collector",
        token: "bad-token",
        service: "Huntress",
      });

      await component.submit();

      expect(toastServiceMock.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "",
        message: "Authentication failed: invalid token.",
      });
      expect(dialogRefWithCallback.close).not.toHaveBeenCalled();
    });

    it("should close dialog with SavedViaCallback when saveCallback returns null", async () => {
      (connectInfoWithCallback.saveCallback as jest.Mock).mockResolvedValue(null);
      component.formGroup.setValue({
        url: "https://hec.huntress.io/services/collector",
        token: "valid-token",
        service: "Huntress",
      });

      await component.submit();

      expect(dialogRefWithCallback.close).toHaveBeenCalledWith(
        expect.objectContaining({ success: IntegrationDialogResultStatus.SavedViaCallback }),
      );
      expect(toastServiceMock.showToast).not.toHaveBeenCalled();
    });

    it("should close dialog without result when saveCallback throws", async () => {
      (connectInfoWithCallback.saveCallback as jest.Mock).mockRejectedValue(new Error("fail"));
      component.formGroup.setValue({
        url: "https://hec.huntress.io/services/collector",
        token: "bad-token",
        service: "Huntress",
      });

      await component.submit();

      expect(dialogRefWithCallback.close).toHaveBeenCalledWith();
      expect(toastServiceMock.showToast).not.toHaveBeenCalled();
    });
  });
});

describe("openHuntressConnectDialog", () => {
  it("should call dialogService.open with correct params", () => {
    const dialogServiceMock = mock<DialogService>();
    const config: DialogConfig<ConnectViaHecTokenDialogParams, ConnectViaHecTokenDialogResult> = {
      data: { settings: { name: "Huntress" } as Integration },
    } as any;

    openConnectViaHecTokenDialog(dialogServiceMock, config);

    expect(dialogServiceMock.open).toHaveBeenCalledWith(ConnectViaHecTokenDialogComponent, config);
  });
});
