import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ApplicationHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models";
import { createReport } from "@bitwarden/bit-common/dirt/reports/risk-insights/testing/test-helpers";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { ReviewApplicationsViewV2Component } from "./review-applications-view-v2.component";

describe("ReviewApplicationsViewV2Component", () => {
  let component: ReviewApplicationsViewV2Component;
  let fixture: ComponentFixture<ReviewApplicationsViewV2Component>;

  /**
   * Helper to access protected/private members for testing.
   */
  const testAccess = (comp: ReviewApplicationsViewV2Component) => comp as any;

  /** Creates a minimal CipherView with a specific ID for icon lookup testing */
  const createTestCipher = (id: string, name: string): CipherView => {
    const cipher = new CipherView();
    cipher.id = id;
    cipher.name = name;
    return cipher;
  };

  /** Sample applications for reuse across tests */
  const sampleApps: ApplicationHealthView[] = [
    createReport("github.com", { u1: true, u2: false }, { c1: true }),
    createReport("gitlab.com", { u3: true }, { c2: true }),
    createReport("bitbucket.org", { u4: false }, { c3: false }),
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewApplicationsViewV2Component],
      schemas: [NO_ERRORS_SCHEMA],
    })
      // Strip template + imports to avoid I18nPipe/SharedModule DI requirements.
      // All tests exercise component logic, not template rendering.
      .overrideComponent(ReviewApplicationsViewV2Component, {
        set: { template: "", imports: [] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ReviewApplicationsViewV2Component);
    component = fixture.componentInstance;

    // Set required signal inputs
    fixture.componentRef.setInput("applications", sampleApps);
    fixture.componentRef.setInput("ciphers", []);
    fixture.componentRef.setInput("selectedApplications", new Set<string>());
  });

  // ==================== Component Creation ====================

  describe("Initialization", () => {
    it("should create component", () => {
      expect(component).toBeTruthy();
    });

    it("should initialize searchText to empty string", () => {
      expect(testAccess(component).searchText()).toBe("");
    });
  });

  // ==================== filteredApplications Computed ====================

  describe("filteredApplications computed (search)", () => {
    it("should return all applications when search is empty", () => {
      expect(testAccess(component).filteredApplications()).toHaveLength(3);
    });

    it("should filter applications by name (case-insensitive)", () => {
      component.onSearchTextChanged("git");

      const filtered = testAccess(component).filteredApplications();
      expect(filtered).toHaveLength(2);
      expect(filtered.map((a: ApplicationHealthView) => a.applicationName)).toEqual(
        expect.arrayContaining(["github.com", "gitlab.com"]),
      );
    });

    it("should filter case-insensitively (uppercase search)", () => {
      component.onSearchTextChanged("GITHUB");

      const filtered = testAccess(component).filteredApplications();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].applicationName).toBe("github.com");
    });

    it("should return empty array when no applications match search", () => {
      component.onSearchTextChanged("nonexistent-app");

      expect(testAccess(component).filteredApplications()).toHaveLength(0);
    });

    it("should update filteredApplications when searchText changes", () => {
      component.onSearchTextChanged("bit");
      expect(testAccess(component).filteredApplications()).toHaveLength(1);

      component.onSearchTextChanged("");
      expect(testAccess(component).filteredApplications()).toHaveLength(3);
    });
  });

  // ==================== isAllSelected ====================

  describe("isAllSelected()", () => {
    it("should return true when all filtered applications are selected", () => {
      fixture.componentRef.setInput(
        "selectedApplications",
        new Set(["github.com", "gitlab.com", "bitbucket.org"]),
      );

      expect(component.isAllSelected()).toBe(true);
    });

    it("should return false when no applications are selected", () => {
      fixture.componentRef.setInput("selectedApplications", new Set<string>());

      expect(component.isAllSelected()).toBe(false);
    });

    it("should return false when only some applications are selected", () => {
      fixture.componentRef.setInput("selectedApplications", new Set(["github.com"]));

      expect(component.isAllSelected()).toBe(false);
    });

    it("should only consider filtered applications when search is active", () => {
      // Search filters to github.com and gitlab.com
      component.onSearchTextChanged("git");

      // Select only the two filtered apps — should be "all selected" for the filtered set
      fixture.componentRef.setInput("selectedApplications", new Set(["github.com", "gitlab.com"]));

      expect(component.isAllSelected()).toBe(true);
    });

    it("should return false when filtered apps are not all selected", () => {
      component.onSearchTextChanged("git");
      // Only one of the two filtered apps selected
      fixture.componentRef.setInput("selectedApplications", new Set(["github.com"]));

      expect(component.isAllSelected()).toBe(false);
    });

    it("should return false for empty application list", () => {
      fixture.componentRef.setInput("applications", []);
      fixture.componentRef.setInput("selectedApplications", new Set<string>());

      expect(component.isAllSelected()).toBe(false);
    });
  });

  // ==================== Outputs ====================

  describe("Outputs", () => {
    it("should emit app name via onToggleSelection when toggleSelection() is called", () => {
      const emitted: string[] = [];
      component.onToggleSelection.subscribe((val) => emitted.push(val));

      component.toggleSelection("github.com");

      expect(emitted).toEqual(["github.com"]);
    });

    it("should emit via onToggleAll when toggleAll() is called", () => {
      let emitCount = 0;
      component.onToggleAll.subscribe(() => emitCount++);

      component.toggleAll();

      expect(emitCount).toBe(1);
    });
  });

  // ==================== getIconCipher ====================

  describe("getIconCipher()", () => {
    it("should return the matching cipher when app has a known icon cipher ID", () => {
      const testCipher = createTestCipher("cipher-github", "GitHub Login");
      fixture.componentRef.setInput("ciphers", [testCipher]);

      const app = sampleApps[0]; // github.com
      jest.spyOn(app, "getIconCipherId").mockReturnValue("cipher-github");

      const result = component.getIconCipher(app);

      expect(result).toBe(testCipher);
    });

    it("should return undefined when the icon cipher ID does not match any cipher", () => {
      const testCipher = createTestCipher("cipher-other", "Other Login");
      fixture.componentRef.setInput("ciphers", [testCipher]);

      const app = sampleApps[0];
      jest.spyOn(app, "getIconCipherId").mockReturnValue("cipher-not-in-list");

      const result = component.getIconCipher(app);

      expect(result).toBeUndefined();
    });

    it("should return undefined when app has no icon cipher ID", () => {
      fixture.componentRef.setInput("ciphers", [createTestCipher("cipher-abc", "Some Login")]);

      const app = sampleApps[0];
      jest.spyOn(app, "getIconCipherId").mockReturnValue(undefined);

      const result = component.getIconCipher(app);

      expect(result).toBeUndefined();
    });

    it("should return undefined when ciphers list is empty", () => {
      fixture.componentRef.setInput("ciphers", []);

      const app = sampleApps[0];
      jest.spyOn(app, "getIconCipherId").mockReturnValue("cipher-github");

      const result = component.getIconCipher(app);

      expect(result).toBeUndefined();
    });
  });
});
