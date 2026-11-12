import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import {
  ApprovalPrivilegeService,
  ApproverInboxService,
  MyAccessService,
} from "@bitwarden/bit-pam-components";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";

import { PamShellComponent } from "./pam-shell.component";

describe("PamShellComponent", () => {
  let fixture: ComponentFixture<PamShellComponent>;
  let canApprove$: BehaviorSubject<boolean>;
  let pendingCount$: BehaviorSubject<number>;
  let pendingRows$: BehaviorSubject<unknown[]>;
  let myAccess: { load: jest.Mock };
  let inbox: { load: jest.Mock };

  beforeEach(async () => {
    canApprove$ = new BehaviorSubject<boolean>(true);
    pendingCount$ = new BehaviorSubject<number>(2);
    pendingRows$ = new BehaviorSubject<unknown[]>([{}]);
    myAccess = { load: jest.fn() };
    inbox = { load: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [PamShellComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: MyAccessService,
          useValue: {
            ...myAccess,
            pendingRows$,
            extensionRows$: of([]),
            leases$: of([]),
            loadError$: of(null),
          },
        },
        {
          provide: ApproverInboxService,
          useValue: { ...inbox, pendingCount$, loadError$: of(null) },
        },
        { provide: ApprovalPrivilegeService, useValue: { canApprove$ } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(true) } },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => fixture?.destroy());

  function create(): HTMLElement {
    fixture = TestBed.createComponent(PamShellComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /** The tab bar renders in the desktop header's `tabs` slot with real components. */
  function tabLabels(host: HTMLElement): string[] {
    return Array.from(host.querySelectorAll("bit-tab-link")).map((link) =>
      (link.textContent ?? "").replace(/\s+/g, " ").trim(),
    );
  }

  it("renders the tab bar with every tab for an approver", () => {
    const host = create();

    expect(host.querySelector("bit-tab-nav-bar")).not.toBeNull();
    const labels = tabLabels(host);
    expect(labels).toHaveLength(3);
    expect(labels[0]).toContain("pamTabApprovals");
    expect(labels[1]).toContain("pamTabMyRequests");
    expect(labels[2]).toContain("pamTabHistory");
  });

  it("hides Approvals from a requester who cannot approve", () => {
    canApprove$.next(false);
    const host = create();

    const labels = tabLabels(host);
    expect(labels).toHaveLength(2);
    expect(labels.join(" ")).not.toContain("pamTabApprovals");
  });
});
