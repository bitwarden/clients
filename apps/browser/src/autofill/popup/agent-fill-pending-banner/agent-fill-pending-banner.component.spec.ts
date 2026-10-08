import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import {
  AgentFillPendingRequest,
  AgentFillPendingRequestService,
} from "../../services/agent-fill-pending-request.service";

import { AgentFillPendingBannerComponent } from "./agent-fill-pending-banner.component";

describe("AgentFillPendingBannerComponent", () => {
  let fixture: ComponentFixture<AgentFillPendingBannerComponent>;
  const pendingRequest$ = new BehaviorSubject<AgentFillPendingRequest | null>(null);
  const i18nService = mock<I18nService>();

  const banner = () => fixture.nativeElement.querySelector("bit-banner") as HTMLElement | null;

  beforeEach(async () => {
    i18nService.t.mockImplementation((key, ...args) => [key, ...args].join("|"));

    await TestBed.configureTestingModule({
      imports: [AgentFillPendingBannerComponent],
      providers: [
        {
          provide: AgentFillPendingRequestService,
          useValue: { pendingRequest$ },
        },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentFillPendingBannerComponent);
  });

  afterEach(() => {
    pendingRequest$.next(null);
  });

  it("renders nothing while no request is pending", () => {
    fixture.detectChanges();

    expect(banner()).toBeNull();
  });

  it("names the connection and the site while a request is pending", () => {
    pendingRequest$.next({
      approvalId: "a1",
      domain: "www.delta.com",
      connectionName: "Claude Desktop",
    });
    fixture.detectChanges();

    expect(banner()?.textContent).toContain("agentFillPendingRequest|Claude Desktop|www.delta.com");
  });

  it("has no control that could approve or deny the request", () => {
    pendingRequest$.next({
      approvalId: "a1",
      domain: "www.delta.com",
      connectionName: "Claude Desktop",
    });
    fixture.detectChanges();

    expect(banner()?.querySelectorAll("button, a, input")).toHaveLength(0);
  });

  it("disappears when the request ends", () => {
    pendingRequest$.next({
      approvalId: "a1",
      domain: "www.delta.com",
      connectionName: "Claude Desktop",
    });
    fixture.detectChanges();
    pendingRequest$.next(null);
    fixture.detectChanges();

    expect(banner()).toBeNull();
  });
});
