import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";

import { DrawerDetails, DrawerType } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { I18nPipe } from "@bitwarden/ui-common";

import { RiskInsightsDrawerDialogComponent } from "./risk-insights-drawer-dialog.component";

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

describe("RiskInsightsDrawerDialogComponent", () => {
  let component: RiskInsightsDrawerDialogComponent;
  let fixture: ComponentFixture<RiskInsightsDrawerDialogComponent>;
  const mockI18nService = mock<I18nService>();
  const mockFileDownloadService = mock<FileDownloadService>();
  const mocklogService = mock<LogService>();
  const drawerDetails: DrawerDetails = {
    open: true,
    invokerId: "test-invoker",
    activeDrawerType: DrawerType.None,
    atRiskMemberDetails: [],
    appAtRiskMembers: null,
    atRiskAppDetails: null,
  };
  mockI18nService.t.mockImplementation((key: string) => key);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiskInsightsDrawerDialogComponent, BrowserAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: drawerDetails },
        { provide: I18nPipe, useValue: mock<I18nPipe>() },
        { provide: I18nService, useValue: mockI18nService },
        { provide: FileDownloadService, useValue: mockFileDownloadService },
        { provide: LogService, useValue: mocklogService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RiskInsightsDrawerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("drawerTypes getter", () => {
    it("should return DrawerType enum", () => {
      expect(component.drawerTypes).toBe(DrawerType);
    });
  });

  describe("isActiveDrawerType", () => {
    it("should return true if type matches activeDrawerType", () => {
      component.drawerDetails.activeDrawerType = DrawerType.None;
      expect(component.isActiveDrawerType(DrawerType.None)).toBeTruthy();
    });

    it("should return false if type does not match activeDrawerType", () => {
      component.drawerDetails.activeDrawerType = DrawerType.None;
      expect(component.isActiveDrawerType(DrawerType.AppAtRiskMembers)).toBeFalsy();
    });
  });
  describe("downloadAtRiskMembers", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should download CSV when drawer is open with correct type and has data", async () => {
      component.drawerDetails = {
        open: true,
        invokerId: "test-invoker",
        activeDrawerType: DrawerType.OrgAtRiskMembers,
        atRiskMemberDetails: [
          { email: "user@example.com", atRiskPasswordCount: 5 },
          { email: "admin@example.com", atRiskPasswordCount: 3 },
        ],
        appAtRiskMembers: null,
        atRiskAppDetails: null,
      };

      mockI18nService.t.mockImplementation((key: string) => key);

      await component.downloadAtRiskMembers();

      expect(mockFileDownloadService.download).toHaveBeenCalledWith({
        fileName: expect.stringContaining("at-risk-members"),
        blobData: expect.any(String),
        blobOptions: { type: "text/plain" },
      });
    });

    it("should not download when drawer is closed", async () => {
      component.drawerDetails = {
        open: false,
        invokerId: "test-invoker",
        activeDrawerType: DrawerType.OrgAtRiskMembers,
        atRiskMemberDetails: [{ email: "user@example.com", atRiskPasswordCount: 5 }],
        appAtRiskMembers: null,
        atRiskAppDetails: null,
      };

      await component.downloadAtRiskMembers();

      expect(mockFileDownloadService.download).not.toHaveBeenCalled();
    });

    it("should not download when activeDrawerType is incorrect", async () => {
      component.drawerDetails = {
        open: true,
        invokerId: "test-invoker",
        activeDrawerType: DrawerType.OrgAtRiskApps,
        atRiskMemberDetails: [{ email: "user@example.com", atRiskPasswordCount: 5 }],
        appAtRiskMembers: null,
        atRiskAppDetails: null,
      };

      await component.downloadAtRiskMembers();

      expect(mockFileDownloadService.download).not.toHaveBeenCalled();
    });

    it("should not download when atRiskMemberDetails is null", async () => {
      component.drawerDetails = {
        open: true,
        invokerId: "test-invoker",
        activeDrawerType: DrawerType.OrgAtRiskMembers,
        atRiskMemberDetails: [],
        appAtRiskMembers: null,
        atRiskAppDetails: null,
      };

      await component.downloadAtRiskMembers();

      expect(mockFileDownloadService.download).not.toHaveBeenCalled();
    });

    it("should not download when atRiskMemberDetails is empty array", async () => {
      component.drawerDetails = {
        open: true,
        invokerId: "test-invoker",
        activeDrawerType: DrawerType.OrgAtRiskMembers,
        atRiskMemberDetails: [],
        appAtRiskMembers: null,
        atRiskAppDetails: null,
      };

      await component.downloadAtRiskMembers();

      expect(mockFileDownloadService.download).not.toHaveBeenCalled();
    });
  });

  describe("downloadAtRiskApplications", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should download CSV when drawer is open with correct type and has data", async () => {
      component.drawerDetails = {
        open: true,
        invokerId: "test-invoker",
        activeDrawerType: DrawerType.OrgAtRiskApps,
        atRiskMemberDetails: [],
        appAtRiskMembers: null,
        atRiskAppDetails: [
          { applicationName: "App1", atRiskPasswordCount: 10 },
          { applicationName: "App2", atRiskPasswordCount: 7 },
        ],
      };

      await component.downloadAtRiskApplications();

      expect(mockFileDownloadService.download).toHaveBeenCalledWith({
        fileName: expect.stringContaining("at-risk-applications"),
        blobData: expect.any(String),
        blobOptions: { type: "text/plain" },
      });
    });

    it("should not download when drawer is closed", async () => {
      component.drawerDetails = {
        open: false,
        invokerId: "test-invoker",
        activeDrawerType: DrawerType.OrgAtRiskApps,
        atRiskMemberDetails: [],
        appAtRiskMembers: null,
        atRiskAppDetails: [{ applicationName: "App1", atRiskPasswordCount: 10 }],
      };

      await component.downloadAtRiskApplications();

      expect(mockFileDownloadService.download).not.toHaveBeenCalled();
    });

    it("should not download when activeDrawerType is incorrect", async () => {
      component.drawerDetails = {
        open: true,
        invokerId: "test-invoker",
        activeDrawerType: DrawerType.OrgAtRiskMembers,
        atRiskMemberDetails: [],
        appAtRiskMembers: null,
        atRiskAppDetails: [{ applicationName: "App1", atRiskPasswordCount: 10 }],
      };

      await component.downloadAtRiskApplications();

      expect(mockFileDownloadService.download).not.toHaveBeenCalled();
    });

    it("should not download when atRiskAppDetails is null", async () => {
      component.drawerDetails = {
        open: true,
        invokerId: "test-invoker",
        activeDrawerType: DrawerType.OrgAtRiskApps,
        atRiskMemberDetails: [],
        appAtRiskMembers: null,
        atRiskAppDetails: null,
      };

      await component.downloadAtRiskApplications();

      expect(mockFileDownloadService.download).not.toHaveBeenCalled();
    });

    it("should not download when atRiskAppDetails is empty array", async () => {
      component.drawerDetails = {
        open: true,
        invokerId: "test-invoker",
        activeDrawerType: DrawerType.OrgAtRiskApps,
        atRiskMemberDetails: [],
        appAtRiskMembers: null,
        atRiskAppDetails: [],
      };

      await component.downloadAtRiskApplications();

      expect(mockFileDownloadService.download).not.toHaveBeenCalled();
    });
  });
});
