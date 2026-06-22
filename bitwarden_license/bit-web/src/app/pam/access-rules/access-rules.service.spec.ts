import { TestBed } from "@angular/core/testing";
import { firstValueFrom, of } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { AccessRuleResponse, PamApiService } from "@bitwarden/pam";

import { AccessRulesService } from "./access-rules.service";

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

function rule(
  id: string,
  { enabled = true, name = "Rule", collections = [] as string[] } = {},
): AccessRuleResponse {
  return new AccessRuleResponse({
    Id: id,
    OrganizationId: "org-1",
    Name: name,
    Enabled: enabled,
    Collections: collections,
    Conditions: [],
    SingleActiveLease: false,
    CreationDate: "2024-01-01T00:00:00.000Z",
    RevisionDate: "2024-01-01T00:00:00.000Z",
  });
}

describe("AccessRulesService", () => {
  let service: AccessRulesService;
  let pamApi: {
    listAccessRules: jest.Mock;
    updateAccessRule: jest.Mock;
    deleteAccessRule: jest.Mock;
  };

  const setup = (cols: { id: string; name: string }[] = []) => {
    pamApi = {
      listAccessRules: jest.fn().mockResolvedValue({ data: [] }),
      updateAccessRule: jest.fn(),
      deleteAccessRule: jest.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        AccessRulesService,
        { provide: PamApiService, useValue: pamApi },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: CollectionAdminService, useValue: { collectionAdminViews$: () => of(cols) } },
        { provide: I18nService, useValue: i18nFake },
      ],
    });

    service = TestBed.inject(AccessRulesService);
  };

  const currentRuleIds = async () => (await firstValueFrom(service.rules$)).map((r) => r.id);

  describe("load", () => {
    it("populates rules + collection names and clears loading", async () => {
      setup([{ id: "col-1", name: "Engineering" }]);
      pamApi.listAccessRules.mockResolvedValue({
        data: [rule("rule-1", { collections: ["col-1"] })],
      });

      await service.load("org-1" as never);

      expect(await currentRuleIds()).toEqual(["rule-1"]);
      expect(await firstValueFrom(service.collectionNameById$)).toEqual(
        new Map([["col-1", "Engineering"]]),
      );
      expect(await firstValueFrom(service.loading$)).toBe(false);
    });

    it("projects rules into rows with resolved collection names", async () => {
      setup([{ id: "col-1", name: "Engineering" }]);
      pamApi.listAccessRules.mockResolvedValue({
        data: [rule("rule-1", { name: "VPN", collections: ["col-1"] })],
      });

      await service.load("org-1" as never);

      const rows = await firstValueFrom(service.rows$);
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("VPN");
      expect(rows[0].collectionNames).toEqual(["Engineering"]);
    });
  });

  describe("getRule", () => {
    it("returns the loaded rule by id, or undefined", async () => {
      setup();
      pamApi.listAccessRules.mockResolvedValue({ data: [rule("rule-1")] });
      await service.load("org-1" as never);

      expect(service.getRule("rule-1")?.id).toBe("rule-1");
      expect(service.getRule("missing")).toBeUndefined();
    });
  });

  describe("setEnabled", () => {
    it("round-trips the rule with the new flag and patches state", async () => {
      setup();
      pamApi.listAccessRules.mockResolvedValue({ data: [rule("rule-1", { enabled: true })] });
      await service.load("org-1" as never);
      pamApi.updateAccessRule.mockResolvedValue(rule("rule-1", { enabled: false }));

      await service.setEnabled(rule("rule-1", { enabled: true }), false);

      const [, id, request] = pamApi.updateAccessRule.mock.calls[0];
      expect(id).toBe("rule-1");
      expect(request.enabled).toBe(false);
      const rules = await firstValueFrom(service.rules$);
      expect(rules[0].enabled).toBe(false);
    });
  });

  describe("setManyEnabled", () => {
    it("skips rules already in the target state and returns the changed count", async () => {
      setup();
      const rules = [rule("rule-1", { enabled: false }), rule("rule-2", { enabled: true })];
      pamApi.listAccessRules.mockResolvedValue({ data: rules });
      await service.load("org-1" as never);
      pamApi.updateAccessRule.mockImplementation((_org, id) => rule(id, { enabled: true }));

      const changed = await service.setManyEnabled(rules, true);

      // Only rule-1 needed enabling.
      expect(changed).toBe(1);
      expect(pamApi.updateAccessRule).toHaveBeenCalledTimes(1);
    });

    it("returns 0 and makes no calls when nothing needs changing", async () => {
      setup();
      const rules = [rule("rule-1", { enabled: true })];
      pamApi.listAccessRules.mockResolvedValue({ data: rules });
      await service.load("org-1" as never);

      const changed = await service.setManyEnabled(rules, true);

      expect(changed).toBe(0);
      expect(pamApi.updateAccessRule).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("removes the rule from state", async () => {
      setup();
      pamApi.listAccessRules.mockResolvedValue({ data: [rule("rule-1"), rule("rule-2")] });
      await service.load("org-1" as never);

      await service.delete(rule("rule-1"));

      expect(await currentRuleIds()).toEqual(["rule-2"]);
    });
  });

  describe("deleteMany", () => {
    it("removes all given rules from state", async () => {
      setup();
      pamApi.listAccessRules.mockResolvedValue({
        data: [rule("rule-1"), rule("rule-2"), rule("rule-3")],
      });
      await service.load("org-1" as never);

      await service.deleteMany([rule("rule-1"), rule("rule-3")]);

      expect(await currentRuleIds()).toEqual(["rule-2"]);
    });
  });
});
