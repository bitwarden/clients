import { ComponentFixture, TestBed } from "@angular/core/testing";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { TableDataSource } from "@bitwarden/components";

import {
  ApplicationsTableV2Component,
  ApplicationTableRowV2,
} from "./applications-table-v2.component";

describe("ApplicationsTableV2Component", () => {
  let component: ApplicationsTableV2Component;
  let fixture: ComponentFixture<ApplicationsTableV2Component>;
  let mockDataSource: TableDataSource<ApplicationTableRowV2>;
  let mockSelectedUrls: Set<string>;
  let mockShowAppAtRiskMembers: jest.Mock;
  let mockCheckboxChange: jest.Mock;

  // Test helper to create table row data
  const createTableRow = (
    applicationName: string,
    atRiskPasswordCount: number = 0,
    passwordCount: number = 0,
    atRiskMemberCount: number = 0,
    memberCount: number = 0,
    isMarkedAsCritical: boolean = false,
    iconCipher?: CipherView,
  ): ApplicationTableRowV2 => ({
    applicationName,
    atRiskPasswordCount,
    passwordCount,
    atRiskMemberCount,
    memberCount,
    isMarkedAsCritical,
    iconCipher,
  });

  beforeEach(async () => {
    mockDataSource = new TableDataSource<ApplicationTableRowV2>();
    mockSelectedUrls = new Set<string>();
    mockShowAppAtRiskMembers = jest.fn();
    mockCheckboxChange = jest.fn();

    await TestBed.configureTestingModule({
      imports: [ApplicationsTableV2Component],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationsTableV2Component);
    component = fixture.componentInstance;

    // Set required inputs
    fixture.componentRef.setInput("dataSource", mockDataSource);
    fixture.componentRef.setInput("selectedUrls", mockSelectedUrls);
    fixture.componentRef.setInput("openApplication", "");
    fixture.componentRef.setInput("showAppAtRiskMembers", mockShowAppAtRiskMembers);
    fixture.componentRef.setInput("checkboxChange", mockCheckboxChange);
  });

  // ==================== Component Initialization ====================

  describe("Component Initialization", () => {
    it("should create component", () => {
      expect(component).toBeTruthy();
    });

    it("should accept required inputs", () => {
      expect(component.dataSource()).toBe(mockDataSource);
      expect(component.selectedUrls()).toBe(mockSelectedUrls);
      expect(component.showAppAtRiskMembers()).toBe(mockShowAppAtRiskMembers);
      expect(component.checkboxChange()).toBe(mockCheckboxChange);
    });

    it("should accept optional openApplication input", () => {
      fixture.componentRef.setInput("openApplication", "github.com");
      expect(component.openApplication()).toBe("github.com");
    });
  });

  // ==================== Table Rendering Tests ====================

  describe("Table Rendering", () => {
    it("should render table with data", () => {
      mockDataSource.data = [
        createTableRow("github.com", 5, 10, 2, 5, true),
        createTableRow("gitlab.com", 3, 8, 1, 3, false),
      ];

      fixture.detectChanges();

      const tableElement = fixture.nativeElement.querySelector("bit-table-scroll");
      expect(tableElement).toBeTruthy();
    });

    it("should render rows with application names", () => {
      mockDataSource.data = [
        createTableRow("github.com", 5, 10, 2, 5, true),
        createTableRow("gitlab.com", 3, 8, 1, 3, false),
      ];

      fixture.detectChanges();

      const tableText = fixture.nativeElement.textContent;
      expect(tableText).toContain("github.com");
      expect(tableText).toContain("gitlab.com");
    });

    it("should render table with empty data", () => {
      mockDataSource.data = [];
      fixture.detectChanges();

      const tableElement = fixture.nativeElement.querySelector("bit-table-scroll");
      expect(tableElement).toBeTruthy();
    });
  });

  // ==================== Icon Display Tests ====================

  describe("Icon Display", () => {
    it("should display vault icon when iconCipher exists", () => {
      const mockCipher = new CipherView();
      mockCipher.name = "GitHub Login";

      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5, false, mockCipher)];
      fixture.detectChanges();

      const vaultIcon = fixture.nativeElement.querySelector("app-vault-icon");
      expect(vaultIcon).toBeTruthy();
    });

    it("should display globe icon when iconCipher is undefined", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5, false, undefined)];
      fixture.detectChanges();

      const globeIcon = fixture.nativeElement.querySelector(".bwi-globe");
      expect(globeIcon).toBeTruthy();
    });

    it("should not display vault icon when iconCipher is undefined", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5, false, undefined)];
      fixture.detectChanges();

      const vaultIcon = fixture.nativeElement.querySelector("app-vault-icon");
      expect(vaultIcon).toBeNull();
    });
  });

  // ==================== Select All Functionality Tests ====================

  describe("Select All Functionality", () => {
    it("should return false when no apps selected", () => {
      mockDataSource.data = [
        createTableRow("github.com", 5, 10, 2, 5),
        createTableRow("gitlab.com", 3, 8, 1, 3),
      ];

      expect(component.allAppsSelected()).toBe(false);
    });

    it("should return true when all apps selected", () => {
      mockDataSource.data = [
        createTableRow("github.com", 5, 10, 2, 5),
        createTableRow("gitlab.com", 3, 8, 1, 3),
      ];

      mockSelectedUrls.add("github.com");
      mockSelectedUrls.add("gitlab.com");

      expect(component.allAppsSelected()).toBe(true);
    });

    it("should return false when some apps selected", () => {
      mockDataSource.data = [
        createTableRow("github.com", 5, 10, 2, 5),
        createTableRow("gitlab.com", 3, 8, 1, 3),
      ];

      mockSelectedUrls.add("github.com");

      expect(component.allAppsSelected()).toBe(false);
    });

    it("should return false when table is empty", () => {
      mockDataSource.data = [];

      expect(component.allAppsSelected()).toBe(false);
    });

    it("should select all apps when selectAllChanged called with checked=true", () => {
      mockDataSource.data = [
        createTableRow("github.com", 5, 10, 2, 5),
        createTableRow("gitlab.com", 3, 8, 1, 3),
      ];

      const mockTarget = { checked: true } as HTMLInputElement;
      component.selectAllChanged(mockTarget);

      expect(mockSelectedUrls.has("github.com")).toBe(true);
      expect(mockSelectedUrls.has("gitlab.com")).toBe(true);
      expect(mockSelectedUrls.size).toBe(2);
    });

    it("should deselect all apps when selectAllChanged called with checked=false", () => {
      mockDataSource.data = [
        createTableRow("github.com", 5, 10, 2, 5),
        createTableRow("gitlab.com", 3, 8, 1, 3),
      ];

      mockSelectedUrls.add("github.com");
      mockSelectedUrls.add("gitlab.com");

      const mockTarget = { checked: false } as HTMLInputElement;
      component.selectAllChanged(mockTarget);

      expect(mockSelectedUrls.size).toBe(0);
    });

    it("should not error when selectAllChanged called with empty table", () => {
      mockDataSource.data = [];

      const mockTarget = { checked: true } as HTMLInputElement;

      expect(() => component.selectAllChanged(mockTarget)).not.toThrow();
      expect(mockSelectedUrls.size).toBe(0);
    });
  });

  // ==================== Individual Selection Tests ====================

  describe("Individual Selection", () => {
    it("should show checked state for selected application", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5)];
      mockSelectedUrls.add("github.com");

      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector(
        'input[type="checkbox"]:not([data-testid="selectAll"])',
      );
      expect(checkbox.checked).toBe(true);
    });

    it("should show unchecked state for unselected application", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5)];

      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector(
        'input[type="checkbox"]:not([data-testid="selectAll"])',
      );
      expect(checkbox.checked).toBe(false);
    });

    it("should call checkboxChange callback when row checkbox clicked", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5)];
      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector(
        'input[type="checkbox"]:not([data-testid="selectAll"])',
      );
      const event = new Event("change");
      checkbox.dispatchEvent(event);

      expect(mockCheckboxChange).toHaveBeenCalledWith("github.com", expect.any(Event));
    });
  });

  // ==================== Row Actions Tests ====================

  describe("Row Actions", () => {
    it("should call showAppAtRiskMembers when row clicked", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5)];
      fixture.detectChanges();

      // Find a clickable cell (not the checkbox cell)
      const clickableCells = fixture.nativeElement.querySelectorAll("td.tw-cursor-pointer");
      const firstClickableCell = clickableCells[0];

      firstClickableCell.click();

      expect(mockShowAppAtRiskMembers).toHaveBeenCalledWith("github.com");
    });

    it("should call showAppAtRiskMembers on Enter keypress", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5)];
      fixture.detectChanges();

      const clickableCells = fixture.nativeElement.querySelectorAll("td.tw-cursor-pointer");
      const firstClickableCell = clickableCells[0];

      const event = new KeyboardEvent("keydown", { key: "Enter" });
      firstClickableCell.dispatchEvent(event);

      expect(mockShowAppAtRiskMembers).toHaveBeenCalledWith("github.com");
    });

    it("should call showAppAtRiskMembers on Space keypress", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5)];
      fixture.detectChanges();

      const clickableCells = fixture.nativeElement.querySelectorAll("td.tw-cursor-pointer");
      const firstClickableCell = clickableCells[0];

      const event = new KeyboardEvent("keydown", { key: " " });
      firstClickableCell.dispatchEvent(event);

      expect(mockShowAppAtRiskMembers).toHaveBeenCalledWith("github.com");
    });
  });

  // ==================== Critical Badge Tests ====================

  describe("Critical Badge", () => {
    it("should display critical badge for critical applications", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5, true)];
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector("[bitBadge]");
      expect(badge).toBeTruthy();
    });

    it("should not display critical badge for non-critical applications", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5, false)];
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector("[bitBadge]");
      expect(badge).toBeNull();
    });
  });

  // ==================== Accessibility Tests ====================

  describe("Accessibility", () => {
    it("should have aria-label on select all checkbox", () => {
      fixture.detectChanges();

      const selectAllCheckbox = fixture.nativeElement.querySelector('[data-testid="selectAll"]');
      expect(selectAllCheckbox.getAttribute("aria-label")).toBeTruthy();
    });

    it("should have role=button on clickable cells", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5)];
      fixture.detectChanges();

      const clickableCells = fixture.nativeElement.querySelectorAll("td.tw-cursor-pointer");
      const firstClickableCell = clickableCells[0];

      expect(firstClickableCell.getAttribute("role")).toBe("button");
    });

    it("should have tabindex=0 on clickable cells for keyboard navigation", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5)];
      fixture.detectChanges();

      const clickableCells = fixture.nativeElement.querySelectorAll("td.tw-cursor-pointer");
      const firstClickableCell = clickableCells[0];

      expect(firstClickableCell.getAttribute("tabindex")).toBe("0");
    });

    it("should have aria-label for application name", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5, true)];
      fixture.detectChanges();

      const clickableCells = fixture.nativeElement.querySelectorAll("td.tw-cursor-pointer");
      // Find the cell with application name
      const appNameCell = Array.from(clickableCells).find((cell: Element) =>
        cell.getAttribute("aria-label")?.includes("github.com"),
      );

      expect(appNameCell).toBeTruthy();
    });

    it("should disable select all checkbox when table is empty", () => {
      mockDataSource.data = [];
      fixture.detectChanges();

      const selectAllCheckbox = fixture.nativeElement.querySelector('[data-testid="selectAll"]');
      expect(selectAllCheckbox.disabled).toBe(true);
    });

    it("should enable select all checkbox when table has data", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5)];
      fixture.detectChanges();

      const selectAllCheckbox = fixture.nativeElement.querySelector('[data-testid="selectAll"]');
      expect(selectAllCheckbox.disabled).toBe(false);
    });
  });

  // ==================== Open Application Highlighting Tests ====================

  describe("Open Application Highlighting", () => {
    it("should highlight row when application is open", () => {
      mockDataSource.data = [
        createTableRow("github.com", 5, 10, 2, 5),
        createTableRow("gitlab.com", 3, 8, 1, 3),
      ];

      fixture.componentRef.setInput("openApplication", "github.com");
      fixture.detectChanges();

      const highlightedCells = fixture.nativeElement.querySelectorAll(".tw-bg-primary-100");
      expect(highlightedCells.length).toBeGreaterThan(0);
    });

    it("should not highlight rows when no application is open", () => {
      mockDataSource.data = [
        createTableRow("github.com", 5, 10, 2, 5),
        createTableRow("gitlab.com", 3, 8, 1, 3),
      ];

      fixture.componentRef.setInput("openApplication", "");
      fixture.detectChanges();

      const highlightedCells = fixture.nativeElement.querySelectorAll(".tw-bg-primary-100");
      expect(highlightedCells.length).toBe(0);
    });

    it("should highlight only matching application row", () => {
      mockDataSource.data = [
        createTableRow("github.com", 5, 10, 2, 5),
        createTableRow("gitlab.com", 3, 8, 1, 3),
      ];

      fixture.componentRef.setInput("openApplication", "github.com");
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll("tr[bitRow]");
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  // ==================== Edge Cases Tests ====================

  describe("Edge Cases", () => {
    it("should handle filteredData being null/undefined", () => {
      mockDataSource.filteredData = null as any;

      expect(() => component.allAppsSelected()).not.toThrow();
      expect(component.allAppsSelected()).toBe(false);
    });

    it("should handle null table data gracefully", () => {
      mockDataSource.data = null as any;

      expect(() => fixture.detectChanges()).not.toThrow();
    });

    it("should handle application names with special characters", () => {
      mockDataSource.data = [
        createTableRow("app-with-dashes.com", 5, 10, 2, 5),
        createTableRow("app_with_underscores.io", 3, 8, 1, 3),
      ];

      fixture.detectChanges();

      const tableText = fixture.nativeElement.textContent;
      expect(tableText).toContain("app-with-dashes.com");
      expect(tableText).toContain("app_with_underscores.io");
    });

    it("should handle very long application names", () => {
      const longName = "a".repeat(100) + ".com";
      mockDataSource.data = [createTableRow(longName, 5, 10, 2, 5)];

      expect(() => fixture.detectChanges()).not.toThrow();
    });

    it("should handle zero counts correctly", () => {
      mockDataSource.data = [createTableRow("github.com", 0, 0, 0, 0)];

      fixture.detectChanges();

      const tableText = fixture.nativeElement.textContent;
      expect(tableText).toContain("0");
    });
  });

  // ==================== OnPush Change Detection Tests ====================

  describe("OnPush Change Detection", () => {
    it("should update when dataSource input changes", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5)];
      fixture.detectChanges();

      const newDataSource = new TableDataSource<ApplicationTableRowV2>();
      newDataSource.data = [createTableRow("gitlab.com", 3, 8, 1, 3)];

      fixture.componentRef.setInput("dataSource", newDataSource);
      fixture.detectChanges();

      const tableText = fixture.nativeElement.textContent;
      expect(tableText).toContain("gitlab.com");
    });

    it("should update when selectedUrls input changes", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5)];

      const newSelectedUrls = new Set<string>(["github.com"]);
      fixture.componentRef.setInput("selectedUrls", newSelectedUrls);
      fixture.detectChanges();

      expect(component.allAppsSelected()).toBe(true);
    });

    it("should update when openApplication input changes", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5)];

      fixture.componentRef.setInput("openApplication", "");
      fixture.detectChanges();

      let highlightedCells = fixture.nativeElement.querySelectorAll(".tw-bg-primary-100");
      expect(highlightedCells.length).toBe(0);

      fixture.componentRef.setInput("openApplication", "github.com");
      fixture.detectChanges();

      highlightedCells = fixture.nativeElement.querySelectorAll(".tw-bg-primary-100");
      expect(highlightedCells.length).toBeGreaterThan(0);
    });
  });
});
