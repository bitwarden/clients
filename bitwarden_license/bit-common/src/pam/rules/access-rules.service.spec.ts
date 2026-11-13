import { mock, mockReset } from "jest-mock-extended";

import type {
  AccessRuleAddEditRequest,
  AccessRuleView,
  AccessRulesClient,
} from "@bitwarden/sdk-internal";

import {
  createPamSdkTestKit,
  PAM_TEST_ORGANIZATION_ID,
  PAM_TEST_USER_ID,
} from "../shared/testing/pam-test-helpers";

import { AccessRulesService, findGovernedCollections } from "./access-rules.service";

const RULE_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_RULE_ID = "55555555-5555-4555-8555-555555555555";
const C1 = "33333333-3333-4333-8333-333333333333";
const C2 = "66666666-6666-4666-8666-666666666666";

const view = (overrides: Partial<AccessRuleView> = {}): AccessRuleView =>
  ({ id: RULE_ID, enabled: true, collections: [], ...overrides }) as unknown as AccessRuleView;
const request = (collections: string[]) =>
  ({ name: "r", collections }) as unknown as AccessRuleAddEditRequest;

describe("AccessRulesService", () => {
  const kit = createPamSdkTestKit();
  const client = mock<AccessRulesClient>();
  const service = new AccessRulesService(kit.pamSdkService);
  const org = PAM_TEST_ORGANIZATION_ID;
  const user = PAM_TEST_USER_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReset(client);
    kit.pam.access_rules.mockReturnValue(client);
  });

  it("refuses a collection another rule governs, and does not create", async () => {
    client.list.mockResolvedValue([
      view({ id: OTHER_RULE_ID as never, collections: [C1 as never] }),
    ]);
    await expect(service.create(user, org, request([C1]))).rejects.toThrow(/already governed/);
    expect(client.create).not.toHaveBeenCalled();
  });

  it("lets the server decide when the list cannot be read", async () => {
    client.list.mockRejectedValue(new Error("boom"));
    client.create.mockResolvedValue(view());
    await service.create(user, org, request([C1]));
    expect(client.create).toHaveBeenCalled();
  });

  describe("update", () => {
    const ALLOWLIST = { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] };
    const current = (overrides: Partial<AccessRuleView> = {}) =>
      view({
        name: "r",
        enabled: true,
        collections: [C1 as never],
        conditions: [{ kind: "human_approval" }, ALLOWLIST] as never,
        singleActiveLease: false,
        allowsExtensions: false,
        ...overrides,
      });
    const next = (overrides: Record<string, unknown> = {}) =>
      ({
        name: "r",
        enabled: true,
        collections: [C1],
        conditions: [{ kind: "human_approval" }, ALLOWLIST],
        singleActiveLease: false,
        allowsExtensions: false,
        ...overrides,
      }) as unknown as AccessRuleAddEditRequest;

    beforeEach(() => {
      client.list.mockResolvedValue([]);
      client.update.mockResolvedValue(view());
      client.bypassable_ciphers.mockResolvedValue([]);
    });

    it("skips the rule being updated in the conflict check, then reads bypass paths", async () => {
      client.get.mockResolvedValue(current());
      client.list.mockResolvedValue([view({ collections: [C1 as never] })]);
      client.bypassable_ciphers.mockResolvedValue([C2 as never]);
      const result = await service.update(user, org, RULE_ID, next({ name: "renamed" }), false);
      expect(result).toMatchObject({ changed: true, bypassable: [C2], ungoverned: [] });
    });

    it("keeps a landed update when the bypass read fails", async () => {
      client.get.mockResolvedValue(current());
      client.bypassable_ciphers.mockRejectedValue(new Error("x"));
      const result = await service.update(user, org, RULE_ID, next({ name: "n" }), false);
      expect(result).toMatchObject({ changed: true, bypassable: undefined });
    });

    it("writes nothing and reports unchanged for an identical request", async () => {
      client.get.mockResolvedValue(current());
      const result = await service.update(user, org, RULE_ID, next(), false);
      expect(result).toMatchObject({ changed: false });
      expect(client.update).not.toHaveBeenCalled();
    });

    it.each([
      ["disables the rule", { enabled: false }],
      ["removes 1 collection(s)", { collections: [] }],
      ["removes or loosens a condition", { conditions: [{ kind: "human_approval" }] }],
      ["removes or loosens a condition", { conditions: [ALLOWLIST] }],
      [
        "removes or loosens a condition",
        {
          conditions: [
            { kind: "human_approval" },
            { kind: "ip_allowlist", cidrs: ["10.0.0.0/8", "0.0.0.0/0"] },
          ],
        },
      ],
    ])("needs confirmation when it %s, and writes nothing", async (reason, change) => {
      client.get.mockResolvedValue(current());
      const result = await service.update(user, org, RULE_ID, next(change), false);
      expect(result).toMatchObject({
        needsConfirmation: { weakenings: [expect.stringContaining(reason)] },
      });
      expect(client.update).not.toHaveBeenCalled();
    });

    it("lists the removed collections as ungoverned, and all of them when it disables", async () => {
      client.get.mockResolvedValue(current({ collections: [C1 as never, C2 as never] }));
      const removed = await service.update(user, org, RULE_ID, next({ collections: [C2] }), false);
      expect(removed).toMatchObject({ needsConfirmation: { ungoverned: [C1] } });
      const disabled = await service.update(
        user,
        org,
        RULE_ID,
        next({ enabled: false, collections: [C1, C2] }),
        false,
      );
      expect(disabled).toMatchObject({ needsConfirmation: { ungoverned: [C1, C2] } });
    });

    it("writes a weakening update when confirmed, and reports what it ungoverned", async () => {
      client.get.mockResolvedValue(current());
      const result = await service.update(user, org, RULE_ID, next({ collections: [] }), true);
      expect(client.update).toHaveBeenCalled();
      expect(result).toMatchObject({ changed: true, ungoverned: [C1] });
    });

    it("lets a non-weakening change through without confirmation", async () => {
      client.get.mockResolvedValue(current({ collections: [] }));
      const result = await service.update(
        user,
        org,
        RULE_ID,
        next({
          collections: [C2],
          conditions: [
            { kind: "human_approval" },
            ALLOWLIST,
            { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] },
          ],
          singleActiveLease: true,
        }),
        false,
      );
      expect(result).toMatchObject({ changed: true });
      expect(client.update).toHaveBeenCalled();
    });

    it("refuses a collection another rule governs before asking for confirmation", async () => {
      client.get.mockResolvedValue(current());
      client.list.mockResolvedValue([
        view({ id: OTHER_RULE_ID as never, collections: [C2 as never] }),
      ]);
      await expect(
        service.update(user, org, RULE_ID, next({ enabled: false, collections: [C2] }), false),
      ).rejects.toThrow(/already governed/);
    });
  });

  it("disables via set_enabled after a get and reports bypass paths", async () => {
    const current = view({ enabled: true });
    client.get.mockResolvedValue(current);
    client.set_enabled.mockResolvedValue(view({ enabled: false }));
    client.bypassable_ciphers.mockResolvedValue([C1 as never]);
    const result = await service.disable(user, org, RULE_ID);
    expect(client.set_enabled).toHaveBeenCalledWith(org, current, false);
    expect(result).toMatchObject({ changed: true, bypassable: [C1] });
  });

  it("writes nothing when the rule is already in the requested state", async () => {
    client.get.mockResolvedValue(view({ enabled: false }));
    expect((await service.disable(user, org, RULE_ID)).changed).toBe(false);
    client.get.mockResolvedValue(view({ enabled: true }));
    await service.enable(user, org, RULE_ID);
    expect(client.set_enabled).not.toHaveBeenCalled();
  });

  it("reads bypass paths before it deletes", async () => {
    const order: string[] = [];
    client.get.mockResolvedValue(view({ collections: [C1 as never] }));
    client.bypassable_ciphers.mockImplementation(async () => {
      order.push("bypassable");
      return [C2 as never];
    });
    client.delete.mockImplementation(async () => {
      order.push("delete");
    });
    const result = await service.delete(user, org, RULE_ID);
    expect(order).toEqual(["bypassable", "delete"]);
    expect(result).toEqual({ bypassable: [C2], ungoverned: [C1] });
  });

  it("rejects non-GUID ids before any call", async () => {
    await expect(service.get(user, org, "nope")).rejects.toThrow(/valid rule id/);
    expect(client.get).not.toHaveBeenCalled();
  });
});

describe("findGovernedCollections", () => {
  it("matches case-insensitively and excepts one rule", () => {
    const rules = [view({ collections: [C1.toUpperCase() as never] })];
    expect(findGovernedCollections(rules, [C1])).toEqual([[C1, RULE_ID]]);
    expect(findGovernedCollections(rules, [C1], RULE_ID)).toEqual([]);
  });
});
