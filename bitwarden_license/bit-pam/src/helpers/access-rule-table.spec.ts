import { AccessRuleFilter, accessRuleMatchesFilter } from "./access-rule-table";

describe("accessRuleMatchesFilter", () => {
  const rule = (overrides: Partial<{ name: string; enabled: boolean; collections: string[] }>) => ({
    name: "VPN access",
    enabled: true,
    collections: ["col-1"],
    ...overrides,
  });

  const noNames = new Map<string, string>();

  const filter = (overrides: Partial<AccessRuleFilter> = {}): AccessRuleFilter => ({
    text: "",
    status: null,
    collectionIds: [],
    ...overrides,
  });

  it("includes everything under an empty filter", () => {
    expect(accessRuleMatchesFilter(rule({}), new Map([["col-1", "Engineering"]]), filter())).toBe(
      true,
    );
  });

  it("drops disabled rules when filtering to enabled", () => {
    expect(
      accessRuleMatchesFilter(rule({ enabled: false }), noNames, filter({ status: "enabled" })),
    ).toBe(false);
    expect(
      accessRuleMatchesFilter(rule({ enabled: true }), noNames, filter({ status: "enabled" })),
    ).toBe(true);
  });

  it("drops enabled rules when filtering to disabled", () => {
    expect(
      accessRuleMatchesFilter(rule({ enabled: true }), noNames, filter({ status: "disabled" })),
    ).toBe(false);
  });

  it("filters by collection membership", () => {
    expect(
      accessRuleMatchesFilter(
        rule({ collections: ["col-1"] }),
        noNames,
        filter({ collectionIds: ["col-2"] }),
      ),
    ).toBe(false);
    expect(
      accessRuleMatchesFilter(
        rule({ collections: ["col-2"] }),
        noNames,
        filter({ collectionIds: ["col-2"] }),
      ),
    ).toBe(true);
  });

  it("matches a rule carrying any of several selected collections", () => {
    expect(
      accessRuleMatchesFilter(
        rule({ collections: ["col-3"] }),
        noNames,
        filter({ collectionIds: ["col-2", "col-3"] }),
      ),
    ).toBe(true);
    expect(
      accessRuleMatchesFilter(
        rule({ collections: ["col-1"] }),
        noNames,
        filter({ collectionIds: ["col-2", "col-3"] }),
      ),
    ).toBe(false);
  });

  it("matches search text against the rule name", () => {
    expect(
      accessRuleMatchesFilter(rule({ name: "VPN access" }), noNames, filter({ text: "vpn" })),
    ).toBe(true);
    expect(
      accessRuleMatchesFilter(rule({ name: "VPN access" }), noNames, filter({ text: "ssh" })),
    ).toBe(false);
  });

  it("matches search text against resolved collection names", () => {
    const names = new Map([["col-1", "Engineering"]]);
    expect(accessRuleMatchesFilter(rule({}), names, filter({ text: "engineer" }))).toBe(true);
  });

  it("matches search text against the id of a collection it can't name", () => {
    expect(accessRuleMatchesFilter(rule({}), noNames, filter({ text: "col-1" }))).toBe(true);
  });
});
