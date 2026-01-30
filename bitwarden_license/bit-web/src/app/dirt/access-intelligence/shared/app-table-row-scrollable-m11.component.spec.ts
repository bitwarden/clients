import { DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { ApplicationHealthReportDetailEnriched } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { TableDataSource } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AppTableRowScrollableM11Component } from "./app-table-row-scrollable-m11.component";

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockTableData: ApplicationHealthReportDetailEnriched[] = [
  {
    applicationName: "google.com",
    passwordCount: 5,
    atRiskPasswordCount: 2,
    atRiskCipherIds: ["cipher-1" as any, "cipher-2" as any],
    memberCount: 3,
    atRiskMemberCount: 1,
    memberDetails: [
      {
        userGuid: "user-1",
        userName: "John Doe",
        email: "john@google.com",
        cipherId: "cipher-1",
      },
    ],
    atRiskMemberDetails: [
      {
        userGuid: "user-2",
        userName: "Jane Smith",
        email: "jane@google.com",
        cipherId: "cipher-2",
      },
    ],
    cipherIds: ["cipher-1" as any, "cipher-2" as any],
    isMarkedAsCritical: true,
  },
  {
    applicationName: "facebook.com",
    passwordCount: 3,
    atRiskPasswordCount: 1,
    atRiskCipherIds: ["cipher-3" as any],
    memberCount: 2,
    atRiskMemberCount: 1,
    memberDetails: [
      {
        userGuid: "user-3",
        userName: "Alice Johnson",
        email: "alice@facebook.com",
        cipherId: "cipher-3",
      },
    ],
    atRiskMemberDetails: [
      {
        userGuid: "user-4",
        userName: "Bob Wilson",
        email: "bob@facebook.com",
        cipherId: "cipher-4",
      },
    ],
    cipherIds: ["cipher-3" as any, "cipher-4" as any],
    isMarkedAsCritical: false,
  },
  {
    applicationName: "twitter.com",
    passwordCount: 4,
    atRiskPasswordCount: 0,
    atRiskCipherIds: [],
    memberCount: 4,
    atRiskMemberCount: 0,
    memberDetails: [],
    atRiskMemberDetails: [],
    cipherIds: ["cipher-5" as any, "cipher-6" as any],
    isMarkedAsCritical: false,
  },
];

describe("AppTableRowScrollableM11Component", () => {
  let fixture: ComponentFixture<AppTableRowScrollableM11Component>;

  beforeEach(async () => {
    const mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [AppTableRowScrollableM11Component],
      providers: [
        { provide: I18nPipe, useValue: mock<I18nPipe>() },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppTableRowScrollableM11Component);

    await fixture.whenStable();
  });

  describe("select all checkbox", () => {
    let selectAllCheckboxEl: DebugElement;

    beforeEach(async () => {
      selectAllCheckboxEl = fixture.debugElement.query(By.css('[data-testid="selectAll"]'));
    });

    it("should check all rows in table when checked", () => {
      // arrange
      const selectedUrls = new Set<string>();
      const dataSource = new TableDataSource<ApplicationHealthReportDetailEnriched>();
      dataSource.data = mockTableData;

      fixture.componentRef.setInput("selectedUrls", selectedUrls);
      fixture.componentRef.setInput("dataSource", dataSource);
      fixture.detectChanges();

      // act
      selectAllCheckboxEl.nativeElement.click();
      fixture.detectChanges();

      // assert
      expect(selectedUrls.has("google.com")).toBe(true);
      expect(selectedUrls.has("facebook.com")).toBe(true);
      expect(selectedUrls.has("twitter.com")).toBe(true);
      expect(selectedUrls.size).toBe(3);
    });

    it("should uncheck all rows in table when unchecked", () => {
      // arrange
      const selectedUrls = new Set<string>(["google.com", "facebook.com", "twitter.com"]);
      const dataSource = new TableDataSource<ApplicationHealthReportDetailEnriched>();
      dataSource.data = mockTableData;

      fixture.componentRef.setInput("selectedUrls", selectedUrls);
      fixture.componentRef.setInput("dataSource", dataSource);
      fixture.detectChanges();

      // act
      selectAllCheckboxEl.nativeElement.click();
      fixture.detectChanges();

      // assert
      expect(selectedUrls.size).toBe(0);
    });

    it("should become checked when all rows in table are checked", () => {
      // arrange
      const selectedUrls = new Set<string>(["google.com", "facebook.com", "twitter.com"]);
      const dataSource = new TableDataSource<ApplicationHealthReportDetailEnriched>();
      dataSource.data = mockTableData;

      fixture.componentRef.setInput("selectedUrls", selectedUrls);
      fixture.componentRef.setInput("dataSource", dataSource);
      fixture.detectChanges();

      // assert
      expect(selectAllCheckboxEl.nativeElement.checked).toBe(true);
    });

    it("should become unchecked when any row in table is unchecked", () => {
      // arrange
      const selectedUrls = new Set<string>(["google.com", "facebook.com"]);
      const dataSource = new TableDataSource<ApplicationHealthReportDetailEnriched>();
      dataSource.data = mockTableData;

      fixture.componentRef.setInput("selectedUrls", selectedUrls);
      fixture.componentRef.setInput("dataSource", dataSource);
      fixture.detectChanges();

      // assert
      expect(selectAllCheckboxEl.nativeElement.checked).toBe(false);
    });
  });
});
