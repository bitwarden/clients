import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

import { unlicensedForPam } from "./pam-membership";

function organization(overrides: Partial<Organization> = {}): Organization {
  return Object.assign(new Organization(), {
    id: "org-1",
    enabled: true,
    isProviderUser: false,
    ...overrides,
  });
}

describe("unlicensedForPam", () => {
  it("blocks a seatless member of a subscribed organization", () => {
    expect(unlicensedForPam(organization({ usePam: true, accessPam: false }))).toBe(true);
  });

  it.each([
    ["the member holds a seat", { usePam: true, accessPam: true }],
    ["the organization never bought PAM", { usePam: false, accessPam: false }],
    ["the organization is disabled", { usePam: true, accessPam: false, enabled: false }],
    ["the caller is a provider user", { usePam: true, accessPam: false, isProviderUser: true }],
    ["accessPam has not been synced yet", { usePam: true }],
  ])("states no verdict when %s", (_case, overrides: Partial<Organization>) => {
    expect(unlicensedForPam(organization(overrides))).toBe(false);
  });

  it("states no verdict for a membership the caller has no record of", () => {
    expect(unlicensedForPam(undefined)).toBe(false);
  });
});
