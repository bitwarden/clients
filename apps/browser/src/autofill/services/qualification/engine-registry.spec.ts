import AutofillField from "../../models/autofill-field";
import AutofillForm from "../../models/autofill-form";
import AutofillPageDetails from "../../models/autofill-page-details";
import { QualificationEngineId } from "../../qualification/types/engine-id";
import { LegacyInlineMenuFieldQualificationService } from "../inline-menu-field-qualification.service";

import { DEFAULT_ENGINE_ID, ENGINE_REGISTRY, resolveEngineId } from "./engine-registry";
import { buildQualificationStack } from "./qualification-service.factory";

const ALL_IDS = Object.values(QualificationEngineId);

describe("ENGINE_REGISTRY", () => {
  it("registers a factory for every engine id", () => {
    expect(Object.keys(ENGINE_REGISTRY).sort()).toEqual([...ALL_IDS].sort());
  });

  it.each(ALL_IDS)("builds an engine that reports id %s", (id) => {
    const engine = ENGINE_REGISTRY[id]({ legacy: new LegacyInlineMenuFieldQualificationService() });

    expect(engine.id).toBe(id);
    expect(engine.name).toBeTruthy();
    expect(engine.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it.each(ALL_IDS)("dispatches through the full stack for id %s", (id) => {
    // The stack wraps the registry's engine in the memoizer. Identity has to
    // survive that, or nothing downstream can tell which engine is running.
    expect(buildQualificationStack(id).engine.id).toBe(id);
  });

  it("never reaches the engine while the legacy id is selected", () => {
    // The default path must not pay the bridge's eager whole-page pass. The
    // adapter answers from the legacy service instead, which is the same answer
    // the bridge would have computed — see the adapter's class comment.
    const stack = buildQualificationStack(QualificationEngineId.Legacy);
    const classify = jest.spyOn(stack.engine, "classify");
    const { field, pageDetails } = fixture();
    stack.service.enroll?.(pageDetails);

    stack.service.isUsernameField(field);
    stack.service.isFieldForLoginForm(field, pageDetails);

    expect(classify).not.toHaveBeenCalled();
  });

  it("reaches the engine once the stack has swapped off legacy", () => {
    // Selection has to be live in both directions: a stack built at the default
    // and corrected later must actually start routing. The adapter reads
    // `engine.id` per call rather than at construction to make this hold.
    const stack = buildQualificationStack(QualificationEngineId.Legacy);
    const classify = jest.spyOn(stack.engine, "classify");
    const { field, pageDetails } = fixture();
    stack.service.enroll?.(pageDetails);

    stack.swap(QualificationEngineId.Scoring);
    stack.service.isUsernameField(field);

    expect(classify).toHaveBeenCalledWith(pageDetails);
  });
});

describe("resolveEngineId", () => {
  it("falls back to the default when given nothing", () => {
    expect(resolveEngineId()).toBe(DEFAULT_ENGINE_ID);
  });

  it.each(ALL_IDS)("accepts the recognized flag value %s", (id) => {
    expect(resolveEngineId(id)).toBe(id);
  });

  it.each([
    ["an unregistered name", "scoring-v2"],
    ["a typo", "sccoring"],
    ["the empty string", ""],
    ["a boolean", true],
    ["a number", 3],
    ["an object", { id: "scoring" }],
    ["null", null],
  ])("falls back to the default for %s", (_label, value) => {
    // Server flag values are cast without any runtime check, so this is the
    // only thing between a bad value in the flag console and broken autofill.
    expect(resolveEngineId(value)).toBe(DEFAULT_ENGINE_ID);
  });

  it("never throws, whatever it is handed", () => {
    expect(() => resolveEngineId(Symbol("nope"))).not.toThrow();
  });
});

/**
 * A real field and page rather than mocks — both routes run production
 * qualification code, which reads string properties the auto-mocks would fill
 * with functions.
 */
function fixture(): { field: AutofillField; pageDetails: AutofillPageDetails } {
  const field = Object.assign(new AutofillField(), {
    opid: "field-1",
    form: "form-1",
    elementNumber: 0,
    viewable: true,
    type: "text",
    htmlID: "username",
    htmlName: "username",
    htmlClass: null,
    tagName: "input",
    tabindex: null,
    title: null,
  });
  const form = Object.assign(new AutofillForm(), { opid: "form-1" });
  const pageDetails = Object.assign(new AutofillPageDetails(), {
    forms: { "form-1": form },
    fields: [field],
  });
  return { field, pageDetails };
}
