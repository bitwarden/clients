import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { Subject } from "rxjs";

import { LoginApprovalComponent } from "@bitwarden/auth/angular";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DesktopLoginApprovalComponentService } from "./desktop-login-approval-component.service";

describe("DesktopLoginApprovalComponentService", () => {
  let service: DesktopLoginApprovalComponentService;
  let i18nService: MockProxy<I18nServiceAbstraction>;
  let originalIpc: any;

  beforeEach(() => {
    originalIpc = (global as any).ipc;
    (global as any).ipc = {
      auth: {
        loginRequest: jest.fn(),
      },
      platform: {
        isWindowVisible: jest.fn(),
      },
    };

    i18nService = mock<I18nServiceAbstraction>({
      t: jest.fn(),
      userSetLocale$: new Subject<string>(),
      locale$: new Subject<string>(),
    });

    TestBed.configureTestingModule({
      providers: [
        DesktopLoginApprovalComponentService,
        { provide: I18nServiceAbstraction, useValue: i18nService },
      ],
    });

    service = TestBed.inject(DesktopLoginApprovalComponentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    (global as any).ipc = originalIpc;
  });

  it("is created successfully", () => {
    expect(service).toBeTruthy();
  });

  it("calls ipc.auth.loginRequest with correct parameters when window is not visible", async () => {
    const title = "Log in requested";
    const email = "test@bitwarden.com";
    const message = `Confirm access attempt for ${email}`;
    const closeText = "Close";

    const loginApprovalComponent = { email } as LoginApprovalComponent;
    i18nService.t.mockImplementation((key: string) => {
      switch (key) {
        case "accountAccessRequested":
          return title;
        case "confirmAccessAttempt":
          return message;
        case "close":
          return closeText;
        default:
          return "";
      }
    });

    jest.spyOn(ipc.platform, "isWindowVisible").mockResolvedValue(false);
    jest.spyOn(ipc.auth, "loginRequest").mockResolvedValue();

    await service.showLoginRequestedAlertIfWindowNotVisible(loginApprovalComponent.email);

    expect(ipc.auth.loginRequest).toHaveBeenCalledWith(title, message, closeText);
  });

  it("does not call ipc.auth.loginRequest when window is visible", async () => {
    const loginApprovalComponent = { email: "test@bitwarden.com" } as LoginApprovalComponent;

    jest.spyOn(ipc.platform, "isWindowVisible").mockResolvedValue(true);
    jest.spyOn(ipc.auth, "loginRequest");

    await service.showLoginRequestedAlertIfWindowNotVisible(loginApprovalComponent.email);

    expect(ipc.auth.loginRequest).not.toHaveBeenCalled();
  });
});
