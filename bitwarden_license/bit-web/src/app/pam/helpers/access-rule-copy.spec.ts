import type { AccessRuleView } from "../abstractions/access-rule";

import { accessRuleToCopyRequest, copyRuleName } from "./access-rule-copy";
import { ACCESS_RULE_NAME_MAX_LENGTH } from "./access-rule-request";

/** Stands in for the i18n service, rendering the two copy-name templates as `en` words them. */
const t = (key: string, name: string, count?: number): string =>
  key === "pamAccessRuleDuplicateNameNumbered" ? `${name} (copy ${count})` : `${name} (copy)`;

describe("copyRuleName", () => {
  it("suffixes the source name when nothing takes it", () => {
    expect(copyRuleName("VPN", ["VPN"], t)).toBe("VPN (copy)");
  });

  it("numbers from 2 once the plain suffix is taken", () => {
    expect(copyRuleName("VPN", ["VPN", "VPN (copy)"], t)).toBe("VPN (copy 2)");
  });

  it("skips every number already in use", () => {
    const taken = ["VPN", "VPN (copy)", "VPN (copy 2)", "VPN (copy 3)"];

    expect(copyRuleName("VPN", taken, t)).toBe("VPN (copy 4)");
  });

  it("matches taken names case-insensitively, as the server does", () => {
    expect(copyRuleName("VPN", ["vpn (COPY)"], t)).toBe("VPN (copy 2)");
  });

  it("does not renumber around a gap it does not need", () => {
    // "VPN (copy 2)" is free, so the numbering stops there rather than walking past the 3.
    expect(copyRuleName("VPN", ["VPN (copy)", "VPN (copy 3)"], t)).toBe("VPN (copy 2)");
  });

  describe("the server's limits", () => {
    it("keeps the name within the column width by trimming the base, not the suffix", () => {
      const long = "V".repeat(ACCESS_RULE_NAME_MAX_LENGTH);

      const name = copyRuleName(long, [], t);

      expect(name).toHaveLength(ACCESS_RULE_NAME_MAX_LENGTH);
      expect(name.endsWith(" (copy)")).toBe(true);
    });

    it("keeps a numbered name within the column width too", () => {
      const long = "V".repeat(ACCESS_RULE_NAME_MAX_LENGTH);
      const taken = [`${"V".repeat(ACCESS_RULE_NAME_MAX_LENGTH - 7)} (copy)`];

      const name = copyRuleName(long, taken, t);

      expect(name).toHaveLength(ACCESS_RULE_NAME_MAX_LENGTH);
      expect(name.endsWith(" (copy 2)")).toBe(true);
    });

    it("gives up rather than spinning when a locale renders every candidate the same", () => {
      // A translation that dropped $NUMBER$ makes each numbered candidate identical, so no
      // amount of counting finds a free one. Terminating and letting the server reject the
      // duplicate is the only outcome that is not a frozen tab.
      const degenerate = (_key: string, name: string) => `${name} (copy)`;

      expect(copyRuleName("VPN", ["VPN (copy)", "other"], degenerate)).toBe("VPN (copy)");
    });
  });
});

describe("accessRuleToCopyRequest", () => {
  const source = {
    id: "rule-1",
    organizationId: "org-1",
    name: "VPN",
    description: "Business hours only",
    enabled: true,
    conditions: [{ kind: "human_approval" }, { kind: "time_of_day" }],
    singleActiveLease: true,
    defaultLeaseDurationSeconds: 3600,
    maxLeaseDurationSeconds: 7200,
    allowsExtensions: true,
    maxExtensionDurationSeconds: 1800,
    collections: ["collection-1", "collection-2"],
    creationDate: "2026-01-01T00:00:00Z",
    revisionDate: "2026-01-02T00:00:00Z",
  } as unknown as AccessRuleView;

  it("renames, drops the collections, and carries every other field over unchanged", () => {
    expect(accessRuleToCopyRequest(source, "VPN (copy)")).toEqual({
      name: "VPN (copy)",
      description: "Business hours only",
      enabled: true,
      conditions: [{ kind: "human_approval" }, { kind: "time_of_day" }],
      singleActiveLease: true,
      defaultLeaseDurationSeconds: 3600,
      maxLeaseDurationSeconds: 7200,
      allowsExtensions: true,
      maxExtensionDurationSeconds: 1800,
      collections: [],
    });
  });

  it("inherits a disabled source's state rather than forcing one", () => {
    expect(accessRuleToCopyRequest({ ...source, enabled: false }, "x").enabled).toBe(false);
  });
});
