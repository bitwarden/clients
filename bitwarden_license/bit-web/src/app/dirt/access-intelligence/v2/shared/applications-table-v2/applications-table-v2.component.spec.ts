import { ElementRef, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { I18nMockService, ScrollLayoutService, TableDataSource } from "@bitwarden/components";

import {
  ApplicationsTableV2Component,
  ApplicationTableRowV2,
} from "./applications-table-v2.component";

// bit-table-scroll uses ResizeObserver internally, which JSDOM doesn't implement
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

/**
 * NOTE: Row-level DOM tests (row content, icon display per row, row click handlers,
 * row highlighting, individual checkboxes) are not included in this spec because
 * bit-table-scroll uses CdkVirtualScrollViewport. Virtual scrolling requires real
 * DOM dimensions (viewport height) to determine which rows to render — JSDOM provides
 * no real dimensions, so *cdkVirtualFor renders zero rows.
 *
 * Template/row rendering is covered visually by Storybook stories (dirt-applications-table-v2.component.stories.ts).
 * Component logic and header elements (which render without virtual scroll) are tested here.
 *
 */
describe("ApplicationsTableV2Component", () => {
  let component: ApplicationsTableV2Component;
  let fixture: ComponentFixture<ApplicationsTableV2Component>;
  let mockDataSource: TableDataSource<ApplicationTableRowV2>;
  let mockSelectedUrls: Set<string>;
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

    // Provide a non-null scroll host so ScrollLayoutDirective doesn't log
    // "ScrollLayoutDirective can't find scroll host" during tests.
    // bit-table-scroll uses bitScrollLayout which requires a bitScrollLayoutHost parent —
    // one that doesn't exist in the JSDOM test environment.
    const mockScrollEl = new ElementRef(document.createElement("div"));
    const mockScrollLayoutService = {
      scrollableRef: signal(mockScrollEl),
      scrollableRef$: new BehaviorSubject(mockScrollEl),
    };

    await TestBed.configureTestingModule({
      imports: [ApplicationsTableV2Component],
      providers: [
        { provide: ScrollLayoutService, useValue: mockScrollLayoutService },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              application: "Application",
              atRiskPasswords: "At-Risk Passwords",
              totalPasswords: "Total Passwords",
              atRiskMembers: "At-Risk Members",
              totalMembers: "Total Members",
              criticalBadge: "Critical",
              selectAll: "Select all",
              deselectAll: "Deselect all",
              select: "Select",
              options: "Options",
              unmarkAsCritical: "Unmark as critical",
              all: "All",
            }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationsTableV2Component);
    component = fixture.componentInstance;

    // Set required inputs
    fixture.componentRef.setInput("dataSource", mockDataSource);
    fixture.componentRef.setInput("selectedUrls", mockSelectedUrls);
    fixture.componentRef.setInput("openApplication", "");
  });

  // ==================== Component Initialization ====================

  describe("Component Initialization", () => {
    it("should create component", () => {
      expect(component).toBeTruthy();
    });

    it("should accept required and optional inputs", () => {
      expect(component.dataSource()).toBe(mockDataSource);
      expect(component.selectedUrls()).toBe(mockSelectedUrls);
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

    it("should render table with empty data", () => {
      mockDataSource.data = [];
      fixture.detectChanges();

      const tableElement = fixture.nativeElement.querySelector("bit-table-scroll");
      expect(tableElement).toBeTruthy();
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

    it("should emit true from selectAllChange when selectAllChanged called with checked=true", () => {
      mockDataSource.data = [
        createTableRow("github.com", 5, 10, 2, 5),
        createTableRow("gitlab.com", 3, 8, 1, 3),
      ];

      const emitted: boolean[] = [];
      component.selectAllChange.subscribe((v: boolean) => emitted.push(v));

      component.selectAllChanged({ checked: true } as HTMLInputElement);

      expect(emitted).toEqual([true]);
    });

    it("should emit false from selectAllChange when selectAllChanged called with checked=false", () => {
      mockDataSource.data = [
        createTableRow("github.com", 5, 10, 2, 5),
        createTableRow("gitlab.com", 3, 8, 1, 3),
      ];

      const emitted: boolean[] = [];
      component.selectAllChange.subscribe((v: boolean) => emitted.push(v));

      component.selectAllChanged({ checked: false } as HTMLInputElement);

      expect(emitted).toEqual([false]);
    });

    it("should emit without error when selectAllChanged called with empty table", () => {
      mockDataSource.data = [];

      const emitted: boolean[] = [];
      component.selectAllChange.subscribe((v: boolean) => emitted.push(v));

      expect(() => component.selectAllChanged({ checked: true } as HTMLInputElement)).not.toThrow();
      expect(emitted).toEqual([true]);
    });
  });

  // ==================== Select All Checkbox (Header Element) ====================

  describe("Select All Checkbox", () => {
    it("should have aria-label on select all checkbox", () => {
      fixture.detectChanges();

      const selectAllCheckbox = fixture.nativeElement.querySelector('[data-testid="selectAll"]');
      expect(selectAllCheckbox.getAttribute("aria-label")).toBeTruthy();
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

    it("should handle very long application names", () => {
      const longName = "a".repeat(100) + ".com";
      mockDataSource.data = [createTableRow(longName, 5, 10, 2, 5)];

      expect(() => fixture.detectChanges()).not.toThrow();
    });
  });

  // ==================== OnPush Change Detection Tests ====================

  describe("OnPush Change Detection", () => {
    it("should update when selectedUrls input changes", () => {
      mockDataSource.data = [createTableRow("github.com", 5, 10, 2, 5)];

      const newSelectedUrls = new Set<string>(["github.com"]);
      fixture.componentRef.setInput("selectedUrls", newSelectedUrls);
      fixture.detectChanges();

      expect(component.allAppsSelected()).toBe(true);
    });
  });

  // ==================== showStar / showCheckbox ====================

  const mockUnmarkHandler = jest.fn();

  describe("showStar", () => {
    it("returns true when onUnmarkAsCritical is provided regardless of isMarkedAsCritical", () => {
      fixture.componentRef.setInput("onUnmarkAsCritical", mockUnmarkHandler);

      expect(component["showStar"](true)).toBe(true);
      expect(component["showStar"](false)).toBe(true);
    });

    it("returns true when onUnmarkAsCritical is not provided, showCriticalBadge is false, and row is critical", () => {
      fixture.componentRef.setInput("showCriticalBadge", false);

      expect(component["showStar"](true)).toBe(true);
    });

    it("returns false when onUnmarkAsCritical is not provided, showCriticalBadge is false, and row is not critical", () => {
      fixture.componentRef.setInput("showCriticalBadge", false);

      expect(component["showStar"](false)).toBe(false);
    });

    it("returns false when onUnmarkAsCritical is not provided and showCriticalBadge is true", () => {
      fixture.componentRef.setInput("showCriticalBadge", true);

      expect(component["showStar"](true)).toBe(false);
      expect(component["showStar"](false)).toBe(false);
    });
  });

  describe("showCheckbox", () => {
    it("returns false when onUnmarkAsCritical is provided regardless of isMarkedAsCritical", () => {
      fixture.componentRef.setInput("onUnmarkAsCritical", mockUnmarkHandler);

      expect(component["showCheckbox"](true)).toBe(false);
      expect(component["showCheckbox"](false)).toBe(false);
    });

    it("returns true when onUnmarkAsCritical is not provided and showCriticalBadge is true", () => {
      fixture.componentRef.setInput("showCriticalBadge", true);

      expect(component["showCheckbox"](true)).toBe(true);
      expect(component["showCheckbox"](false)).toBe(true);
    });

    it("returns true when onUnmarkAsCritical is not provided, showCriticalBadge is false, and row is not critical", () => {
      fixture.componentRef.setInput("showCriticalBadge", false);

      expect(component["showCheckbox"](false)).toBe(true);
    });

    it("returns false when onUnmarkAsCritical is not provided, showCriticalBadge is false, and row is critical", () => {
      fixture.componentRef.setInput("showCriticalBadge", false);

      expect(component["showCheckbox"](true)).toBe(false);
    });
  });
});
