import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { RemoveUnlockWithPinPolicy } from "./remove-unlock-with-pin.component";
import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";

describe("RemoveUnlockWithPinPolicy", () => {
  const policy = new RemoveUnlockWithPinPolicy();

  it("should have correct attributes", () => {
    expect(policy.name).toEqual("removeUnlockWithPinPolicyTitle");
    expect(policy.description).toEqual("removeUnlockWithPinPolicyDescV2");
    expect(policy.type).toEqual(PolicyType.RemoveUnlockWithPin);
    expect(policy.component).toEqual(SimpleTogglePolicyComponent);
  });
});
