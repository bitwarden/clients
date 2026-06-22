import { AccessCondition } from "../../abstractions/access-rule";
import { AccessRuleResponse } from "../../abstractions/responses/access-rule.response";

import { AccessRuleRequest, accessRuleToRequest } from "./access-rule.request";

describe("AccessRuleRequest", () => {
  it("sends a single condition as a flat array", () => {
    const req = new AccessRuleRequest({
      name: "Human approval",
      conditions: [{ kind: "human_approval" }],
    });

    expect(req.conditions).toEqual([{ kind: "human_approval" }]);
  });

  it("keeps multiple conditions as a flat array, with no `all_of` wrapper", () => {
    const conditions: AccessCondition[] = [
      { kind: "human_approval" },
      { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] },
    ];

    const req = new AccessRuleRequest({ name: "Approval + IP", conditions });

    expect(req.conditions).toEqual([
      { kind: "human_approval" },
      { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] },
    ]);
  });

  it("drops UI-only approvers from a human_approval condition", () => {
    const req = new AccessRuleRequest({
      name: "Human approval",
      conditions: [{ kind: "human_approval", approvers: { mode: "collection_managers" } }],
    });

    expect(req.conditions).toEqual([{ kind: "human_approval" }]);
  });

  it("serializes zero conditions as an empty array", () => {
    const req = new AccessRuleRequest({ name: "No gate", conditions: [] });

    expect(req.conditions).toEqual([]);
  });

  it("round-trips a response's conditions back into a request", () => {
    const response = new AccessRuleResponse({
      Id: "pol-1",
      OrganizationId: "org-1",
      Name: "Approval + IP",
      Conditions: [{ kind: "human_approval" }, { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }],
      Collections: ["col-1"],
      Enabled: true,
    });

    const req = accessRuleToRequest(response, false);

    expect(req.enabled).toBe(false);
    expect(req.conditions).toEqual([
      { kind: "human_approval" },
      { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] },
    ]);
    expect(req.collections).toEqual(["col-1"]);
  });
});
