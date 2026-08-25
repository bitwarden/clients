import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";
import { SingleOrgPolicy } from "./single-org.component";

describe("SingleOrgPolicy", () => {
  const policy = new SingleOrgPolicy();

  it("should have correct attributes", () => {
    expect(policy.name).toBe("singleOrg");
    expect(policy.description).toBe("singleOrgPolicyDescV2");
    expect(policy.warningKey).toBe("singleOrgPolicyMemberWarning");
    expect(policy.type).toBe(PolicyType.SingleOrg);
    expect(policy.component).toBe(SimpleTogglePolicyComponent);
  });
});
