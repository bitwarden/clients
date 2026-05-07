import { AutofillTriagePageResult } from "../../types/autofill-triage";

import { formatAutofillTriageReport } from "./format-autofill-triage-report";

const baseResult: AutofillTriagePageResult = {
  tabId: 1,
  pageUrl: "https://example.com/login",
  analyzedAt: new Date("2026-01-01T00:00:00.000Z"),
  extensionVersion: "2024.1.0",
  browserInfo: { name: "Chrome", version: "120.0" },
  fields: [],
};

describe("formatAutofillTriageReport", () => {
  describe("header", () => {
    it("includes the report title", () => {
      const output = formatAutofillTriageReport(baseResult);
      expect(output).toContain("AutoFill Triage Report");
    });

    it("includes the page URL", () => {
      const output = formatAutofillTriageReport(baseResult);
      expect(output).toContain("https://example.com/login");
    });

    it("includes the analyzed timestamp", () => {
      const output = formatAutofillTriageReport(baseResult);
      expect(output).toContain("2026-01-01T00:00:00.000Z");
    });
  });

  describe("version information", () => {
    it("includes extension version when present", () => {
      const output = formatAutofillTriageReport({ ...baseResult, extensionVersion: "2024.1.0" });
      expect(output).toContain("Extension Version: 2024.1.0");
    });

    it("includes browser info when present", () => {
      const output = formatAutofillTriageReport({
        ...baseResult,
        browserInfo: { name: "Chrome", version: "120.0" },
      });
      expect(output).toContain("Browser: Chrome 120.0");
    });

    it("always includes the version section", () => {
      const output = formatAutofillTriageReport(baseResult);
      expect(output).toContain("Version Information:");
    });
  });

  describe("page context", () => {
    it("includes page context when present", () => {
      const output = formatAutofillTriageReport({
        ...baseResult,
        pageContext: {
          title: "Sign In",
          documentUrl: "https://example.com/login",
          totalForms: 1,
          totalFields: 3,
          collectedTimestamp: 1735689600000,
        },
      });
      expect(output).toContain("Title: Sign In");
      expect(output).toContain("Total Forms: 1");
      expect(output).toContain("Total Fields: 3");
    });

    it("omits page context section when absent", () => {
      const output = formatAutofillTriageReport(baseResult);
      expect(output).not.toContain("Page Information:");
    });
  });

  describe("eligible count", () => {
    it("reports 0 eligible when fields array is empty", () => {
      const output = formatAutofillTriageReport(baseResult);
      expect(output).toContain("Eligible: 0 of 0 fields");
    });

    it("counts only eligible fields", () => {
      const output = formatAutofillTriageReport({
        ...baseResult,
        fields: [
          { htmlType: "text", eligible: true, qualifiedAs: "login", conditions: [] },
          { htmlType: "password", eligible: true, qualifiedAs: "login", conditions: [] },
          { htmlType: "submit", eligible: false, qualifiedAs: "ineligible", conditions: [] },
        ],
      });
      expect(output).toContain("Eligible: 2 of 3 fields");
    });
  });

  describe("target element", () => {
    it("includes target element ref when present", () => {
      const output = formatAutofillTriageReport({ ...baseResult, targetElementRef: "username" });
      expect(output).toContain("Target Element: username");
    });

    it("omits target element line when absent", () => {
      const output = formatAutofillTriageReport(baseResult);
      expect(output).not.toContain("Target Element:");
    });
  });

  describe("field label", () => {
    it("uses htmlId and htmlType as label", () => {
      const output = formatAutofillTriageReport({
        ...baseResult,
        fields: [
          {
            htmlId: "email",
            htmlType: "email",
            eligible: true,
            qualifiedAs: "login",
            conditions: [],
          },
        ],
      });
      expect(output).toContain("Field: email (email)");
    });

    it("falls back to htmlName when htmlId is absent", () => {
      const output = formatAutofillTriageReport({
        ...baseResult,
        fields: [
          {
            htmlName: "pass",
            htmlType: "password",
            eligible: true,
            qualifiedAs: "login",
            conditions: [],
          },
        ],
      });
      expect(output).toContain("Field: pass (password)");
    });

    it("falls back to type only when neither id nor name is present", () => {
      const output = formatAutofillTriageReport({
        ...baseResult,
        fields: [
          { htmlType: "submit", eligible: false, qualifiedAs: "ineligible", conditions: [] },
        ],
      });
      expect(output).toContain("Field: (submit)");
    });

    it("labels unnamed fields with a fallback", () => {
      const output = formatAutofillTriageReport({
        ...baseResult,
        fields: [{ eligible: false, qualifiedAs: "ineligible", conditions: [] }],
      });
      expect(output).toContain("Field: (unnamed field)");
    });
  });

  describe("field status", () => {
    it("marks eligible fields with ELIGIBLE status", () => {
      const output = formatAutofillTriageReport({
        ...baseResult,
        fields: [{ htmlId: "u", eligible: true, qualifiedAs: "login", conditions: [] }],
      });
      expect(output).toContain("ELIGIBLE");
    });

    it("marks ineligible fields with INELIGIBLE status", () => {
      const output = formatAutofillTriageReport({
        ...baseResult,
        fields: [{ htmlId: "s", eligible: false, qualifiedAs: "ineligible", conditions: [] }],
      });
      expect(output).toContain("INELIGIBLE");
    });
  });

  describe("select options", () => {
    it("shows count and first 5 options", () => {
      const output = formatAutofillTriageReport({
        ...baseResult,
        fields: [
          {
            eligible: false,
            qualifiedAs: "ineligible",
            conditions: [],
            selectOptions: ["a", "b", "c", "d", "e", "f"],
          },
        ],
      });
      expect(output).toContain("Select Options: 6 options");
      expect(output).toContain("a, b, c, d, e...");
    });

    it("shows all options without ellipsis when 5 or fewer", () => {
      const output = formatAutofillTriageReport({
        ...baseResult,
        fields: [
          {
            eligible: false,
            qualifiedAs: "ineligible",
            conditions: [],
            selectOptions: ["x", "y"],
          },
        ],
      });
      expect(output).toContain("x, y");
      expect(output).not.toContain("...");
    });
  });

  describe("conditions", () => {
    it("includes all condition descriptions", () => {
      const output = formatAutofillTriageReport({
        ...baseResult,
        fields: [
          {
            eligible: true,
            qualifiedAs: "login",
            conditions: [
              { description: "Field is viewable", passed: true },
              { description: "Field is not readonly", passed: false },
            ],
          },
        ],
      });
      expect(output).toContain("Field is viewable");
      expect(output).toContain("Field is not readonly");
    });
  });

  describe("optional field properties", () => {
    it("does not throw when all optional properties are absent", () => {
      expect(() =>
        formatAutofillTriageReport({
          ...baseResult,
          fields: [{ eligible: false, qualifiedAs: "ineligible", conditions: [] }],
        }),
      ).not.toThrow();
    });

    it("includes value preview when present", () => {
      const output = formatAutofillTriageReport({
        ...baseResult,
        fields: [
          {
            eligible: true,
            qualifiedAs: "login",
            conditions: [],
            valuePreview: "user@example.c...",
          },
        ],
      });
      expect(output).toContain("Value: user@example.c...");
    });

    it("includes form context when present", () => {
      const output = formatAutofillTriageReport({
        ...baseResult,
        fields: [
          {
            eligible: true,
            qualifiedAs: "login",
            conditions: [],
            formContext: {
              htmlId: "login-form",
              htmlName: "login",
              htmlAction: "/auth",
              htmlMethod: "POST",
              fieldCount: 2,
            },
          },
        ],
      });
      expect(output).toContain("Form ID: login-form");
      expect(output).toContain("Form Action: /auth");
      expect(output).toContain("Fields in Form: 2");
    });
  });
});
