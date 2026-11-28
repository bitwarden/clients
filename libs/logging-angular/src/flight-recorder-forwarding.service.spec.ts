import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { LogService } from "@bitwarden/logging";
import { enableFlightRecorderForwarding, IpcClient } from "@bitwarden/sdk-internal";

import { FlightRecorderForwardingService } from "./flight-recorder-forwarding.service";

jest.mock("@bitwarden/sdk-internal", () => ({
  ...jest.requireActual("@bitwarden/sdk-internal"),
  enableFlightRecorderForwarding: jest.fn(),
}));

describe("FlightRecorderForwardingService", () => {
  const configService = mock<ConfigService>();
  const logService = mock<LogService>();
  const client = mock<IpcClient>();
  const collector = { BrowserBackground: { id: "Own" as const } };
  const ipcService = { client } as IpcService;
  let service: FlightRecorderForwardingService;

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: IpcService, useValue: ipcService },
        { provide: LogService, useValue: logService },
      ],
    });
    service = TestBed.inject(FlightRecorderForwardingService);
  });

  it("forwards to the collector when the flag is on", async () => {
    configService.getFeatureFlag.mockResolvedValue(true);

    await service.enable(collector);

    expect(configService.getFeatureFlag).toHaveBeenCalledWith(
      FeatureFlag.PM30935_FlightRecorderTsLogging,
    );
    expect(enableFlightRecorderForwarding).toHaveBeenCalledWith(client, collector);
  });

  it("does nothing when the flag is off", async () => {
    configService.getFeatureFlag.mockResolvedValue(false);

    await service.enable(collector);

    expect(enableFlightRecorderForwarding).not.toHaveBeenCalled();
  });

  it("logs instead of throwing when forwarding fails", async () => {
    configService.getFeatureFlag.mockResolvedValue(true);
    const error = new Error("forwarding failed");
    jest.mocked(enableFlightRecorderForwarding).mockImplementationOnce(() => {
      throw error;
    });

    await service.enable(collector);

    expect(logService.error).toHaveBeenCalledWith(
      "[FlightRecorder] Failed to enable forwarding",
      error,
    );
  });
});
