import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";

import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { IntegrationType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogConfig, DialogRef, DialogService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import {
  ConnectDatadogDialogComponent,
  DatadogConnectDialogParams,
  DatadogConnectDialogResult,
  DatadogConnectDialogResultStatus,
  openDatadogConnectDialog,
} from "./connect-dialog-datadog.component";

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

describe("ConnectDialogDatadogComponent", () => {
  let component: ConnectDatadogDialogComponent;
  let fixture: ComponentFixture<ConnectDatadogDialogComponent>;
  let dialogRefMock = mock<DialogRef<DatadogConnectDialogResult>>();
  const mockI18nService = mock<I18nService>();

  const integrationMock: Integration = {
    name: "Test Integration",
    image: "test-image.png",
    linkURL: "https://example.com",
    imageDarkMode: "test-image-dark.png",
    newBadgeExpiration: "2024-12-31",
    description: "Test Description",
    canSetupConnection: true,
    type: IntegrationType.EVENT,
  } as Integration;
  const connectInfo: DatadogConnectDialogParams = {
    settings: integrationMock, // Provide appropriate mock template if needed
  };

  beforeEach(async () => {
    dialogRefMock = mock<DialogRef<DatadogConnectDialogResult>>();

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, SharedModule, BrowserAnimationsModule],
      providers: [
        FormBuilder,
        { provide: DIALOG_DATA, useValue: connectInfo },
        { provide: DialogRef, useValue: dialogRefMock },
        { provide: I18nPipe, useValue: mock<I18nPipe>() },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ConnectDatadogDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    mockI18nService.t.mockImplementation((key) => key);
  });

  it("should create the component", () => {
    expect(component).toBeTruthy();
  });

  it("should initialize form with empty values", () => {
    expect(component.formGroup.value).toEqual({
      url: "",
      apiKey: "",
      service: "Test Integration",
    });
  });

  it("should have required validators for all fields", () => {
    component.formGroup.setValue({ url: "", apiKey: "", service: "" });
    expect(component.formGroup.valid).toBeFalsy();

    component.formGroup.setValue({
      url: "https://test.com",
      apiKey: "token",
      service: "Test Service",
    });
    expect(component.formGroup.valid).toBeTruthy();
  });

  it("should test url is at least 7 characters long", () => {
    component.formGroup.setValue({
      url: "test",
      apiKey: "token",
      service: "Test Service",
    });
    expect(component.formGroup.valid).toBeFalsy();

    component.formGroup.setValue({
      url: "https://test.com",
      apiKey: "token",
      service: "Test Service",
    });
    expect(component.formGroup.valid).toBeTruthy();
  });

  it("should call dialogRef.close with correct result on submit", async () => {
    component.formGroup.setValue({
      url: "https://test.com",
      apiKey: "token",
      service: "Test Service",
    });

    await component.submit();

    expect(dialogRefMock.close).toHaveBeenCalledWith({
      integrationSettings: integrationMock,
      url: "https://test.com",
      apiKey: "token",
      service: "Test Service",
      success: DatadogConnectDialogResultStatus.Edited,
    });
  });
});

describe("openDatadogConnectDialog", () => {
  it("should call dialogService.open with correct params", () => {
    const dialogServiceMock = mock<DialogService>();
    const config: DialogConfig<
      DatadogConnectDialogParams,
      DialogRef<DatadogConnectDialogResult>
    > = {
      data: { settings: { name: "Test" } as Integration },
    } as any;

    openDatadogConnectDialog(dialogServiceMock, config);

    expect(dialogServiceMock.open).toHaveBeenCalledWith(ConnectDatadogDialogComponent, config);
  });
});
