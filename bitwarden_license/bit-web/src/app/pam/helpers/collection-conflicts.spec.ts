import type { AccessRuleId, AccessRuleView } from "../abstractions/access-rule";

import { conflictingCollectionIds } from "./collection-conflicts";

const rule = (id: string, collections: string[], enabled = true) =>
  ({ id, collections, enabled }) as unknown as AccessRuleView;

const ruleId = (id: string) => id as unknown as AccessRuleId;

describe("conflictingCollectionIds", () => {
  it("picks out the selected collection another rule governs", () => {
    const conflicts = conflictingCollectionIds([rule("rule-1", ["col-1"])], ["col-1", "col-2"]);

    expect(conflicts).toEqual(["col-1"]);
  });

  it("reports nothing when no rule governs the selection", () => {
    const conflicts = conflictingCollectionIds([rule("rule-1", ["col-9"])], ["col-1"]);

    expect(conflicts).toEqual([]);
  });

  it("counts a disabled rule, which the server's check does not exempt", () => {
    const conflicts = conflictingCollectionIds([rule("rule-1", ["col-1"], false)], ["col-1"]);

    expect(conflicts).toEqual(["col-1"]);
  });

  it("excludes the rule being edited, whose own collections are not a conflict", () => {
    const conflicts = conflictingCollectionIds(
      [rule("rule-1", ["col-1"])],
      ["col-1"],
      ruleId("rule-1"),
    );

    expect(conflicts).toEqual([]);
  });

  it("reports every conflicting collection, not just the first", () => {
    const conflicts = conflictingCollectionIds(
      [rule("rule-1", ["col-1"]), rule("rule-2", ["col-3"])],
      ["col-1", "col-2", "col-3"],
    );

    expect(conflicts).toEqual(["col-1", "col-3"]);
  });
});
