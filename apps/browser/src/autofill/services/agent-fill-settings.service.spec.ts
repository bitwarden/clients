import { firstValueFrom } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { AgentFillSettingsService } from "./agent-fill-settings.service";

describe("AgentFillSettingsService (prototype)", () => {
  const userId = "user-1" as UserId;
  const otherUserId = "user-2" as UserId;
  let service: AgentFillSettingsService;

  beforeEach(() => {
    service = new AgentFillSettingsService(new FakeStateProvider(mockAccountServiceWith(userId)));
  });

  it("is off by default", async () => {
    expect(await firstValueFrom(service.agentFillAllowed$(userId))).toBe(false);
  });

  it("is stored per account", async () => {
    await service.setAgentFillAllowed(true, userId);

    expect(await firstValueFrom(service.agentFillAllowed$(userId))).toBe(true);
    expect(await firstValueFrom(service.agentFillAllowed$(otherUserId))).toBe(false);
  });
});
