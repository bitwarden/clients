import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { OrgIntegrationBuilder } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration-builder";
import { OrganizationIntegrationServiceName } from "@bitwarden/bit-common/dirt/organization-integrations/models/organization-integration-service-type";
import { OrganizationIntegrationType } from "@bitwarden/bit-common/dirt/organization-integrations/models/organization-integration-type";
import { OrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-service";
import { IntegrationStateService } from "@bitwarden/bit-common/dirt/organization-integrations/shared/integration-state.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { IntegrationDialogResultStatus, openHecConnectDialog } from "../integration-dialog";

import { IntegrationCardComponent } from "./integration-card.component";

jest.mock("../integration-dialog", () => ({
  openHecConnectDialog: jest.fn(),
  openDatadogConnectDialog: jest.fn(),
  openHuntressConnectDialog: jest.fn(),
  IntegrationDialogResultStatus: { Edited: "edit", Delete: "delete" },
}));

describe("IntegrationCardComponent", () => {
  let component: IntegrationCardComponent;
  let fixture: ComponentFixture<IntegrationCardComponent>;
  const mockI18nService = mock<I18nService>();
  const activatedRoute = mock<ActivatedRoute>();
  const mockIntegrationService = mock<OrganizationIntegrationService>();
  const dialogService = mock<DialogService>();
  const toastService = mock<ToastService>();
  const stateService = mock<IntegrationStateService>();

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
        { provide: OrganizationIntegrationService, useValue: mockIntegrationService },
        { provide: ToastService, useValue: toastService },
        { provide: DialogService, useValue: dialogService },
        { provide: IntegrationStateService, useValue: stateService },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(IntegrationCardComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput("name", "Integration Name");
    fixture.componentRef.setInput("image", "test-image.png");
    fixture.componentRef.setInput("linkURL", "https://example.com/");

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
    fixture.componentRef.setInput("externalURL", true);
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
      fixture.componentRef.setInput("newBadgeExpiration", "2023-09-02");
      expect(component.showNewBadge()).toBe(true);
    });

    it("does not show when expiration is not set", () => {
      fixture.componentRef.setInput("newBadgeExpiration", undefined);
      expect(component.showNewBadge()).toBe(false);
    });

    it("does not show when expiration is in the past", () => {
      fixture.componentRef.setInput("newBadgeExpiration", "2023-08-31");
      expect(component.showNewBadge()).toBe(false);
    });

    it("does not show when expiration is today", () => {
      fixture.componentRef.setInput("newBadgeExpiration", "2023-09-01");
      expect(component.showNewBadge()).toBe(false);
    });

    it("does not show when expiration is invalid", () => {
      fixture.componentRef.setInput("newBadgeExpiration", "not-a-date");
      expect(component.showNewBadge()).toBe(false);
    });
  });

  describe("imageDarkMode", () => {
    it("ignores theme changes when darkModeImage is not set", () => {
      systemTheme$.next(ThemeType.Dark);
      usersPreferenceTheme$.next(ThemeType.Dark);

      fixture.detectChanges();

      expect(component.imageEle().nativeElement.src).toContain("test-image.png");
    });

    describe("user prefers the system theme", () => {
      beforeEach(() => {
        fixture.componentRef.setInput("imageDarkMode", "test-image-dark.png");
      });

      it("sets image src to imageDarkMode", () => {
        usersPreferenceTheme$.next(ThemeType.System);
        systemTheme$.next(ThemeType.Dark);

        fixture.detectChanges();

        expect(component.imageEle().nativeElement.src).toContain("test-image-dark.png");
      });

      it("sets image src to light mode image", () => {
        component.imageEle().nativeElement.src = "test-image-dark.png";

        usersPreferenceTheme$.next(ThemeType.System);
        systemTheme$.next(ThemeType.Light);

        fixture.detectChanges();

        expect(component.imageEle().nativeElement.src).toContain("test-image.png");
      });
    });

    describe("user prefers dark mode", () => {
      beforeEach(() => {
        fixture.componentRef.setInput("imageDarkMode", "test-image-dark.png");
      });

      it("updates image to dark mode", () => {
        systemTheme$.next(ThemeType.Light); // system theme shouldn't matter
        usersPreferenceTheme$.next(ThemeType.Dark);

        fixture.detectChanges();

        expect(component.imageEle().nativeElement.src).toContain("test-image-dark.png");
      });
    });

    describe("user prefers light mode", () => {
      beforeEach(() => {
        fixture.componentRef.setInput("imageDarkMode", "test-image-dark.png");
      });

      it("updates image to light mode", () => {
        component.imageEle().nativeElement.src = "test-image-dark.png";

        systemTheme$.next(ThemeType.Dark); // system theme shouldn't matter
        usersPreferenceTheme$.next(ThemeType.Light);

        fixture.detectChanges();

        expect(component.imageEle().nativeElement.src).toContain("test-image.png");
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
      fixture.componentRef.setInput("newBadgeExpiration", undefined);
      expect(component.showNewBadge()).toBe(false);
    });

    it("returns false when newBadgeExpiration is an invalid date", () => {
      fixture.componentRef.setInput("newBadgeExpiration", "invalid-date");
      expect(component.showNewBadge()).toBe(false);
    });

    it("returns true when newBadgeExpiration is in the future", () => {
      fixture.componentRef.setInput("newBadgeExpiration", "2024-06-02");
      expect(component.showNewBadge()).toBe(true);
    });

    it("returns false when newBadgeExpiration is today", () => {
      fixture.componentRef.setInput("newBadgeExpiration", "2024-06-01");
      expect(component.showNewBadge()).toBe(false);
    });

    it("returns false when newBadgeExpiration is in the past", () => {
      fixture.componentRef.setInput("newBadgeExpiration", "2024-05-31");
      expect(component.showNewBadge()).toBe(false);
    });
  });
  describe("showConnectedBadge", () => {
    it("returns true when canSetupConnection is true", () => {
      fixture.componentRef.setInput("canSetupConnection", true);
      expect(component.showConnectedBadge()).toBe(true);
    });

    it("returns false when canSetupConnection is false", () => {
      fixture.componentRef.setInput("canSetupConnection", false);
      expect(component.showConnectedBadge()).toBe(false);
    });
  });

  describe("setupConnection", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("integrationSettings", {
        organizationIntegration: {
          id: "integration-id",
          configuration: {},
          integrationConfiguration: [{ id: "config-id" }],
        },
        name: OrganizationIntegrationServiceName.CrowdStrike,
      } as any);
      component.organizationId = "org-id" as any;
      jest.resetAllMocks();
    });

    it("should not proceed if dialog is cancelled", async () => {
      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({ success: false }),
      });
      await component.setupConnection();
      expect(mockIntegrationService.update).not.toHaveBeenCalled();
      expect(mockIntegrationService.save).not.toHaveBeenCalled();
    });

    it("should call updateHec if isUpdateAvailable is true", async () => {
      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: IntegrationDialogResultStatus.Edited,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      const config = OrgIntegrationBuilder.buildHecConfiguration(
        "test-url",
        "token",
        OrganizationIntegrationServiceName.CrowdStrike,
      );
      const template = OrgIntegrationBuilder.buildHecTemplate(
        "index",
        OrganizationIntegrationServiceName.CrowdStrike,
      );

      jest.spyOn(component, "isUpdateAvailable", "get").mockReturnValue(true);

      await component.setupConnection();

      expect(mockIntegrationService.update).toHaveBeenCalledWith(
        "org-id",
        "integration-id",
        OrganizationIntegrationType.Hec,
        "config-id",
        config,
        template,
      );
      expect(mockIntegrationService.save).not.toHaveBeenCalled();
    });

    it("should call saveHec if isUpdateAvailable is false", async () => {
      fixture.componentRef.setInput("integrationSettings", {
        organizationIntegration: null,
        name: OrganizationIntegrationServiceName.CrowdStrike,
      } as any);
      component.organizationId = "org-id" as any;

      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: IntegrationDialogResultStatus.Edited,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      const config = OrgIntegrationBuilder.buildHecConfiguration(
        "test-url",
        "token",
        OrganizationIntegrationServiceName.CrowdStrike,
      );
      const template = OrgIntegrationBuilder.buildHecTemplate(
        "index",
        OrganizationIntegrationServiceName.CrowdStrike,
      );

      jest.spyOn(component, "isUpdateAvailable", "get").mockReturnValue(false);

      mockIntegrationService.save.mockResolvedValue({ mustBeOwner: false, success: true });

      await component.setupConnection();

      expect(mockIntegrationService.save).toHaveBeenCalledWith(
        "org-id",
        OrganizationIntegrationType.Hec,
        config,
        template,
      );
      expect(mockIntegrationService.update).not.toHaveBeenCalled();
    });

    it("should call delete with Hec type when a delete is requested", async () => {
      component.organizationId = "org-id" as any;

      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: IntegrationDialogResultStatus.Delete,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      mockIntegrationService.delete.mockResolvedValue({ mustBeOwner: false, success: true });

      await component.setupConnection();

      expect(mockIntegrationService.delete).toHaveBeenCalledWith(
        "org-id",
        "integration-id",
        "config-id",
      );
      expect(mockIntegrationService.save).not.toHaveBeenCalled();
    });

    it("should not call delete if no existing configuration", async () => {
      fixture.componentRef.setInput("integrationSettings", {
        organizationIntegration: null,
        name: OrganizationIntegrationServiceName.CrowdStrike,
      } as any);
      component.organizationId = "org-id" as any;

      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: IntegrationDialogResultStatus.Delete,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      mockIntegrationService.delete.mockResolvedValue({ mustBeOwner: false, success: true });

      await component.setupConnection();

      expect(mockIntegrationService.delete).not.toHaveBeenCalledWith(
        "org-id",
        "integration-id",
        "config-id",
      );
      expect(mockIntegrationService.update).not.toHaveBeenCalled();
    });

    it("should show toast on error while saving", async () => {
      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: IntegrationDialogResultStatus.Edited,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      jest.spyOn(component, "isUpdateAvailable", "get").mockReturnValue(true);
      mockIntegrationService.update.mockRejectedValue(new Error("fail"));

      await component.setupConnection();

      expect(mockIntegrationService.update).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "",
        message: mockI18nService.t("failedToSaveIntegration"),
      });
    });

    it("should show mustBeOwner toast on error while inserting data", async () => {
      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: IntegrationDialogResultStatus.Edited,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      jest.spyOn(component, "isUpdateAvailable", "get").mockReturnValue(true);
      mockIntegrationService.update.mockRejectedValue(new ErrorResponse("Not Found", 404));

      await component.setupConnection();

      expect(mockIntegrationService.update).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "",
        message: mockI18nService.t("mustBeOrgOwnerToPerformAction"),
      });
    });

    it("should show mustBeOwner toast on error while updating data", async () => {
      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: IntegrationDialogResultStatus.Edited,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      jest.spyOn(component, "isUpdateAvailable", "get").mockReturnValue(true);
      mockIntegrationService.update.mockRejectedValue(new ErrorResponse("Not Found", 404));
      await component.setupConnection();

      expect(mockIntegrationService.update).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "",
        message: mockI18nService.t("mustBeOrgOwnerToPerformAction"),
      });
    });

    it("should show toast on error while deleting", async () => {
      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: IntegrationDialogResultStatus.Delete,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      jest.spyOn(component, "isUpdateAvailable", "get").mockReturnValue(true);
      mockIntegrationService.delete.mockRejectedValue(new Error("fail"));

      await component.setupConnection();

      expect(mockIntegrationService.delete).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "",
        message: mockI18nService.t("failedToDeleteIntegration"),
      });
    });

    it("should show mustbeOwner toast on 404 while deleting", async () => {
      (openHecConnectDialog as jest.Mock).mockReturnValue({
        closed: of({
          success: IntegrationDialogResultStatus.Delete,
          url: "test-url",
          bearerToken: "token",
          index: "index",
        }),
      });

      jest.spyOn(component, "isUpdateAvailable", "get").mockReturnValue(true);
      mockIntegrationService.delete.mockRejectedValue(new ErrorResponse("Not Found", 404));
      await component.setupConnection();

      expect(mockIntegrationService.delete).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "",
        message: mockI18nService.t("mustBeOrgOwnerToPerformAction"),
      });
    });
  });
});
