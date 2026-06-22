import { AccessRuleResponse } from "../abstractions/responses/access-rule.response";

import { AccessRuleFilter, accessRuleMatchesFilter, accessRuleWindow } from "./access-rule-table";
import { formatDurationShort } from "./lease-window.utils";

const ONE_HOUR = 60 * 60;
const FOUR_HOURS = 4 * 60 * 60;

describe("accessRuleWindow", () => {
  it("returns null when there is no default duration", () => {
    expect(
      accessRuleWindow({ defaultLeaseDurationSeconds: null, maxLeaseDurationSeconds: null }),
    ).toBeNull();
  });

  it("returns the default alone when there is no cap", () => {
    expect(
      accessRuleWindow({ defaultLeaseDurationSeconds: ONE_HOUR, maxLeaseDurationSeconds: null }),
    ).toBe(formatDurationShort(ONE_HOUR));
  });

  it("returns the default alone when the cap equals the default", () => {
    expect(
      accessRuleWindow({
        defaultLeaseDurationSeconds: ONE_HOUR,
        maxLeaseDurationSeconds: ONE_HOUR,
      }),
    ).toBe(formatDurationShort(ONE_HOUR));
  });

  it("returns a default–max range when a distinct cap is set", () => {
    expect(
      accessRuleWindow({
        defaultLeaseDurationSeconds: ONE_HOUR,
        maxLeaseDurationSeconds: FOUR_HOURS,
      }),
    ).toBe(`${formatDurationShort(ONE_HOUR)}–${formatDurationShort(FOUR_HOURS)}`);
  });
});

describe("accessRuleMatchesFilter", () => {
  const rule = (
    overrides: Partial<Pick<AccessRuleResponse, "name" | "enabled" | "collections">>,
  ) => ({
    name: "VPN access",
    enabled: true,
    collections: ["col-1"],
    ...overrides,
  });

  const filter = (overrides: Partial<AccessRuleFilter> = {}): AccessRuleFilter => ({
    text: "",
    status: null,
    collectionId: null,
    ...overrides,
  });

  it("includes everything under an empty filter", () => {
    expect(accessRuleMatchesFilter(rule({}), ["Engineering"], filter())).toBe(true);
  });

  it("drops disabled rules when filtering to enabled", () => {
    expect(
      accessRuleMatchesFilter(rule({ enabled: false }), [], filter({ status: "enabled" })),
    ).toBe(false);
    expect(
      accessRuleMatchesFilter(rule({ enabled: true }), [], filter({ status: "enabled" })),
    ).toBe(true);
  });

  it("drops enabled rules when filtering to disabled", () => {
    expect(
      accessRuleMatchesFilter(rule({ enabled: true }), [], filter({ status: "disabled" })),
    ).toBe(false);
  });

  it("filters by collection membership", () => {
    expect(
      accessRuleMatchesFilter(
        rule({ collections: ["col-1"] }),
        [],
        filter({ collectionId: "col-2" }),
      ),
    ).toBe(false);
    expect(
      accessRuleMatchesFilter(
        rule({ collections: ["col-2"] }),
        [],
        filter({ collectionId: "col-2" }),
      ),
    ).toBe(true);
  });

  it("matches search text against the rule name", () => {
    expect(accessRuleMatchesFilter(rule({ name: "VPN access" }), [], filter({ text: "vpn" }))).toBe(
      true,
    );
    expect(accessRuleMatchesFilter(rule({ name: "VPN access" }), [], filter({ text: "ssh" }))).toBe(
      false,
    );
  });

  it("matches search text against resolved collection names", () => {
    expect(accessRuleMatchesFilter(rule({}), ["Engineering"], filter({ text: "engineer" }))).toBe(
      true,
    );
  });
});
