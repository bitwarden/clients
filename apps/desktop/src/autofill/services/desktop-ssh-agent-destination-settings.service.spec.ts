import { firstValueFrom, of } from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherId } from "@bitwarden/common/types/guid";

import { DesktopSshAgentDestinationSettingsService } from "./desktop-ssh-agent-destination-settings.service";
import { SshAgentDestinationsService } from "./ssh-agent-destinations.service";

describe("DesktopSshAgentDestinationSettingsService", () => {
  let service: DesktopSshAgentDestinationSettingsService;
  let mockSshAgentDestinationsService: {
    destinationFingerprints$: ReturnType<typeof of>;
    setDestinationFingerprints: jest.Mock;
  };

  const cipherId = Utils.newGuid() as CipherId;

  beforeEach(() => {
    mockSshAgentDestinationsService = {
      destinationFingerprints$: of({}),
      setDestinationFingerprints: jest.fn().mockResolvedValue(undefined),
    };

    service = new DesktopSshAgentDestinationSettingsService(
      mockSshAgentDestinationsService as unknown as SshAgentDestinationsService,
    );
  });

  describe("destinationFingerprints$", () => {
    it("projects the fingerprints configured for the given cipher", async () => {
      const otherId = Utils.newGuid() as CipherId;
      mockSshAgentDestinationsService.destinationFingerprints$ = of({
        [cipherId]: ["SHA256:aaaa"],
        [otherId]: ["SHA256:bbbb"],
      });

      const result = await firstValueFrom(service.destinationFingerprints$(cipherId));

      expect(result).toEqual(["SHA256:aaaa"]);
    });

    it("emits an empty array when the cipher has no configured fingerprints", async () => {
      mockSshAgentDestinationsService.destinationFingerprints$ = of({});

      const result = await firstValueFrom(service.destinationFingerprints$(cipherId));

      expect(result).toEqual([]);
    });
  });

  describe("setDestinationFingerprints", () => {
    it("delegates to the underlying service", async () => {
      await service.setDestinationFingerprints(cipherId, ["SHA256:aaaa"]);

      expect(mockSshAgentDestinationsService.setDestinationFingerprints).toHaveBeenCalledWith(
        cipherId,
        ["SHA256:aaaa"],
      );
    });
  });
});
