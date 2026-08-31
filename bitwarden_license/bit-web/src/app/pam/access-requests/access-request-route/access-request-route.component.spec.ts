import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { DefaultUrlSerializer, Navigation, NavigationExtras, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { Subject } from "rxjs";

import { DialogRef, DialogService } from "@bitwarden/components";

import { ApprovalsTabComponent } from "../approvals-tab.component";
import { HistoryTabComponent } from "../history-tab.component";
import { MyRequestsTabComponent } from "../my-requests-tab.component";

import { AccessRequestDetailService } from "./access-request-detail.service";
import { AccessRequestDialogComponent } from "./access-request-dialog.component";
import { AccessRequestRouteComponent } from "./access-request-route.component";

describe("AccessRequestRouteComponent", () => {
  let fixture: ComponentFixture<AccessRequestRouteComponent>;
  let dialogService: MockProxy<DialogService>;
  let router: MockProxy<Router>;
  let detail: AccessRequestDetailService;
  let closed$: Subject<void>;
  let close: jest.Mock;

  /** The origin tab is read during construction, off the navigation the router is still running. */
  function create(previousNavigation: Navigation | null): void {
    router.getCurrentNavigation.mockReturnValue({ previousNavigation } as Navigation);
    fixture = TestBed.createComponent(AccessRequestRouteComponent);
    fixture.detectChanges();
  }

  /** A previous navigation that finished on `path`, as the router would report it. */
  function cameFrom(path: string): Navigation {
    return { finalUrl: new DefaultUrlSerializer().parse(path) } as Navigation;
  }

  /**
   * A stand-in for the browser history stack, so the close path can be exercised the way a real tab
   * experiences it: a navigation pushes unless it is told to replace, and Back at the bottom of the
   * stack does nothing.
   */
  class BrowserHistory {
    readonly entries: string[];
    private index: number;

    constructor(...entries: string[]) {
      this.entries = entries;
      this.index = entries.length - 1;
    }

    get url(): string {
      return this.entries[this.index];
    }

    navigate(url: string, replaceUrl: boolean): void {
      if (replaceUrl) {
        this.entries[this.index] = url;
        return;
      }
      this.entries.length = this.index + 1;
      this.entries.push(url);
      this.index += 1;
    }

    back(): void {
      this.index = Math.max(0, this.index - 1);
    }
  }

  /** Drives `history` off the component's own navigation, the way the browser would. */
  function trackHistory(history: BrowserHistory): void {
    router.navigate.mockImplementation((commands: readonly any[], extras?: NavigationExtras) => {
      history.navigate(commands.join("/"), extras?.replaceUrl === true);
      return Promise.resolve(true);
    });
  }

  beforeEach(async () => {
    closed$ = new Subject<void>();
    // The real ref emits `closed` whichever way it is closed, which is what the host has to tell
    // apart from a user dismissal.
    close = jest.fn(() => closed$.next());
    dialogService = mock<DialogService>();
    dialogService.open.mockReturnValue({
      closed: closed$,
      close,
    } as unknown as DialogRef<unknown, unknown>);
    router = mock<Router>();
    detail = mock<AccessRequestDetailService>();

    await TestBed.configureTestingModule({
      imports: [AccessRequestRouteComponent],
      providers: [
        { provide: DialogService, useValue: dialogService },
        { provide: Router, useValue: router },
      ],
    })
      // The detail service is provided on this component so it can read the `:id` off
      // `ActivatedRoute`; the backdrop tabs pull in the whole My-access surface, which this test
      // has no interest in.
      .overrideComponent(AccessRequestRouteComponent, {
        remove: {
          imports: [ApprovalsTabComponent, HistoryTabComponent, MyRequestsTabComponent],
          providers: [AccessRequestDetailService],
        },
        add: {
          schemas: [NO_ERRORS_SCHEMA],
          providers: [{ provide: AccessRequestDetailService, useValue: detail }],
        },
      })
      .compileComponents();
  });

  it("opens the detail dialog over the shell, handing it the route-scoped detail service", () => {
    create(null);

    expect(dialogService.open).toHaveBeenCalledWith(AccessRequestDialogComponent, {
      data: { detail },
      closeOnNavigation: false,
    });
  });

  it.each([
    ["/pam/approvals", "pam-approvals-tab"],
    ["/pam/history", "pam-history-tab"],
    ["/pam/my-requests", "pam-my-requests-tab"],
  ])("renders the tab the caller came from (%s) behind the dialog", (path, selector) => {
    create(cameFrom(path));

    expect(fixture.nativeElement.querySelector(selector)).not.toBeNull();
  });

  // `/organizations/:id/billing/history` ends on the same segment as the PAM History tab, so a
  // caller from there must not be mistaken for one.
  it.each(["/vault", "/organizations/orgId/billing/history"])(
    "renders My requests behind the dialog when the caller arrived from outside the tabs (%s)",
    (path) => {
      create(cameFrom(path));

      expect(fixture.nativeElement.querySelector("pam-my-requests-tab")).not.toBeNull();
    },
  );

  it("renders My requests behind the dialog when the link was opened cold", () => {
    create(null);

    expect(fixture.nativeElement.querySelector("pam-my-requests-tab")).not.toBeNull();
  });

  it.each([
    ["/pam/approvals", "approvals"],
    ["/pam/history", "history"],
    ["/pam/my-requests", "my-requests"],
  ])("replaces the dialog URL with the tab it rendered behind (%s)", (path, tab) => {
    create(cameFrom(path));

    closed$.next();

    expect(router.navigate).toHaveBeenCalledWith(["/pam", tab], { replaceUrl: true });
  });

  it("replaces the dialog URL with My requests when the link was opened cold", () => {
    create(null);

    closed$.next();

    expect(router.navigate).toHaveBeenCalledWith(["/pam", "my-requests"], { replaceUrl: true });
  });

  it("consumes the dialog URL rather than stacking the tab on top of it", () => {
    const history = new BrowserHistory("/pam/requests/A");
    trackHistory(history);
    create(null);

    closed$.next();

    expect(history.entries).toEqual(["/pam/my-requests"]);
  });

  it("never leaves the caller stranded on the dialog URL", () => {
    const detailUrl = "/pam/requests/A";
    const history = new BrowserHistory(detailUrl);
    trackHistory(history);

    // A pasted link opened in a fresh tab: nothing behind it in history, and the shell is built by
    // this same activation, so the router has already dropped the navigation.
    create(null);
    // The caller closes the dialog; the navigation that follows tears the route down.
    closed$.next();
    fixture.destroy();
    // Back. Should the close have pushed rather than replaced, this lands on the dialog again —
    // and this time the shell is mounted, so the activation does see a previous navigation.
    history.back();
    create(cameFrom("/pam/my-requests"));
    // The caller closes it a second time.
    closed$.next();

    expect(history.url).not.toBe(detailUrl);
  });

  it("closes the dialog without navigating when the route is left by other means", () => {
    create(cameFrom("/pam/my-requests"));

    fixture.destroy();

    expect(close).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("navigates once when the dismissal itself tears the route down", () => {
    create(cameFrom("/pam/history"));

    closed$.next();
    fixture.destroy();

    expect(close).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });
});
