import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { MyAccessLeaseRow, MyAccessRequestRow } from "./my-access-row";
import { MyAccessService } from "./my-access.service";
import { MyRequestsTabComponent } from "./my-requests-tab.component";

const LEASE_END = "2026-08-20T12:00:00.000Z";

// Overrides are loosely typed rather than `Partial<MyAccessLeaseRow>`: the row's ids are opaque
// branded types, so tests stand in plain strings and rely on the single cast below — the same
// convention as `history-tab.component.spec.ts`.
function leaseRow(overrides: Record<string, unknown> = {}): MyAccessLeaseRow {
  return {
    id: "lease-1",
    requestId: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    cipherName: "Prod database",
    collectionName: "Production",
    notBefore: "2026-08-20T11:00:00.000Z",
    notAfter: LEASE_END,
    extendedBySeconds: null,
    extendedUntil: null,
    ...overrides,
  } as unknown as MyAccessLeaseRow;
}

describe("MyRequestsTabComponent", () => {
  let fixture: ComponentFixture<MyRequestsTabComponent>;
  let leases$: BehaviorSubject<MyAccessLeaseRow[]>;

  function create(): void {
    fixture = TestBed.createComponent(MyRequestsTabComponent);
    fixture.detectChanges();
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    leases$ = new BehaviorSubject<MyAccessLeaseRow[]>([]);

    await TestBed.configureTestingModule({
      imports: [MyRequestsTabComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: MyAccessService,
          useValue: {
            pendingRows$: new BehaviorSubject<MyAccessRequestRow[]>([]),
            extensionRows$: new BehaviorSubject<MyAccessRequestRow[]>([]),
            leases$,
            cipherById$: new BehaviorSubject(new Map<string, CipherView>()),
          },
        },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    })
      .overrideComponent(MyRequestsTabComponent, { add: { schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    jest.useRealTimers();
  });

  describe("active lease countdown", () => {
    it("rests on the accent 'time left' badge while the lease has plenty of time", () => {
      jest.setSystemTime(new Date("2026-08-20T11:30:00.000Z"));
      leases$.next([leaseRow()]);

      create();

      expect(query('[data-testid="access-state-badge-active"]')).not.toBeNull();
      expect(query('[data-testid="access-state-badge-ending-soon"]')).toBeNull();
    });

    it("shows the danger 'ending soon' badge inside the last five minutes", () => {
      jest.setSystemTime(new Date("2026-08-20T11:57:00.000Z"));
      leases$.next([leaseRow()]);

      create();

      expect(query('[data-testid="access-state-badge-ending-soon"]')).not.toBeNull();
      expect(query('[data-testid="access-state-badge-active"]')).toBeNull();
    });

    it("escalates without a reload as the clock crosses the threshold", () => {
      jest.setSystemTime(new Date("2026-08-20T11:52:00.000Z"));
      leases$.next([leaseRow()]);
      create();
      expect(query('[data-testid="access-state-badge-active"]')).not.toBeNull();

      jest.advanceTimersByTime(4 * 60_000);
      fixture.detectChanges();

      expect(query('[data-testid="access-state-badge-ending-soon"]')).not.toBeNull();
    });

    it("hands the badge the lease expiry as its active state", () => {
      jest.setSystemTime(new Date("2026-08-20T11:30:00.000Z"));
      const lease = leaseRow();
      leases$.next([lease]);

      create();

      expect(fixture.componentInstance["leaseBadgeState"](lease.id)).toEqual({
        kind: "active",
        expiresAt: new Date(LEASE_END),
      });
    });
  });
});
