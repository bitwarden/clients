import { mock } from "jest-mock-extended";

import { SharedUnlockPeerService } from "@bitwarden/common/key-management/shared-unlock";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { CliSharedUnlockService } from "./cli-shared-unlock.service";

describe("CliSharedUnlockService", () => {
  const sharedUnlockPeerService = mock<SharedUnlockPeerService>();
  const configService = mock<ConfigService>();
  const logService = mock<LogService>();

  let service: CliSharedUnlockService;

  beforeEach(() => {
    jest.clearAllMocks();
    configService.getFeatureFlag.mockResolvedValue(true as never);
    sharedUnlockPeerService.start.mockResolvedValue(undefined);

    service = new CliSharedUnlockService(sharedUnlockPeerService, configService, logService);
  });

  it("starts the peer and reports it running", async () => {
    await expect(service.start()).resolves.toBe(true);
    expect(sharedUnlockPeerService.start).toHaveBeenCalled();
  });

  it("starts no peer when the feature flag is off", async () => {
    configService.getFeatureFlag.mockResolvedValue(false as never);

    await expect(service.start()).resolves.toBe(false);
    expect(sharedUnlockPeerService.start).not.toHaveBeenCalled();
  });

  it("reports a peer that cannot start, rather than throwing", async () => {
    sharedUnlockPeerService.start.mockRejectedValue(new Error("no desktop proxy"));

    await expect(service.start()).resolves.toBe(false);
    await expect(service.start()).resolves.toBe(false);
  });

  it("starts at most one peer per invocation", async () => {
    await Promise.all([service.start(), service.start()]);
    await service.start();

    expect(sharedUnlockPeerService.start).toHaveBeenCalledTimes(1);
  });
});
