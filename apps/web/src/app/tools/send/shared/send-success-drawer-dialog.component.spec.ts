import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SelfHostedEnvironment } from "@bitwarden/common/platform/services/default-environment.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import {
  DIALOG_DATA,
  DialogModule,
  I18nMockService,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { SendSuccessDrawerDialogComponent } from "./send-success-drawer-dialog.component";

describe("SendSuccessDrawerDialogComponent", () => {
  let fixture: ComponentFixture<SendSuccessDrawerDialogComponent>;
  let component: SendSuccessDrawerDialogComponent;
  let environmentService: MockProxy<EnvironmentService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let toastService: MockProxy<ToastService>;

  let sendView: SendView;

  // Translation Keys
  const newTextSend = "New Text Send";
  const newFileSend = "New File Send";
  const oneHour = "1 hour";
  const oneDay = "1 day";
  const sendCreatedSuccessfully = "Send has been created successfully";
  const sendCreatedDescriptionV2 = "Send ready to share with anyone";
  const sendCreatedDescriptionEmail = "Email-verified Send ready to share";
  const sendCreatedDescriptionPassword = "Password-protected Send ready to share";

  beforeEach(async () => {
    environmentService = mock<EnvironmentService>();
    platformUtilsService = mock<PlatformUtilsService>();
    toastService = mock<ToastService>();

    sendView = {
      id: "test-send-id",
      authType: AuthType.None,
      deletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      type: SendType.Text,
      accessId: "abc",
      urlB64Key: "123",
    } as SendView;

    Object.defineProperty(environmentService, "environment$", {
      configurable: true,
      get: () => of(new SelfHostedEnvironment({ webVault: "https://example.com" })),
    });

    await TestBed.configureTestingModule({
      imports: [SharedModule, DialogModule, TypographyModule],
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: sendView,
        },
        { provide: EnvironmentService, useValue: environmentService },
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              newTextSend,
              newFileSend,
              sendCreatedSuccessfully,
              sendCreatedDescriptionEmail,
              sendCreatedDescriptionPassword,
              sendCreatedDescriptionV2,
              sendLink: "Send link",
              copyLink: "Copy Send Link",
              close: "Close",
              oneHour,
              durationTimeHours: (hours) => `${hours} hours`,
              oneDay,
              days: (days) => `${days} days`,
              loading: "loading",
            });
          },
        },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendSuccessDrawerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should have the correct title for text Sends", () => {
    sendView.type = SendType.Text;
    fixture.detectChanges();
    expect(component.dialogTitle).toBe("newTextSend");
  });

  it("should have the correct title for file Sends", () => {
    fixture.componentInstance.send.type = SendType.File;
    fixture.detectChanges();
    expect(component.dialogTitle).toBe("newFileSend");
  });

  it("should show the correct message for Sends with an expiration time of one hour from now", () => {
    sendView.deletionDate = new Date(Date.now() + 1 * 60 * 60 * 1000);
    fixture.detectChanges();
    expect(component.formattedExpirationTime).toBe(oneHour);
  });

  it("should show the correct message for Sends with an expiration time more than an hour but less than a day from now", () => {
    const numHours = 8;
    sendView.deletionDate = new Date(Date.now() + numHours * 60 * 60 * 1000);
    fixture.detectChanges();
    expect(component.formattedExpirationTime).toBe(`${numHours} hours`);
  });

  it("should have the correct title for Sends with an expiration time of one day from now", () => {
    sendView.deletionDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    fixture.detectChanges();
    expect(component.formattedExpirationTime).toBe(oneDay);
  });

  it("should have the correct title for Sends with an expiration time of multiple days from now", () => {
    const numDays = 3;
    sendView.deletionDate = new Date(Date.now() + numDays * 24 * 60 * 60 * 1000);
    fixture.detectChanges();
    expect(component.formattedExpirationTime).toBe(`${numDays} days`);
  });

  it("should show the correct message for successfully-created Sends with no authentication", () => {
    sendView.authType = AuthType.None;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(sendCreatedSuccessfully);
    expect(fixture.nativeElement.textContent).toContain(sendCreatedDescriptionV2);
  });

  it("should show the correct message for successfully-created Sends with password authentication", () => {
    sendView.authType = AuthType.Password;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(sendCreatedSuccessfully);
    expect(fixture.nativeElement.textContent).toContain(sendCreatedDescriptionPassword);
  });

  it("should show the correct message for successfully-created Sends with email authentication", () => {
    sendView.authType = AuthType.Email;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(sendCreatedSuccessfully);
    expect(fixture.nativeElement.textContent).toContain(sendCreatedDescriptionEmail);
  });
});
