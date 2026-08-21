import { mock, MockProxy } from "jest-mock-extended";

import AutofillPageDetails from "../../../models/autofill-page-details";
import {
  PageQualification,
  QualificationEngine,
} from "../../../qualification/abstractions/qualification-engine";
import { QualificationEngineId } from "../../../qualification/types/engine-id";
import { FieldRole } from "../../../qualification/types/field-role";
import { FormCategory } from "../../../qualification/types/form-category";

import { SwappableQualificationEngine } from "./swappable.engine";

function stubEngine(id: QualificationEngineId, overrides: Partial<QualificationEngine> = {}) {
  const engine = mock<QualificationEngine>();
  Object.defineProperty(engine, "id", { value: id });
  Object.defineProperty(engine, "name", { value: `${id} engine` });
  Object.defineProperty(engine, "version", { value: "1.2.3" });
  Object.defineProperty(engine, "coveredRoles", { value: overrides.coveredRoles });
  Object.defineProperty(engine, "coveredCategories", { value: overrides.coveredCategories });
  return engine;
}

describe("SwappableQualificationEngine", () => {
  let legacy: MockProxy<QualificationEngine>;
  let scoring: MockProxy<QualificationEngine>;
  let build: jest.Mock<QualificationEngine, [QualificationEngineId]>;
  let swappable: SwappableQualificationEngine;

  beforeEach(() => {
    legacy = stubEngine(QualificationEngineId.Legacy);
    scoring = stubEngine(QualificationEngineId.Scoring, {
      coveredRoles: new Set([FieldRole.Username]),
      coveredCategories: new Set([FormCategory.Login]),
    });
    build = jest.fn((id) => (id === QualificationEngineId.Legacy ? legacy : scoring));
    swappable = new SwappableQualificationEngine(build, QualificationEngineId.Legacy);
  });

  it("builds the initial engine once", () => {
    expect(build).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledWith(QualificationEngineId.Legacy);
  });

  it("reports the identity of the engine currently running", () => {
    expect(swappable.id).toBe(QualificationEngineId.Legacy);

    swappable.swap(QualificationEngineId.Scoring);

    expect(swappable.id).toBe(QualificationEngineId.Scoring);
    expect(swappable.name).toBe("scoring engine");
    expect(swappable.version).toBe("1.2.3");
  });

  it("reports the coverage of the engine currently running", () => {
    // The adapter reads coverage to decide what to route and what to fall
    // through. Coverage captured at construction leaves it routing roles the
    // new engine can't emit, which shows up as a silent false rather than a
    // failure.
    expect(swappable.coveredRoles).toBeUndefined();
    expect(swappable.coveredCategories).toBeUndefined();

    swappable.swap(QualificationEngineId.Scoring);

    expect(swappable.coveredRoles).toEqual(new Set([FieldRole.Username]));
    expect(swappable.coveredCategories).toEqual(new Set([FormCategory.Login]));
  });

  it("delegates classify to the engine currently running", () => {
    const pageDetails = mock<AutofillPageDetails>({ forms: {}, fields: [] });
    const result = mock<PageQualification>();
    scoring.classify.mockReturnValue(result);

    swappable.swap(QualificationEngineId.Scoring);

    expect(swappable.classify(pageDetails)).toBe(result);
    expect(legacy.classify).not.toHaveBeenCalled();
  });

  it("ignores a swap to the id already running", () => {
    // Selection sources re-emit. Rebuilding on every emission would throw away
    // a warm memo cache for no change in behavior.
    expect(swappable.swap(QualificationEngineId.Legacy)).toBe(false);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it("reports whether a swap changed the engine", () => {
    expect(swappable.swap(QualificationEngineId.Scoring)).toBe(true);
    expect(build).toHaveBeenCalledTimes(2);
  });
});
