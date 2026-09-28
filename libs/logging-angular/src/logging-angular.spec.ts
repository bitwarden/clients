import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { ClientType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { FlightRecorder, FlightRecorderLogRecorder } from "@bitwarden/logging";

import { FlightRecorderLogRecorderService, FlightRecorderService } from "./index";

const mockRead = jest.fn();

jest.mock("@bitwarden/sdk-internal", () => ({
  ...jest.requireActual("@bitwarden/sdk-internal"),
  FlightRecorderClient: jest.fn().mockImplementation(() => ({ read: mockRead })),
}));

describe("FlightRecorderService", () => {
  const platformUtilsService = mock<PlatformUtilsService>();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: PlatformUtilsService, useValue: platformUtilsService }],
    });
  });

  it("is injectable via Angular DI", () => {
    expect(TestBed.inject(FlightRecorderService)).toBeInstanceOf(FlightRecorderService);
  });

  it("is a singleton at the root injector", () => {
    expect(TestBed.inject(FlightRecorderService)).toBe(TestBed.inject(FlightRecorderService));
  });

  it("inherits from FlightRecorder", () => {
    expect(TestBed.inject(FlightRecorderService)).toBeInstanceOf(FlightRecorder);
  });

  it.each([
    [ClientType.Browser, "browser-popup"],
    [ClientType.Desktop, "desktop-renderer"],
    [ClientType.Web, "web"],
    [ClientType.Cli, undefined],
  ])("labels this context's events for client type %s as %s", async (clientType, process) => {
    Object.defineProperty(SdkLoadService, "Ready", {
      value: Promise.resolve(),
      configurable: true,
    });
    platformUtilsService.getClientType.mockReturnValue(clientType);
    mockRead.mockResolvedValue([
      { timestamp: 1000, level: "INFO", target: "typescript", message: "local", fields: {} },
    ]);

    const [event] = await TestBed.inject(FlightRecorderService).read();

    expect(event.process).toBe(process);
  });
});

describe("FlightRecorderLogRecorderService", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it("is injectable via Angular DI", () => {
    expect(TestBed.inject(FlightRecorderLogRecorderService)).toBeInstanceOf(
      FlightRecorderLogRecorderService,
    );
  });

  it("is a singleton at the root injector", () => {
    expect(TestBed.inject(FlightRecorderLogRecorderService)).toBe(
      TestBed.inject(FlightRecorderLogRecorderService),
    );
  });

  it("inherits from FlightRecorderLogRecorder", () => {
    expect(TestBed.inject(FlightRecorderLogRecorderService)).toBeInstanceOf(
      FlightRecorderLogRecorder,
    );
  });
});
