import { firstValueFrom } from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { CipherId, UserId } from "@bitwarden/common/types/guid";

import { SshAgentDestinationsService } from "./ssh-agent-destinations.service";

describe("SshAgentDestinationsService", () => {
  let service: SshAgentDestinationsService;
  let stateProvider: FakeStateProvider;

  const userId = Utils.newGuid() as UserId;
  const cipherId = Utils.newGuid() as CipherId;

  beforeEach(() => {
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    service = new SshAgentDestinationsService(stateProvider);
  });

  it("defaults to an empty record when nothing has been set", async () => {
    const result = await firstValueFrom(service.destinationFingerprints$);
    expect(result).toEqual({});
  });

  it("stores fingerprints set for a cipher and makes them observable", async () => {
    await service.setDestinationFingerprints(cipherId, ["SHA256:aaaa", "SHA256:bbbb"]);

    const result = await firstValueFrom(service.destinationFingerprints$);
    expect(result).toEqual({ [cipherId]: ["SHA256:aaaa", "SHA256:bbbb"] });
  });

  it("preserves fingerprints for other ciphers when updating one cipher", async () => {
    const otherCipherId = Utils.newGuid() as CipherId;
    await service.setDestinationFingerprints(otherCipherId, ["SHA256:other"]);
    await service.setDestinationFingerprints(cipherId, ["SHA256:mine"]);

    const result = await firstValueFrom(service.destinationFingerprints$);
    expect(result).toEqual({
      [otherCipherId]: ["SHA256:other"],
      [cipherId]: ["SHA256:mine"],
    });
  });

  it("overwrites previous fingerprints when set again for the same cipher", async () => {
    await service.setDestinationFingerprints(cipherId, ["SHA256:old"]);
    await service.setDestinationFingerprints(cipherId, ["SHA256:new"]);

    const result = await firstValueFrom(service.destinationFingerprints$);
    expect(result).toEqual({ [cipherId]: ["SHA256:new"] });
  });

  it("removes the cipher entry when set to an empty array", async () => {
    await service.setDestinationFingerprints(cipherId, ["SHA256:aaaa"]);
    await service.setDestinationFingerprints(cipherId, []);

    const result = await firstValueFrom(service.destinationFingerprints$);
    expect(result).toEqual({});
  });
});
