import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";

import { ApprovalPrivilegeService } from "../approvals/approval-privilege.service";
import { ApproverInboxService } from "../approvals/approver-inbox.service";

import { AccessRequestsComponent } from "./access-requests.component";
import { MyAccessService } from "./my-access.service";

describe("AccessRequestsComponent", () => {
  let fixture: ComponentFixture<AccessRequestsComponent>;
  let canApprove$: BehaviorSubject<boolean>;
  let pendingCount$: BehaviorSubject<number>;
  let pendingRows$: BehaviorSubject<unknown[]>;
  let extensionRows$: BehaviorSubject<unknown[]>;
  let leases$: BehaviorSubject<unknown[]>;
  let configService: ReturnType<typeof mock<ConfigService>>;

  beforeEach(async () => {
    canApprove$ = new BehaviorSubject<boolean>(true);
    pendingCount$ = new BehaviorSubject<number>(2);
    pendingRows$ = new BehaviorSubject<unknown[]>([{}]);
    extensionRows$ = new BehaviorSubject<unknown[]>([]);
    leases$ = new BehaviorSubject<unknown[]>([]);
    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(true));

    await TestBed.configureTestingModule({
      imports: [AccessRequestsComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: MyAccessService,
          useValue: {
            pendingRows$,
            extensionRows$,
            leases$,
            loadError$: of(null),
            load: jest.fn(),
          },
        },
        {
          provide: ApproverInboxService,
          useValue: { pendingCount$, loadError$: of(null), load: jest.fn() },
        },
        { provide: ApprovalPrivilegeService, useValue: { canApprove$ } },
        { provide: ConfigService, useValue: configService },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    })
      .overrideComponent(AccessRequestsComponent, { add: { schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();
  });

  afterEach(() => fixture?.destroy());

  function create(): void {
    fixture = TestBed.createComponent(AccessRequestsComponent);
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function tabs(): HTMLElement[] {
    return Array.from(host().querySelectorAll<HTMLElement>("bit-tab-link"));
  }

  function text(el: Element | null): string {
    return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  it("titles the page and carries the subtitle for an approver", () => {
    create();

    const header = host().querySelector("app-header");
    expect(header?.getAttribute("ng-reflect-title") ?? text(header)).toContain(
      "pamAccessRequestsTitle",
    );
    expect(text(host().querySelector("[slot=subtitle]"))).toContain("pamAccessRequestsSubtitle");
  });

  it("offers all three tabs to an approver", () => {
    create();

    expect(tabs().map((t) => t.getAttribute("route"))).toEqual([
      "approvals",
      "my-requests",
      "history",
    ]);
  });

  it("hides Approvals from a requester who cannot approve", () => {
    canApprove$.next(false);
    create();

    expect(tabs().map((t) => t.getAttribute("route"))).toEqual(["my-requests", "history"]);
    expect(host().querySelector("[slot=subtitle]")).toBeNull();
  });

  function counts(): { approvals: number; mine: number } {
    const c = fixture.componentInstance as unknown as {
      approvalsCount: () => number;
      myRequestsCount: () => number;
    };
    return { approvals: c.approvalsCount(), mine: c.myRequestsCount() };
  }

  it("berries Approvals with the inbox count and My requests with the caller's own", () => {
    leases$.next([{}, {}]);
    create();

    expect(counts().approvals).toBe(2);
    expect(counts().mine).toBe(3);
  });

  it("re-counts the My requests berry as the caller's rows change", () => {
    create();
    expect(counts().mine).toBe(1);

    pendingRows$.next([]);
    fixture.detectChanges();

    expect(counts().mine).toBe(0);
  });
});
