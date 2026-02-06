import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import {
  DrawerDetails,
  DrawerType,
  MemberDetails,
  ReportStatus,
  RiskInsightsDataService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { RiskInsightsEnrichedData } from "@bitwarden/bit-common/dirt/reports/risk-insights/models/report-data-service.types";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { TableDataSource, ToastService } from "@bitwarden/components";

import { ApplicationTableDataSource } from "../shared/app-table-row-scrollable.component";

import { ApplicationsComponent } from "./applications.component";

// Helper type to access protected members in tests
type ComponentWithProtectedMembers = ApplicationsComponent & {
  dataSource: TableDataSource<ApplicationTableDataSource>;
};

describe("ApplicationsComponent", () => {
  let component: ApplicationsComponent;
  let fixture: ComponentFixture<ApplicationsComponent>;
  let mockI18nService: MockProxy<I18nService>;
  let mockFileDownloadService: MockProxy<FileDownloadService>;
  let mockLogService: MockProxy<LogService>;
  let mockToastService: MockProxy<ToastService>;
  let mockDataService: MockProxy<RiskInsightsDataService>;

  const reportStatus$ = new BehaviorSubject<ReportStatus>(ReportStatus.Complete);
  const enrichedReportData$ = new BehaviorSubject<RiskInsightsEnrichedData | null>(null);
  const criticalReportResults$ = new BehaviorSubject<RiskInsightsEnrichedData | null>(null);
  const drawerDetails$ = new BehaviorSubject<DrawerDetails>({
    open: false,
    invokerId: "",
    activeDrawerType: DrawerType.None,
    atRiskMemberDetails: [],
    appAtRiskMembers: null,
    atRiskAppDetails: null,
  });

  beforeEach(async () => {
    mockI18nService = mock<I18nService>();
    mockFileDownloadService = mock<FileDownloadService>();
    mockLogService = mock<LogService>();
    mockToastService = mock<ToastService>();
    mockDataService = mock<RiskInsightsDataService>();

    mockI18nService.t.mockImplementation((key: string) => key);

    Object.defineProperty(mockDataService, "reportStatus$", { get: () => reportStatus$ });
    Object.defineProperty(mockDataService, "enrichedReportData$", {
      get: () => enrichedReportData$,
    });
    Object.defineProperty(mockDataService, "criticalReportResults$", {
      get: () => criticalReportResults$,
    });
    Object.defineProperty(mockDataService, "drawerDetails$", { get: () => drawerDetails$ });

    await TestBed.configureTestingModule({
      imports: [ApplicationsComponent, ReactiveFormsModule],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: FileDownloadService, useValue: mockFileDownloadService },
        { provide: LogService, useValue: mockLogService },
        { provide: ToastService, useValue: mockToastService },
        { provide: RiskInsightsDataService, useValue: mockDataService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (): string | null => null } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("downloadApplicationsCSV", () => {
    const mockApplicationData: ApplicationTableDataSource[] = [
      {
        applicationName: "GitHub",
        passwordCount: 10,
        atRiskPasswordCount: 3,
        memberCount: 5,
        atRiskMemberCount: 2,
        isMarkedAsCritical: true,
        atRiskCipherIds: ["cipher1" as CipherId],
        memberDetails: [] as MemberDetails[],
        atRiskMemberDetails: [] as MemberDetails[],
        cipherIds: ["cipher1" as CipherId],
        iconCipher: undefined,
      },
      {
        applicationName: "Slack",
        passwordCount: 8,
        atRiskPasswordCount: 1,
        memberCount: 4,
        atRiskMemberCount: 1,
        isMarkedAsCritical: false,
        atRiskCipherIds: ["cipher2" as CipherId],
        memberDetails: [] as MemberDetails[],
        atRiskMemberDetails: [] as MemberDetails[],
        cipherIds: ["cipher2" as CipherId],
        iconCipher: undefined,
      },
    ];

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should download CSV with correct data when filteredData has items", () => {
      // Set up the data source with mock data
      (component as ComponentWithProtectedMembers).dataSource = new TableDataSource();
      (component as ComponentWithProtectedMembers).dataSource.data = mockApplicationData;

      component.downloadApplicationsCSV();

      expect(mockFileDownloadService.download).toHaveBeenCalledTimes(1);
      expect(mockFileDownloadService.download).toHaveBeenCalledWith({
        fileName: expect.stringContaining("applications"),
        blobData: expect.any(String),
        blobOptions: { type: "text/plain" },
      });
    });

    it("should not download when filteredData is empty", () => {
      (component as ComponentWithProtectedMembers).dataSource = new TableDataSource();
      (component as ComponentWithProtectedMembers).dataSource.data = [];

      component.downloadApplicationsCSV();

      expect(mockFileDownloadService.download).not.toHaveBeenCalled();
    });

    it("should use translated column headers in CSV", () => {
      (component as ComponentWithProtectedMembers).dataSource = new TableDataSource();
      (component as ComponentWithProtectedMembers).dataSource.data = mockApplicationData;

      component.downloadApplicationsCSV();

      expect(mockI18nService.t).toHaveBeenCalledWith("application");
      expect(mockI18nService.t).toHaveBeenCalledWith("atRiskPasswords");
      expect(mockI18nService.t).toHaveBeenCalledWith("totalPasswords");
      expect(mockI18nService.t).toHaveBeenCalledWith("atRiskMembers");
      expect(mockI18nService.t).toHaveBeenCalledWith("totalMembers");
      expect(mockI18nService.t).toHaveBeenCalledWith("criticalBadge");
    });

    it("should translate isMarkedAsCritical to 'yes' when true", () => {
      (component as ComponentWithProtectedMembers).dataSource = new TableDataSource();
      (component as ComponentWithProtectedMembers).dataSource.data = [mockApplicationData[0]]; // Critical app

      component.downloadApplicationsCSV();

      expect(mockI18nService.t).toHaveBeenCalledWith("yes");
    });

    it("should translate isMarkedAsCritical to 'no' when false", () => {
      (component as ComponentWithProtectedMembers).dataSource = new TableDataSource();
      (component as ComponentWithProtectedMembers).dataSource.data = [mockApplicationData[1]]; // Non-critical app

      component.downloadApplicationsCSV();

      expect(mockI18nService.t).toHaveBeenCalledWith("no");
    });

    it("should include correct application data in CSV export", () => {
      (component as ComponentWithProtectedMembers).dataSource = new TableDataSource();
      (component as ComponentWithProtectedMembers).dataSource.data = [mockApplicationData[0]];

      let capturedBlobData: string = "";
      mockFileDownloadService.download.mockImplementation((options) => {
        capturedBlobData = options.blobData as string;
      });

      component.downloadApplicationsCSV();

      // Verify the CSV contains the application data
      expect(capturedBlobData).toContain("GitHub");
      expect(capturedBlobData).toContain("10"); // passwordCount
      expect(capturedBlobData).toContain("3"); // atRiskPasswordCount
      expect(capturedBlobData).toContain("5"); // memberCount
      expect(capturedBlobData).toContain("2"); // atRiskMemberCount
    });

    it("should log error when download fails", () => {
      (component as ComponentWithProtectedMembers).dataSource = new TableDataSource();
      (component as ComponentWithProtectedMembers).dataSource.data = mockApplicationData;

      const testError = new Error("Download failed");
      mockFileDownloadService.download.mockImplementation(() => {
        throw testError;
      });

      component.downloadApplicationsCSV();

      expect(mockLogService.error).toHaveBeenCalledWith(
        "Failed to download applications CSV",
        testError,
      );
    });

    it("should only export filtered data when filter is applied", () => {
      (component as ComponentWithProtectedMembers).dataSource = new TableDataSource();
      (component as ComponentWithProtectedMembers).dataSource.data = mockApplicationData;
      // Apply a filter that only matches "GitHub"
      (component as ComponentWithProtectedMembers).dataSource.filter = (
        app: (typeof mockApplicationData)[0],
      ) => app.applicationName === "GitHub";

      let capturedBlobData: string = "";
      mockFileDownloadService.download.mockImplementation((options) => {
        capturedBlobData = options.blobData as string;
      });

      component.downloadApplicationsCSV();

      // Verify only GitHub is in the export (not Slack)
      expect(capturedBlobData).toContain("GitHub");
      expect(capturedBlobData).not.toContain("Slack");
    });
  });
});
