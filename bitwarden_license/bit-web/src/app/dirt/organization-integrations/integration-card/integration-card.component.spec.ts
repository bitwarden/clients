import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { OrganizationIntegrationServiceType } from "@bitwarden/bit-common/dirt/organization-integrations/models/organization-integration-service-type";
import { DatadogOrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/datadog-organization-integration-service";
import { HecOrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/hec-organization-integration-service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { HecConnectDialogResultStatus, openHecConnectDialog } from "../integration-dialog";

import { IntegrationCardComponent } from "./integration-card.component";

jest.mock("../integration-dialog", () => ({
  openHecConnectDialog: jest.fn(),
  HecConnectDialogResultStatus: { Edited: "edit", Delete: "delete" },
}));

describe("IntegrationCardComponent", () => {
  let component: IntegrationCardComponent;
  let fixture: ComponentFixture<IntegrationCardComponent>;
  const mockI18nService = mock<I18nService>();
  const activatedRoute = mock<ActivatedRoute>();
  const mockIntegrationService = mock<HecOrganizationIntegrationService>();
  const mockDatadogIntegrationService = mock<DatadogOrganizationIntegrationService>();
  const dialogService = mock<DialogService>();
  const toastService = mock<ToastService>();

  const systemTheme$ = new BehaviorSubject<ThemeType>(ThemeType.Light);
  const usersPreferenceTheme$ = new BehaviorSubject<ThemeType>(ThemeType.Light);

  beforeEach(async () => {
    // reset system theme
    systemTheme$.next(ThemeType.Light);
    activatedRoute.snapshot = {
      paramMap: {
        get: jest.fn().mockReturnValue("test-organization-id"),
      },
    } as any;

    await TestBed.configureTestingModule({
      imports: [IntegrationCardComponent, SharedModule],
      providers: [
        { provide: ThemeStateService, useValue: { selectedTheme$: usersPreferenceTheme$ } },
        { provide: SYSTEM_THEME_OBSERVABLE, useValue: systemTheme$ },
        { provide: I18nPipe, useValue: mock<I18nPipe>() },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ActivatedRoute, useValue: activatedRoute },
        { provide: HecOrganizationIntegrationService, useValue: mockIntegrationService },
        { provide: DatadogOrganizationIntegrationService, useValue: mockDatadogIntegrationService },
        { provide: ToastService, useValue: toastService },
        { provide: DialogService, useValue: dialogService },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(IntegrationCardComponent);
    component = fixture.componentInstance;

    component.name = "Integration Name";
    component.image = "test-image.png";
    component.linkURL = "https://example.com/";

    mockI18nService.t.mockImplementation((key) => key);
    fixture.detectChanges();
  });

  it("assigns link href", () => {
    const link = fixture.nativeElement.querySelector("a");

    expect(link.href).toBe("https://example.com/");
  });

  it("renders card body", () => {
    const name = fixture.nativeElement.querySelector("h3");

    expect(name.textContent).toContain("Integration Name");
  });

  it("assigns external rel attribute", () => {
    component.externalURL = true;
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector("a");

    expect(link.rel).toBe("noopener noreferrer");
  });

  describe("new badge", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2023-09-01"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("shows when expiration is in the future", () => {
      component.newBadgeExpiration = "2023-09-02";
      expect(component.showNewBadge()).toBe(true);
    });

    it("does not show when expiration is not set", () => {
      expect(component.showNewBadge()).toBe(false);
    });

    it("does not show when expiration is in the past", () => {
      component.newBadgeExpiration = "2023-08-31";
      expect(component.showNewBadge()).toBe(false);
    });

    it("does not show when expiration is today", () => {
      component.newBadgeExpiration = "2023-09-01";
      expect(component.showNewBadge()).toBe(false);
    });

    it("does not show when expiration is invalid", () => {
      component.newBadgeExpiration = "not-a-date";
      expect(component.showNewBadge()).toBe(false);
    });
  });

  describe("imageDarkMode", () => {
    it("ignores theme changes when darkModeImage is not set", () => {
      systemTheme$.next(ThemeType.Dark);
      usersPreferenceTheme$.next(ThemeType.Dark);

      fixture.detectChanges();

      expect(component.imageEle.nativeElement.src).toContain("test-image.png");
    });

    describe("user prefers the system theme", () => {
      beforeEach(() => {
        component.imageDarkMode = "test-image-dark.png";
      });

      it("sets image src to imageDarkMode", () => {
        usersPreferenceTheme$.next(ThemeType.System);
        systemTheme$.next(ThemeType.Dark);

        fixture.detectChanges();

        expect(component.imageEle.nativeElement.src).toContain("test-image-dark.png");
      });

      it("sets image src to light mode image", () => {
        component.imageEle.nativeElement.src = "test-image-dark.png";

        usersPreferenceTheme$.next(ThemeType.System);
        systemTheme$.next(ThemeType.Light);

        fixture.detectChanges();

        expect(component.imageEle.nativeElement.src).toContain("test-image.png");
      });
    });

    describe("user prefers dark mode", () => {
      beforeEach(() => {
        component.imageDarkMode = "test-image-dark.png";
      });

      it("updates image to dark mode", () => {
        systemTheme$.next(ThemeType.Light); // system theme shouldn't matter
        usersPreferenceTheme$.next(ThemeType.Dark);

        fixture.detectChanges();

        expect(component.imageEle.nativeElement.src).toContain("test-image-dark.png");
      });
    });

    describe("user prefers light mode", () => {
      beforeEach(() => {
        component.imageDarkMode = "test-image-dark.png";
      });

      it("updates image to light mode", () => {
        component.imageEle.nativeElement.src = "test-image-dark.png";

        systemTheme$.next(ThemeType.Dark); // system theme shouldn't matter
        usersPreferenceTheme$.next(ThemeType.Light);

        fixture.detectChanges();

        expect(component.imageEle.nativeElement.src).toContain("test-image.png");
      });
    });
  });

  describe("showNewBadge", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2024-06-01"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("returns false when newBadgeExpiration is undefined", () => {
      component.newBadgeExpiration = undefined;
      expect(component.showNewBadge()).toBe(false);
    });

    it("returns false when newBadgeExpiration is an invalid date", () => {
      component.newBadgeExpiration = "invalid-date";
      expect(component.showNewBadge()).toBe(false);
    });

    it("returns true when newBadgeExpiration is in the future", () => {
      component.newBadgeExpiration = "2024-06-02";
      expect(component.showNewBadge()).toBe(true);
    });

    it("returns false when newBadgeExpiration is today", () => {
      component.newBadgeExpiration = "2024-06-01";
      expect(component.showNewBadge()).toBe(false);
    });

    it("returns false when newBadgeExpiration is in the past", () => {
      component.newBadgeExpiration = "2024-05-31";
      expect(component.showNewBadge()).toBe(false);
    });
  });
  describe("showConnectedBadge", () => {
    it("returns true when canSetupConnection is true", () => {
      component.canSetupConnection = true;
      expect(component.showConnectedBadge()).toBe(true);
    });

    it("returns false when canSetupConnection is false", () => {
      component.canSetupConnection = false;
      expect(component.showConnectedBadge()).toBe(false);
    });

    it("returns false when canSetupConnection is undefined", () => {
      component.canSetupConnection = undefined;
      expect(component.showConnectedBadge()).toBe(false);
    });
  });

  describe("setupConnection", () => {
    beforeEach(() => {
      component.integrationSettings = {
        organizationIntegration: {
          id: "integration-id",
          configuration: {},
          integrationConfiguration: [{ id: "config-id" }],
        },
        name: OrganizationIntegrationServiceType.CrowdStrike,
      } as any;
      component.organizationId = "org-id" as any;
      jest.resetAllMocks();
    });

    it("should not proceed if dialog is cancelled", async () => {
      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({ success: false }),
      });
      await component.setupConnection();
      expect(mockIntegrationService.updateHec).not.toHaveBeenCalled();
      expect(mockIntegrationService.saveHec).not.toHaveBeenCalled();
    });

    it("should call updateHec if isUpdateAvailable is true", async () => {
      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: HecConnectDialogResultStatus.Edited,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      jest.spyOn(component, "isUpdateAvailable", "get").mockReturnValue(true);

      await component.setupConnection();

      expect(mockIntegrationService.updateHec).toHaveBeenCalledWith(
        "org-id",
        "integration-id",
        "config-id",
        OrganizationIntegrationServiceType.CrowdStrike,
        "test-url",
        "token",
        "index",
      );
      expect(mockIntegrationService.saveHec).not.toHaveBeenCalled();
    });

    it("should call saveHec if isUpdateAvailable is false", async () => {
      component.integrationSettings = {
        organizationIntegration: null,
        name: OrganizationIntegrationServiceType.CrowdStrike,
      } as any;
      component.organizationId = "org-id" as any;

      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: HecConnectDialogResultStatus.Edited,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      jest.spyOn(component, "isUpdateAvailable", "get").mockReturnValue(false);

      mockIntegrationService.saveHec.mockResolvedValue({ mustBeOwner: false, success: true });

      await component.setupConnection();

      expect(mockIntegrationService.saveHec).toHaveBeenCalledWith(
        "org-id",
        OrganizationIntegrationServiceType.CrowdStrike,
        "test-url",
        "token",
        "index",
      );
      expect(mockIntegrationService.updateHec).not.toHaveBeenCalled();
    });

    it("should call deleteHec when a delete is requested", async () => {
      component.organizationId = "org-id" as any;

      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: HecConnectDialogResultStatus.Delete,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      mockIntegrationService.deleteHec.mockResolvedValue({ mustBeOwner: false, success: true });

      await component.setupConnection();

      expect(mockIntegrationService.deleteHec).toHaveBeenCalledWith(
        "org-id",
        "integration-id",
        "config-id",
      );
      expect(mockIntegrationService.saveHec).not.toHaveBeenCalled();
    });

    it("should not call deleteHec if no existing configuration", async () => {
      component.integrationSettings = {
        organizationIntegration: null,
        name: OrganizationIntegrationServiceType.CrowdStrike,
      } as any;
      component.organizationId = "org-id" as any;

      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: HecConnectDialogResultStatus.Delete,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      mockIntegrationService.deleteHec.mockResolvedValue({ mustBeOwner: false, success: true });

      await component.setupConnection();

      expect(mockIntegrationService.deleteHec).not.toHaveBeenCalledWith(
        "org-id",
        "integration-id",
        "config-id",
        OrganizationIntegrationServiceType.CrowdStrike,
        "test-url",
        "token",
        "index",
      );
      expect(mockIntegrationService.updateHec).not.toHaveBeenCalled();
    });

    it("should show toast on error while saving", async () => {
      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: HecConnectDialogResultStatus.Edited,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      jest.spyOn(component, "isUpdateAvailable", "get").mockReturnValue(true);
      mockIntegrationService.updateHec.mockRejectedValue(new Error("fail"));

      await component.setupConnection();

      expect(mockIntegrationService.updateHec).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "",
        message: mockI18nService.t("failedToSaveIntegration"),
      });
    });

    it("should show mustBeOwner toast on error while inserting data", async () => {
      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: HecConnectDialogResultStatus.Edited,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      jest.spyOn(component, "isUpdateAvailable", "get").mockReturnValue(true);
      mockIntegrationService.updateHec.mockRejectedValue(new ErrorResponse("Not Found", 404));

      await component.setupConnection();

      expect(mockIntegrationService.updateHec).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "",
        message: mockI18nService.t("mustBeOrgOwnerToPerformAction"),
      });
    });

    it("should show mustBeOwner toast on error while updating data", async () => {
      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: HecConnectDialogResultStatus.Edited,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      jest.spyOn(component, "isUpdateAvailable", "get").mockReturnValue(true);
      mockIntegrationService.updateHec.mockRejectedValue(new ErrorResponse("Not Found", 404));

      await component.setupConnection();

      expect(mockIntegrationService.updateHec).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "",
        message: mockI18nService.t("mustBeOrgOwnerToPerformAction"),
      });
    });

    it("should show toast on error while deleting", async () => {
      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: HecConnectDialogResultStatus.Delete,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      jest.spyOn(component, "isUpdateAvailable", "get").mockReturnValue(true);
      mockIntegrationService.deleteHec.mockRejectedValue(new Error("fail"));

      await component.setupConnection();

      expect(mockIntegrationService.deleteHec).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "",
        message: mockI18nService.t("failedToDeleteIntegration"),
      });
    });

    it("should show mustbeOwner toast on 404 while deleting", async () => {
      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: HecConnectDialogResultStatus.Delete,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      jest.spyOn(component, "isUpdateAvailable", "get").mockReturnValue(true);
      mockIntegrationService.deleteHec.mockRejectedValue(new ErrorResponse("Not Found", 404));

      await component.setupConnection();

      expect(mockIntegrationService.deleteHec).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "",
        message: mockI18nService.t("mustBeOrgOwnerToPerformAction"),
      });
    });
  });
});
