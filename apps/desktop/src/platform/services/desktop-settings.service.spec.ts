import { firstValueFrom } from "rxjs";

import { DESKTOP_SETTINGS_DISK, KeyDefinition } from "@bitwarden/common/platform/state";
import { FakeAccountService, FakeStateProvider } from "@bitwarden/common/spec";

import { DesktopSettingsService } from "./desktop-settings.service";

// Same storage key as the service's private definition; the fake provider caches by full name,
// so this reaches the same fake state the service reads.
const LIFETIME_KEY = new KeyDefinition<unknown>(
  DESKTOP_SETTINGS_DISK,
  "agentAccessOpenShellApprovalLifetime",
  { deserializer: (v) => v },
);

describe("DesktopSettingsService — Agent Access OpenShell settings (§M8.6)", () => {
  let stateProvider: FakeStateProvider;
  let service: DesktopSettingsService;

  beforeEach(() => {
    stateProvider = new FakeStateProvider(new FakeAccountService({}));
    service = new DesktopSettingsService(stateProvider);
  });

  it("defaults the OpenShell integration to off", async () => {
    expect(await firstValueFrom(service.agentAccessOpenShellEnabled$)).toBe(false);
  });

  it("persists the enabled flag", async () => {
    await service.setAgentAccessOpenShellEnabled(true);
    expect(await firstValueFrom(service.agentAccessOpenShellEnabled$)).toBe(true);
    await service.setAgentAccessOpenShellEnabled(false);
    expect(await firstValueFrom(service.agentAccessOpenShellEnabled$)).toBe(false);
  });

  it("defaults the approval lifetime to a 60 minute ttl", async () => {
    expect(await firstValueFrom(service.agentAccessOpenShellApprovalLifetime$)).toEqual({
      mode: "ttl",
      ttlMinutes: 60,
    });
  });

  it("persists a valid lifetime", async () => {
    await service.setAgentAccessOpenShellApprovalLifetime({
      mode: "sandboxLifetime",
      ttlMinutes: 240,
    });
    expect(await firstValueFrom(service.agentAccessOpenShellApprovalLifetime$)).toEqual({
      mode: "sandboxLifetime",
      ttlMinutes: 240,
    });
  });

  it.each([
    [{ mode: "forever", ttlMinutes: 60 }],
    [{ mode: "ttl", ttlMinutes: 61 }],
    [{ mode: "ttl" }],
    ["ttl"],
    [42],
  ])("coerces an invalid persisted lifetime %j to the default", async (persisted) => {
    stateProvider.global.getFake(LIFETIME_KEY).nextState(persisted);
    expect(await firstValueFrom(service.agentAccessOpenShellApprovalLifetime$)).toEqual({
      mode: "ttl",
      ttlMinutes: 60,
    });
  });

  it("coerces invalid input on write", async () => {
    await service.setAgentAccessOpenShellApprovalLifetime({ mode: "bogus", ttlMinutes: 5 } as any);
    expect(await firstValueFrom(service.agentAccessOpenShellApprovalLifetime$)).toEqual({
      mode: "ttl",
      ttlMinutes: 60,
    });
  });
});
