import { mock, MockProxy } from "jest-mock-extended";

import AutofillField from "../../../models/autofill-field";
import AutofillPageDetails from "../../../models/autofill-page-details";
import {
  PageQualification,
  QualificationEngine,
} from "../../../qualification/abstractions/qualification-engine";
import { FieldClassification } from "../../../qualification/types/classification";
import { QualificationEngineId } from "../../../qualification/types/engine-id";
import { FieldRole } from "../../../qualification/types/field-role";
import { FormCategory } from "../../../qualification/types/form-category";

import { LoggingQualificationEngine } from "./logging.engine";

// The decorator only emits on development builds, so every assertion about
// output needs the build-time constant flipped. `qualification-log` reads
// `process.env.ENV` on each call, so setting it per-test is enough.
const REAL_ENV = process.env.ENV;

describe("LoggingQualificationEngine", () => {
  let inner: MockProxy<QualificationEngine>;
  let logging: LoggingQualificationEngine;
  let pageDetails: AutofillPageDetails;
  let result: MockProxy<PageQualification>;
  let infoSpy: jest.SpyInstance;
  let groupSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.ENV = "development";

    inner = mock<QualificationEngine>();
    Object.defineProperty(inner, "id", { value: QualificationEngineId.Scoring });
    Object.defineProperty(inner, "name", { value: "Test Engine" });
    Object.defineProperty(inner, "version", { value: "1.2.3" });

    logging = new LoggingQualificationEngine(inner);

    pageDetails = mock<AutofillPageDetails>({ forms: {}, fields: [] });
    pageDetails.documentUrl = "https://example.test/login";
    pageDetails.forms = {};
    pageDetails.fields = [];

    result = mock<PageQualification>();
    result.scenario.mockReturnValue(null);
    result.fieldFor.mockReturnValue(null);
    inner.classify.mockReturnValue(result);

    infoSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    groupSpy = jest.spyOn(console, "groupCollapsed").mockImplementation(() => undefined);
    jest.spyOn(console, "groupEnd").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.ENV = REAL_ENV;
    jest.restoreAllMocks();
  });

  it("returns the inner engine's result unchanged", () => {
    expect(logging.classify(pageDetails)).toBe(result);
  });

  it("delegates identity and coverage to the inner engine", () => {
    const roles = new Set([FieldRole.Username]);
    const categories = new Set([FormCategory.Login]);
    Object.defineProperty(inner, "coveredRoles", { value: roles });
    Object.defineProperty(inner, "coveredCategories", { value: categories });

    expect(logging.id).toBe(QualificationEngineId.Scoring);
    expect(logging.name).toBe("Test Engine");
    expect(logging.version).toBe("1.2.3");
    expect(logging.coveredRoles).toBe(roles);
    expect(logging.coveredCategories).toBe(categories);
  });

  it("heads the group with the engine identity, page URL and counts", () => {
    logging.classify(pageDetails);

    expect(groupSpy).toHaveBeenCalledWith(
      expect.stringContaining("Test Engine v1.2.3 — https://example.test/login"),
    );
    expect(groupSpy).toHaveBeenCalledWith(expect.stringContaining("0 fields, 0 forms"));
  });

  it("reports a classified field's roles and form contexts", () => {
    pageDetails.fields = [fieldNamed("u", "username")];
    result.fieldFor.mockReturnValue(
      classification({
        matchedRoles: new Set([FieldRole.Username]),
        matchedFormContexts: new Set([FormCategory.Login]),
        topRole: FieldRole.Username,
      }),
    );

    logging.classify(pageDetails);

    const line = infoSpy.mock.calls.map((c) => String(c[0])).find((l) => l.includes("u ["));
    expect(line).toContain("role=username");
    expect(line).toContain("roles=[username]");
    expect(line).toContain("formContexts=[login]");
  });

  // The distinction the boolean interface swallows: a field the engine skipped
  // and a field it rejected both reach consumers as `false`.
  it("distinguishes an unclassified field from a rejected one", () => {
    pageDetails.fields = [fieldNamed("h", "hidden-thing")];
    result.fieldFor.mockReturnValue(null);

    logging.classify(pageDetails);

    const line = infoSpy.mock.calls.map((c) => String(c[0])).find((l) => l.includes("h ["));
    expect(line).toContain("(no classification)");
  });

  it("emits nothing on production builds", () => {
    process.env.ENV = "production";
    pageDetails.fields = [fieldNamed("u", "username")];

    expect(logging.classify(pageDetails)).toBe(result);
    expect(groupSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });
});

function fieldNamed(opid: string, htmlID: string): AutofillField {
  const field = mock<AutofillField>();
  field.opid = opid;
  field.htmlID = htmlID;
  field.type = "text";
  return field;
}

function classification(overrides: Partial<FieldClassification>): FieldClassification {
  return {
    matchedRoles: new Set(),
    matchedFormContexts: new Set(),
    topRole: null,
    confidence: "none",
    score: 0,
    allScores: [],
    ...overrides,
  };
}
