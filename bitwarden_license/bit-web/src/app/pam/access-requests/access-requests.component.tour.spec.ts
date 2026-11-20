import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";
import { CoachmarkService } from "@bitwarden/vault";

import { ApprovalPrivilegeService } from "../approvals/approval-privilege.service";
import { ApproverInboxService } from "../approvals/approver-inbox.service";

import { AccessRequestsComponent } from "./access-requests.component";
import { MyAccessService } from "./my-access.service";

const licensedOrg = { enabled: true, usePam: true, accessPam: true } as Organization;
const unlicensedOrg = { enabled: true, usePam: true, accessPam: false } as Organization;

describe("AccessRequestsComponent coachmark tour", () => {
  const coachmark = mock<CoachmarkService>();
  const configService = mock<ConfigService>();
  let canApprove$: BehaviorSubject<boolean>;
  let organizations$: BehaviorSubject<Organization[]>;

  function create() {
    TestBed.configureTestingModule({
      imports: [AccessRequestsComponent],
      providers: [
        provideRouter([]),
        {
          provide: MyAccessService,
          useValue: {
            pendingRows$: of([]),
            extensionRows$: of([]),
            leases$: of([]),
            loadError$: of(null),
            load: () => Promise.resolve(),
          },
        },
        {
          provide: ApproverInboxService,
          useValue: { pendingCount$: of(0), loadError$: of(null), load: () => Promise.resolve() },
        },
        { provide: ApprovalPrivilegeService, useValue: { canApprove$ } },
        {
          provide: AccountService,
          useValue: { activeAccount$: new BehaviorSubject({ id: "user-id" as UserId }) },
        },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
        { provide: ConfigService, useValue: configService },
        { provide: StateProvider, useValue: mock<StateProvider>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: CoachmarkService, useValue: coachmark },
      ],
    }).overrideComponent(AccessRequestsComponent, {
      set: { imports: [], schemas: [NO_ERRORS_SCHEMA], template: "" },
    });
    const fixture = TestBed.createComponent(AccessRequestsComponent);
    fixture.detectChanges();
    return fixture;
  }

  /** Lets the component's awaits settle, then runs the render pass its `afterNextRender` waits for. */
  async function settle(fixture: ComponentFixture<AccessRequestsComponent>) {
    await new Promise(process.nextTick);
    fixture.detectChanges();
    await new Promise(process.nextTick);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    canApprove$ = new BehaviorSubject<boolean>(false);
    organizations$ = new BehaviorSubject<Organization[]>([licensedOrg]);
    coachmark.startTour.mockResolvedValue();
    configService.getFeatureFlag.mockResolvedValue(true);
  });

  it("does not start the tour when the Pam flag is off", async () => {
    configService.getFeatureFlag.mockResolvedValue(false);
    const fixture = create();
    await settle(fixture);

    expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.Pam);
    expect(coachmark.startTour).not.toHaveBeenCalled();
  });

  it("waits for the next render before starting, so the tab anchors are mounted", async () => {
    canApprove$.next(true);
    const fixture = create();
    await new Promise(process.nextTick);
    expect(coachmark.startTour).not.toHaveBeenCalled();

    await settle(fixture);
    expect(coachmark.startTour).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])("starts the tour once canApprove resolves to %s", async (canApprove) => {
    canApprove$.next(canApprove);
    const fixture = create();
    await settle(fixture);

    expect(coachmark.startTour).toHaveBeenCalledTimes(1);
    const tour = coachmark.startTour.mock.calls[0][0];
    expect(tour.steps.some((s) => s.id === "pamApprovalsTab")).toBe(canApprove);
  });

  it("includes the Active access step, whose anchor is on the routed My requests tab", async () => {
    const fixture = create();
    await settle(fixture);

    const ids = coachmark.startTour.mock.calls[0][0].steps.map((s) => s.id);
    expect(ids).toContain("pamActiveAccess");
  });

  describe("licensing", () => {
    it("does not start for a member unlicensed in every PAM organization", async () => {
      organizations$.next([unlicensedOrg, { usePam: false } as Organization]);
      const fixture = create();
      await settle(fixture);

      expect(coachmark.startTour).not.toHaveBeenCalled();
    });

    it("starts when at least one PAM organization is licensed", async () => {
      organizations$.next([unlicensedOrg, licensedOrg]);
      const fixture = create();
      await settle(fixture);

      expect(coachmark.startTour).toHaveBeenCalledTimes(1);
    });

    it("does not read unknown membership as unlicensed (accessPam not yet synced)", async () => {
      organizations$.next([{ enabled: true, usePam: true } as Organization]);
      const fixture = create();
      await settle(fixture);

      expect(coachmark.startTour).toHaveBeenCalledTimes(1);
    });

    it("still starts for a provider user, whose accessPam is hardcoded false and so says nothing", async () => {
      organizations$.next([{ ...unlicensedOrg, isProviderUser: true } as Organization]);
      const fixture = create();
      await settle(fixture);

      expect(coachmark.startTour).toHaveBeenCalledTimes(1);
    });
  });
});
