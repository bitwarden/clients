import { Location } from "@angular/common";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Navigation, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { Subject } from "rxjs";

import { DialogRef, DialogService } from "@bitwarden/components";

import { MyRequestsTabComponent } from "../my-requests-tab.component";

import { AccessRequestDetailService } from "./access-request-detail.service";
import { AccessRequestDialogComponent } from "./access-request-dialog.component";
import { AccessRequestRouteComponent } from "./access-request-route.component";

describe("AccessRequestRouteComponent", () => {
  let fixture: ComponentFixture<AccessRequestRouteComponent>;
  let dialogService: MockProxy<DialogService>;
  let router: MockProxy<Router>;
  let location: MockProxy<Location>;
  let detail: AccessRequestDetailService;
  let closed$: Subject<void>;
  let close: jest.Mock;

  /** `hasHistory` is read during construction, off the navigation the router is still running. */
  function create(previousNavigation: Navigation | null): void {
    router.getCurrentNavigation.mockReturnValue({ previousNavigation } as Navigation);
    fixture = TestBed.createComponent(AccessRequestRouteComponent);
    fixture.detectChanges();
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
    location = mock<Location>();
    detail = mock<AccessRequestDetailService>();

    await TestBed.configureTestingModule({
      imports: [AccessRequestRouteComponent],
      providers: [
        { provide: DialogService, useValue: dialogService },
        { provide: Router, useValue: router },
        { provide: Location, useValue: location },
      ],
    })
      // The detail service is provided on this component so it can read the `:id` off
      // `ActivatedRoute`; the backdrop tab pulls in the whole My-access surface, which this test
      // has no interest in.
      .overrideComponent(AccessRequestRouteComponent, {
        remove: { imports: [MyRequestsTabComponent], providers: [AccessRequestDetailService] },
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

  it("renders the My requests tab behind the dialog", () => {
    create(null);

    expect(fixture.nativeElement.querySelector("pam-my-requests-tab")).not.toBeNull();
  });

  it("goes back to where the caller came from when the dialog is closed", () => {
    create({} as Navigation);

    closed$.next();

    expect(location.back).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("falls back to the tab shell when the link was opened cold", () => {
    create(null);

    closed$.next();

    expect(router.navigate).toHaveBeenCalledWith(["/pam"]);
    expect(location.back).not.toHaveBeenCalled();
  });

  it("closes the dialog without navigating when the route is left by other means", () => {
    create({} as Navigation);

    fixture.destroy();

    expect(close).toHaveBeenCalled();
    expect(location.back).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
