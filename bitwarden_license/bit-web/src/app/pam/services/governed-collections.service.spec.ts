import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import type { AccessRuleView } from "../abstractions/access-rule";
import { AccessRuleSdkService } from "../abstractions/access-rule-sdk.service";

import { GovernedCollectionsService } from "./governed-collections.service";

const ORG_ID = "org-1" as OrganizationId;
const RULES = [{ id: "rule-1", enabled: true, collections: [] }] as unknown as AccessRuleView[];

describe("GovernedCollectionsService", () => {
  let accessRules: MockProxy<AccessRuleSdkService>;
  let logService: MockProxy<LogService>;
  let service: GovernedCollectionsService;

  beforeEach(() => {
    jest.useFakeTimers();
    accessRules = mock<AccessRuleSdkService>();
    logService = mock<LogService>();
    service = new GovernedCollectionsService(accessRules, logService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves the organization's rules", async () => {
    accessRules.listAccessRules.mockResolvedValue(RULES);

    await expect(firstValueFrom(service.rules$(ORG_ID))).resolves.toEqual(RULES);
  });

  it("shares one read across subscribers (one per table, not one per row)", async () => {
    accessRules.listAccessRules.mockResolvedValue(RULES);

    const rules$ = service.rules$(ORG_ID);
    rules$.subscribe();
    rules$.subscribe();
    await firstValueFrom(rules$);

    expect(accessRules.listAccessRules).toHaveBeenCalledTimes(1);
  });

  it("keeps serving the cached read across subscription churn within the TTL", async () => {
    accessRules.listAccessRules.mockResolvedValue(RULES);

    // firstValueFrom completes its subscription each time — the scroll-churn case.
    await firstValueFrom(service.rules$(ORG_ID));
    await firstValueFrom(service.rules$(ORG_ID));

    expect(accessRules.listAccessRules).toHaveBeenCalledTimes(1);
  });

  it("re-reads once the TTL has lapsed, so a revisit isn't stale", async () => {
    accessRules.listAccessRules.mockResolvedValue(RULES);

    await firstValueFrom(service.rules$(ORG_ID));
    jest.advanceTimersByTime(30_001); // modern fake timers advance Date.now too
    await firstValueFrom(service.rules$(ORG_ID));

    expect(accessRules.listAccessRules).toHaveBeenCalledTimes(2);
  });

  it("caches per organization, not globally", async () => {
    accessRules.listAccessRules.mockResolvedValue([]);

    await Promise.all([
      firstValueFrom(service.rules$(ORG_ID)),
      firstValueFrom(service.rules$("org-2" as OrganizationId)),
    ]);

    expect(accessRules.listAccessRules).toHaveBeenCalledWith(ORG_ID);
    expect(accessRules.listAccessRules).toHaveBeenCalledWith("org-2");
  });

  it("resolves to no rules when the read fails, and logs the error", async () => {
    accessRules.listAccessRules.mockRejectedValue(new Error("boom"));

    await expect(firstValueFrom(service.rules$(ORG_ID))).resolves.toEqual([]);
    expect(logService.error).toHaveBeenCalled();
  });
});
