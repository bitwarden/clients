import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { AccessCondition } from "../abstractions/access-rule";

import { ApprovalMethodPipe } from "./approval-method.pipe";

describe("ApprovalMethodPipe", () => {
  let i18nService: ReturnType<typeof mock<I18nService>>;
  let pipe: ApprovalMethodPipe;

  beforeEach(() => {
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => {
      const messages: Record<string, string> = {
        pamAccessRuleConditionRequiresApproval: "Requires approval",
        pamAccessRuleConditionIpRestricted: "IP restricted",
        pamAccessRuleConditionAutoApproved: "Auto-approved",
      };
      return messages[key] ?? key;
    });

    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: i18nService }],
    });
    pipe = TestBed.runInInjectionContext(() => new ApprovalMethodPipe());
  });

  it("renders 'Auto-approved' when there are no conditions", () => {
    expect(pipe.transform([])).toBe("Auto-approved");
  });

  it("renders 'IP restricted' when gated solely by an ip allowlist", () => {
    const conditions = [{ kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }] as AccessCondition[];

    expect(pipe.transform(conditions)).toBe("IP restricted");
  });

  it("renders 'Requires approval, IP restricted' when both conditions are present", () => {
    const conditions = [
      { kind: "human_approval" },
      { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] },
    ] as AccessCondition[];

    expect(pipe.transform(conditions)).toBe("Requires approval, IP restricted");
  });
});
