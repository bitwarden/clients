import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subscription } from "rxjs";

import { PasskeyOpportunityService } from "@bitwarden/common/dirt/vault-health/services";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { HealthPasskeyScanService } from "./health-passkey-scan.service";

describe("HealthPasskeyScanService", () => {
  const userId = "user-1" as UserId;

  let cipherViews$: BehaviorSubject<CipherView[] | null>;
  let opportunityService: MockProxy<PasskeyOpportunityService>;
  let logService: MockProxy<LogService>;
  let flags: Record<string, BehaviorSubject<boolean>>;
  let service: HealthPasskeyScanService;
  let subscription: Subscription | undefined;

  function cipher(id: string): CipherView {
    const view = new CipherView();
    view.id = id;
    return view;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    cipherViews$ = new BehaviorSubject<CipherView[] | null>([cipher("a")]);
    const cipherService = mock<CipherService>();
    cipherService.cipherViews$.mockReturnValue(cipherViews$ as never);
    opportunityService = mock<PasskeyOpportunityService>();
    opportunityService.findPasskeyOpportunities.mockResolvedValue();
    logService = mock<LogService>();
    flags = {
      [FeatureFlag.PM35248_BrowserPasskeyReport]: new BehaviorSubject(true),
      [FeatureFlag.VFO1Foundation]: new BehaviorSubject(true),
    };
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockImplementation((flag) => flags[flag] as never);

    TestBed.configureTestingModule({
      providers: [
        { provide: CipherService, useValue: cipherService },
        { provide: PasskeyOpportunityService, useValue: opportunityService },
        { provide: LogService, useValue: logService },
        { provide: ConfigService, useValue: configService },
      ],
    });
    service = TestBed.inject(HealthPasskeyScanService);
  });

  afterEach(() => {
    subscription?.unsubscribe();
    jest.useRealTimers();
  });

  async function flush() {
    await jest.advanceTimersByTimeAsync(300);
  }

  describe("enabled$", () => {
    async function enabled(): Promise<boolean> {
      let value = false;
      service.enabled$.subscribe((v) => (value = v)).unsubscribe();
      return value;
    }

    it("is on with the browser passkey report flag and VFO1", async () => {
      expect(await enabled()).toBe(true);
    });

    it.each([FeatureFlag.PM35248_BrowserPasskeyReport, FeatureFlag.VFO1Foundation])(
      "is off without %s",
      async (flag) => {
        flags[flag].next(false);

        expect(await enabled()).toBe(false);
      },
    );
  });

  it("checks the current vault once subscribed, without reloading the directory", async () => {
    subscription = service.keepPasskeysCurrent$(userId).subscribe();
    await flush();

    expect(opportunityService.findPasskeyOpportunities).toHaveBeenCalledTimes(1);
    expect(opportunityService.findPasskeyOpportunities).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "a" })],
      userId,
      { reloadDirectory: false },
    );
  });

  it("waits for decryption rather than checking a null vault", async () => {
    cipherViews$.next(null);
    subscription = service.keepPasskeysCurrent$(userId).subscribe();
    await flush();

    expect(opportunityService.findPasskeyOpportunities).not.toHaveBeenCalled();
  });

  it("collapses a burst of vault changes into one recheck", async () => {
    subscription = service.keepPasskeysCurrent$(userId).subscribe();
    await flush();

    cipherViews$.next([cipher("b")]);
    cipherViews$.next([cipher("c")]);
    await flush();

    expect(opportunityService.findPasskeyOpportunities).toHaveBeenCalledTimes(2);
    expect(opportunityService.findPasskeyOpportunities).toHaveBeenLastCalledWith(
      [expect.objectContaining({ id: "c" })],
      userId,
      { reloadDirectory: false },
    );
  });

  it("rechecks with a fresh directory on retry, then reuses it for later changes", async () => {
    subscription = service.keepPasskeysCurrent$(userId).subscribe();
    await flush();

    service.retry(userId);
    await flush();
    expect(opportunityService.findPasskeyOpportunities).toHaveBeenLastCalledWith(
      expect.anything(),
      userId,
      { reloadDirectory: true },
    );

    cipherViews$.next([cipher("b")]);
    await flush();
    expect(opportunityService.findPasskeyOpportunities).toHaveBeenLastCalledWith(
      expect.anything(),
      userId,
      { reloadDirectory: false },
    );
  });

  it("ignores a retry for another user", async () => {
    subscription = service.keepPasskeysCurrent$(userId).subscribe();
    await flush();

    service.retry("user-2" as UserId);
    await flush();

    expect(opportunityService.findPasskeyOpportunities).toHaveBeenCalledTimes(1);
  });

  it("stops watching the vault once unsubscribed", async () => {
    subscription = service.keepPasskeysCurrent$(userId).subscribe();
    await flush();
    subscription.unsubscribe();

    cipherViews$.next([cipher("b")]);
    await flush();

    expect(opportunityService.findPasskeyOpportunities).toHaveBeenCalledTimes(1);
  });

  it("logs and completes quietly if the pipeline errors", async () => {
    opportunityService.findPasskeyOpportunities.mockRejectedValue(new Error("boom"));
    subscription = service.keepPasskeysCurrent$(userId).subscribe();
    await flush();

    expect(logService.error).toHaveBeenCalledWith(
      "Passkey opportunity pipeline failed",
      expect.any(Error),
    );
  });
});
