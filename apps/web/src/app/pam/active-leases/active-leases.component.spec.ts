import {
  ComponentFixture,
  discardPeriodicTasks,
  fakeAsync,
  tick,
  TestBed,
} from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";
import { LeaseResponse, LeaseRevokeRequest, PamApiService } from "@bitwarden/pam";

import { ActiveLeasesComponent } from "./active-leases.component";

function makeLease(overrides: Partial<Record<string, unknown>> = {}): LeaseResponse {
  return new LeaseResponse({
    Id: "lease-1",
    RequestId: "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    GranteeUserId: "user-1",
    NotBefore: "2026-01-01T00:00:00Z",
    NotAfter: "2026-01-01T01:00:00Z",
    Status: "active",
    ...overrides,
  });
}

describe("ActiveLeasesComponent", () => {
  let component: ActiveLeasesComponent;
  let fixture: ComponentFixture<ActiveLeasesComponent>;

  let pamApi: MockProxy<PamApiService>;
  let configService: MockProxy<ConfigService>;
  let toastService: MockProxy<ToastService>;
  let logService: MockProxy<LogService>;
  let i18nService: MockProxy<I18nService>;
  let featureFlag$: BehaviorSubject<boolean>;

  beforeEach(async () => {
    pamApi = mock<PamApiService>();
    configService = mock<ConfigService>();
    toastService = mock<ToastService>();
    logService = mock<LogService>();
    i18nService = mock<I18nService>();

    featureFlag$ = new BehaviorSubject<boolean>(true);
    configService.getFeatureFlag$.mockReturnValue(featureFlag$);
    i18nService.t.mockImplementation((key: string) => `${key}-i18n`);
    pamApi.listActiveLeases.mockResolvedValue([makeLease()]);
    pamApi.revokeLease.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [ActiveLeasesComponent, NoopAnimationsModule],
      providers: [
        { provide: PamApiService, useValue: pamApi },
        { provide: ConfigService, useValue: configService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: logService },
        { provide: I18nService, useValue: i18nService },
      ],
    })
      .overrideComponent(ActiveLeasesComponent, {
        set: { template: "", imports: [] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ActiveLeasesComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("feature flag gating", () => {
    it("does not call listActiveLeases when the flag is off", () => {
      featureFlag$.next(false);
      fixture.detectChanges();
      expect(pamApi.listActiveLeases).not.toHaveBeenCalled();
      expect((component as any).featureEnabled()).toBe(false);
    });

    it("loads leases when the flag is on", fakeAsync(() => {
      fixture.detectChanges();
      // Drain the awaited refresh without firing the periodic countdown timer.
      tick(0);
      expect(pamApi.listActiveLeases).toHaveBeenCalledTimes(1);
      expect((component as any).rows()).toHaveLength(1);
      expect((component as any).rows()[0].id).toBe("lease-1");
      discardPeriodicTasks();
    }));
  });

  describe("refresh", () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      // Drain the awaited refresh microtasks without flushing the periodic
      // countdown timer — flush() would loop forever on the rxjs interval.
      tick(0);
      discardPeriodicTasks();
    }));

    it("captures fetch failure in loadError without dropping prior rows", fakeAsync(() => {
      pamApi.listActiveLeases.mockRejectedValueOnce(new Error("boom"));
      void (component as any).refresh();
      tick();
      expect((component as any).loadError()).toBe("activeLeasesLoadFailed");
      expect((component as any).rows()).toHaveLength(1);
      expect(logService.error).toHaveBeenCalled();
      discardPeriodicTasks();
    }));
  });

  describe("revoke flow", () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      // Drain the awaited refresh microtasks without flushing the periodic
      // countdown timer — flush() would loop forever on the rxjs interval.
      tick(0);
      discardPeriodicTasks();
    }));

    it("opens the inline confirm with an empty reason control", () => {
      (component as any).startConfirm("lease-1");
      expect((component as any).isConfirming("lease-1")).toBe(true);
      expect((component as any).reasonControlFor("lease-1").value).toBe("");
    });

    it("cancels confirm and clears the reason control", () => {
      (component as any).startConfirm("lease-1");
      (component as any).reasonControlFor("lease-1").setValue("oops");
      (component as any).cancelConfirm("lease-1");
      expect((component as any).isConfirming("lease-1")).toBe(false);
      // Reasoning: cancelling clears the staged reason so the next attempt starts fresh.
      expect((component as any).reasonControlFor("lease-1").value).toBe("");
    });

    it("calls revokeLease exactly once per confirmation with the trimmed reason", fakeAsync(() => {
      (component as any).startConfirm("lease-1");
      (component as any).reasonControlFor("lease-1").setValue("  off-boarding  ");
      void (component as any).confirmRevoke("lease-1");
      tick();
      expect(pamApi.revokeLease).toHaveBeenCalledTimes(1);
      const [calledId, calledRequest] = pamApi.revokeLease.mock.calls[0];
      expect(calledId).toBe("lease-1");
      expect(calledRequest).toBeInstanceOf(LeaseRevokeRequest);
      expect(calledRequest.reason).toBe("off-boarding");
      discardPeriodicTasks();
    }));

    it("omits the reason when blank", fakeAsync(() => {
      (component as any).startConfirm("lease-1");
      void (component as any).confirmRevoke("lease-1");
      tick();
      expect(pamApi.revokeLease.mock.calls[0][1].reason).toBeUndefined();
      discardPeriodicTasks();
    }));

    it("ignores a duplicate confirm while one revoke is in flight", fakeAsync(() => {
      let release: () => void = () => undefined;
      pamApi.revokeLease.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      );
      (component as any).startConfirm("lease-1");
      void (component as any).confirmRevoke("lease-1");
      void (component as any).confirmRevoke("lease-1");
      expect(pamApi.revokeLease).toHaveBeenCalledTimes(1);
      release();
      tick();
      discardPeriodicTasks();
    }));

    it("marks the row revoked then removes it on the scheduled tick", fakeAsync(() => {
      (component as any).startConfirm("lease-1");
      void (component as any).confirmRevoke("lease-1");
      tick();
      // After the API resolves, the row is flagged just-revoked but still present.
      const row = (component as any).rows().find((r: any) => r.id === "lease-1");
      expect(row).toBeDefined();
      expect(row.justRevoked).toBe(true);
      expect(row.revokedAt).toBeInstanceOf(Date);
      // The scheduled setTimeout(1500) drops the row.
      tick(1500);
      expect((component as any).rows().some((r: any) => r.id === "lease-1")).toBe(false);
      discardPeriodicTasks();
    }));

    it("surfaces a toast and keeps the row revocable when revokeLease fails", fakeAsync(() => {
      pamApi.revokeLease.mockRejectedValueOnce(new Error("nope"));
      (component as any).startConfirm("lease-1");
      void (component as any).confirmRevoke("lease-1");
      tick();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect((component as any).rows().some((r: any) => r.id === "lease-1")).toBe(true);
      // UI is restored: the row stays open and the in-flight flag clears so the
      // caller can correct the reason and retry without re-clicking Revoke.
      expect((component as any).isConfirming("lease-1")).toBe(true);
      expect((component as any).isRevoking("lease-1")).toBe(false);
      discardPeriodicTasks();
    }));
  });

  describe("countdown labels", () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      // Drain the awaited refresh microtasks without flushing the periodic
      // countdown timer — flush() would loop forever on the rxjs interval.
      tick(0);
      discardPeriodicTasks();
    }));

    it("formats remaining time relative to the reactive clock", () => {
      const start = new Date("2026-01-01T00:00:00Z");
      (component as any).now.set(start);
      const row = (component as any).rows()[0];
      // Lease ends at 01:00Z, clock is 00:00Z -> 1h
      expect((component as any).remainingLabel(row)).toBe("1h");
    });
  });

  describe("displayRows", () => {
    it("filters justRevoked rows once the badge window has elapsed", () => {
      const row = {
        id: "lease-x",
        cipherName: "c",
        collectionName: "col",
        requesterName: "u",
        notBefore: new Date(),
        notAfter: new Date(),
        justRevoked: true,
        revokedAt: new Date("2026-01-01T00:00:00Z"),
      } as any;
      (component as any).rows.set([row]);
      (component as any).now.set(new Date("2026-01-01T00:00:02Z"));
      expect((component as any).displayRows()).toHaveLength(0);
    });
  });
});
