import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, Subject, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, DrawerRef, ToastService } from "@bitwarden/components";

import { ApproverInboxService } from "../approvals/approver-inbox.service";

import { AccessRequestRouteComponent } from "./access-request-route/access-request-route.component";
import { AccessRequestsComponent } from "./access-requests.component";
import { MyAccessService } from "./my-access.service";

/** A drawer the shell can hold and close, with a `closed` the test drives by hand. */
function drawerRef(): { closed: Subject<undefined>; close: jest.Mock } {
  return { closed: new Subject<undefined>(), close: jest.fn().mockResolvedValue({ closed: true }) };
}

/** Lets the query-param subscription's async open settle before assertions. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("AccessRequestsComponent", () => {
  let fixture: ComponentFixture<AccessRequestsComponent>;
  let queryParams$: BehaviorSubject<Record<string, unknown>>;
  let router: { navigate: jest.Mock };
  let openDrawer: jest.SpyInstance;

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(AccessRequestsComponent);
    fixture.detectChanges();
    await settle();
  }

  beforeEach(async () => {
    queryParams$ = new BehaviorSubject<Record<string, unknown>>({});
    router = { navigate: jest.fn().mockResolvedValue(true) };
    openDrawer = jest.spyOn(AccessRequestRouteComponent, "openDrawer");

    await TestBed.configureTestingModule({
      imports: [AccessRequestsComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParams: queryParams$.asObservable() } },
        { provide: Router, useValue: router },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        {
          provide: OrganizationService,
          useValue: { organizations$: () => of([{ canManageAccessRules: false }]) },
        },
        {
          provide: MyAccessService,
          useValue: {
            pendingRows$: of([]),
            extensionRows$: of([]),
            leases$: of([]),
            loadError$: of(null),
            load: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ApproverInboxService,
          useValue: {
            pendingCount$: of(0),
            loadError$: of(null),
            load: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();

    // The tab nav and the shared web header are chrome this spec has no interest in; what it pins
    // is the shell's drawer wiring, which lives entirely in ngOnInit.
    TestBed.overrideTemplate(AccessRequestsComponent, "");
  });

  afterEach(() => {
    openDrawer.mockRestore();
  });

  describe("the request drawer", () => {
    it("opens nothing when no request is named", async () => {
      await create();

      expect(openDrawer).not.toHaveBeenCalled();
    });

    it("opens the drawer for the request the query param names", async () => {
      queryParams$.next({ requestId: "req-1" });
      openDrawer.mockResolvedValue(drawerRef() as unknown as DrawerRef<undefined>);

      await create();

      expect(openDrawer).toHaveBeenCalledTimes(1);
      expect(openDrawer).toHaveBeenCalledWith(expect.anything(), { requestId: "req-1" });
    });

    it("does not reopen when the same request is emitted again", async () => {
      queryParams$.next({ requestId: "req-1" });
      openDrawer.mockResolvedValue(drawerRef() as unknown as DrawerRef<undefined>);
      await create();

      queryParams$.next({ requestId: "req-1", tab: "history" });
      await settle();

      expect(openDrawer).toHaveBeenCalledTimes(1);
    });

    it("reopens for another request — a row clicked while the drawer is showing", async () => {
      queryParams$.next({ requestId: "req-1" });
      openDrawer.mockResolvedValue(drawerRef() as unknown as DrawerRef<undefined>);
      await create();

      queryParams$.next({ requestId: "req-2" });
      await settle();

      expect(openDrawer).toHaveBeenCalledTimes(2);
      expect(openDrawer).toHaveBeenLastCalledWith(expect.anything(), { requestId: "req-2" });
    });

    it("closes the open drawer when the query param is cleared", async () => {
      const ref = drawerRef();
      queryParams$.next({ requestId: "req-1" });
      openDrawer.mockResolvedValue(ref as unknown as DrawerRef<undefined>);
      await create();

      queryParams$.next({});
      await settle();

      expect(ref.close).toHaveBeenCalled();
    });

    it("clears the request from the URL when the drawer closes, keeping the current tab", async () => {
      const ref = drawerRef();
      queryParams$.next({ requestId: "req-1" });
      openDrawer.mockResolvedValue(ref as unknown as DrawerRef<undefined>);
      await create();

      ref.closed.next(undefined);

      expect(router.navigate).toHaveBeenCalledWith([], {
        queryParams: { requestId: null },
        queryParamsHandling: "merge",
        replaceUrl: true,
      });
      expect(router.navigate.mock.calls[0][1]).not.toHaveProperty("relativeTo");
    });

    it("ignores a superseded drawer's close, so it cannot wipe the request that replaced it", async () => {
      const first = drawerRef();
      const second = drawerRef();
      queryParams$.next({ requestId: "req-1" });
      openDrawer.mockResolvedValue(first as unknown as DrawerRef<undefined>);
      await create();

      openDrawer.mockResolvedValue(second as unknown as DrawerRef<undefined>);
      queryParams$.next({ requestId: "req-2" });
      await settle();

      first.closed.next(undefined);

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("closes the drawer on destroy without writing query params onto the new route", async () => {
      const ref = drawerRef();
      queryParams$.next({ requestId: "req-1" });
      openDrawer.mockResolvedValue(ref as unknown as DrawerRef<undefined>);
      await create();

      fixture.destroy();

      expect(ref.close).toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
