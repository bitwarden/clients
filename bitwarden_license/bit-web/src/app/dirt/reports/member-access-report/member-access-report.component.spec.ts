import { CommonModule } from "@angular/common";
import { EnvironmentProviders, NO_ERRORS_SCHEMA, Provider, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { ActivatedRoute, provideRouter, Route, ROUTES, Routes } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

// The component library modules SharedModule pulls in use browser observers jsdom does not implement
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

import {
  CollectionAdminService,
  OrganizationUserApiService,
  OrganizationUserService,
} from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { Guid, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  BreadcrumbsModule,
  CdkDialogRef,
  DialogService,
  IconModule,
  ToastService,
} from "@bitwarden/components";
// Imported only as a DI token to mock out — MemberActionsService injects it. No crypto runs here.
// eslint-disable-next-line no-restricted-imports
import { LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
import { I18nPipe } from "@bitwarden/ui-common";
import { Vfo1I18nPipe, Vfo1TerminologyService } from "@bitwarden/vault";
import { GroupApiService } from "@bitwarden/web-vault/app/admin-console/organizations/core";
import { EditMemberDialogComponent } from "@bitwarden/web-vault/app/admin-console/organizations/members/components/edit-member-dialog";
import { MemberDialogResult } from "@bitwarden/web-vault/app/admin-console/organizations/members/components/member-dialog/member-dialog.types";
import { DeleteManagedMemberWarningService } from "@bitwarden/web-vault/app/admin-console/organizations/members/services";

import { OrganizationsRoutingModule } from "../../../admin-console/organizations/organizations-routing.module";

import { MemberAccessReportComponent } from "./member-access-report.component";
import { MemberAccessReportService } from "./services/member-access-report.service";
import { MemberAccessReportView } from "./view/member-access-report.view";

const ORGANIZATION_ID = "org-id" as OrganizationId;
const ORGANIZATION_USER_ID = "org-user-id" as Guid;
const USER_ID = "user-id" as UserId;

/**
 * Reads the `providers` off the real `member-access-report` route instead of restating them, by
 * asking the routing module for the `ROUTES` it contributes. If the providers are removed, or moved
 * somewhere that is not an environment injector (e.g. onto the component decorator, where the
 * dialog's injector chain cannot see them), this test loses them and fails — which is the
 * regression it exists to catch.
 */
function memberAccessReportRouteProviders(): Provider[] {
  TestBed.configureTestingModule({ imports: [OrganizationsRoutingModule] });
  const routes = TestBed.inject(ROUTES).flat();
  TestBed.resetTestingModule();

  const find = (candidates: Routes): Route | undefined => {
    for (const route of candidates) {
      if (route.path === "member-access-report") {
        return route;
      }
      const match = route.children && find(route.children);
      if (match) {
        return match;
      }
    }
    return undefined;
  };

  const route = find(routes);
  if (route == undefined) {
    throw new Error('No route found for path "member-access-report"');
  }
  return (route.providers ?? []) as Provider[];
}

function buildRow(): MemberAccessReportView {
  return {
    name: "Test User",
    email: "test@example.com",
    avatarColor: "#000000",
    collectionsCount: 0,
    groupsCount: 0,
    itemsCount: 0,
    userGuid: ORGANIZATION_USER_ID,
    usesKeyConnector: false,
    userIdFromOrgUser: USER_ID,
  };
}

/**
 * Everything EditMemberDialogComponent — and the services it injects — needs from an environment
 * injector, i.e. everything the running app gets from `providedIn: "root"` or from a module
 * imported at bootstrap.
 *
 * MemberActionsService, MemberDialogManagerService and BillingConstraintService are deliberately
 * absent: they are the subject of this test, so the route's `providers` must be their only source.
 */
function environmentProviders(): (Provider | EnvironmentProviders)[] {
  const accountService = mock<AccountService>();
  const account: Account = {
    id: USER_ID,
    email: "test@example.com",
    emailVerified: true,
    name: "Test User",
    creationDate: undefined,
  };
  accountService.activeAccount$ = of(account);

  const organizationService = mock<OrganizationService>();
  organizationService.organizations$.mockReturnValue(
    of([
      {
        id: ORGANIZATION_ID,
        useGroups: false,
        canEditAnyCollection: true,
        allowAdminAccessToAllCollectionItems: true,
        permissions: { manageUsers: true },
        productTierType: 3,
        useCustomPermissions: true,
      },
    ] as unknown as Organization[]),
  );

  const collectionAdminService = mock<CollectionAdminService>();
  collectionAdminService.collectionAdminViews$.mockReturnValue(of([]));

  const organizationMetadataService = mock<OrganizationMetadataServiceAbstraction>();
  organizationMetadataService.getOrganizationMetadata$.mockReturnValue(
    of({
      organizationOccupiedSeats: 0,
      isOnSecretsManagerStandalone: false,
    } as OrganizationBillingMetadataResponse),
  );

  const configService = mock<ConfigService>();
  configService.getFeatureFlag.mockResolvedValue(false);
  configService.getFeatureFlag$.mockReturnValue(of(false));

  const i18nService = mock<I18nService>();
  i18nService.t.mockReturnValue("translated");

  const userNamePipe = mock<UserNamePipe>();
  userNamePipe.transform.mockReturnValue("Test User");

  const reportService = mock<MemberAccessReportService>();
  reportService.generateMemberAccessReportViewV2.mockResolvedValue([]);

  return [
    provideNoopAnimations(),
    // Listed before the ActivatedRoute stub below so that stub still wins: the report's breadcrumb
    // renders a `routerLink`, which needs a real Router. DialogService and DrawerService also
    // inject Router non-optionally and read `events` and `url` while being constructed.
    provideRouter([]),
    {
      provide: ActivatedRoute,
      useValue: {
        params: of({ organizationId: ORGANIZATION_ID }),
        data: of({ titleId: "memberAccessReport" }),
        queryParams: of({}),
      },
    },
    { provide: AccountService, useValue: accountService },
    { provide: OrganizationService, useValue: organizationService },
    { provide: CollectionAdminService, useValue: collectionAdminService },
    // UserAdminService is deliberately NOT mocked here. It is
    // `@Injectable({ providedIn: CoreOrganizationModule })`, and the report component lists
    // CoreOrganizationModule in its own `imports`. Letting it resolve for real means this test also
    // fails if that import is ever tidied away as unused — mocking it would hide that.
    { provide: OrganizationMetadataServiceAbstraction, useValue: organizationMetadataService },
    { provide: ConfigService, useValue: configService },
    { provide: I18nService, useValue: i18nService },
    { provide: UserNamePipe, useValue: userNamePipe },
    { provide: MemberAccessReportService, useValue: reportService },
    { provide: GroupApiService, useValue: mock<GroupApiService>() },
    { provide: OrganizationUserApiService, useValue: mock<OrganizationUserApiService>() },
    { provide: OrganizationUserService, useValue: mock<OrganizationUserService>() },
    { provide: ApiService, useValue: mock<ApiService>() },
    { provide: LegacyCompatKeyService, useValue: mock<LegacyCompatKeyService>() },
    { provide: StateProvider, useValue: mock<StateProvider>() },
    {
      provide: OrganizationManagementPreferencesService,
      useValue: mock<OrganizationManagementPreferencesService>(),
    },
    {
      provide: DeleteManagedMemberWarningService,
      useValue: mock<DeleteManagedMemberWarningService>(),
    },
    { provide: ValidationService, useValue: mock<ValidationService>() },
    { provide: ToastService, useValue: mock<ToastService>() },
    { provide: LogService, useValue: mock<LogService>() },
    { provide: FileDownloadService, useValue: mock<FileDownloadService>() },
    { provide: BillingApiServiceAbstraction, useValue: mock<BillingApiServiceAbstraction>() },
    {
      provide: Vfo1TerminologyService,
      useValue: mock<Vfo1TerminologyService>({ enabled: signal(false) }),
    },
  ];
}

describe("MemberAccessReportComponent", () => {
  describe("edit", () => {
    it("opens EditMemberDialogComponent with every dialog dependency resolvable", async () => {
      const routeProviders = memberAccessReportRouteProviders();

      await TestBed.configureTestingModule({
        imports: [MemberAccessReportComponent],
        // TestBed `providers` land in the environment injector — the same kind of injector the
        // router builds for a route's `providers`.
        providers: [...environmentProviders(), ...routeProviders],
      })
        // The dialog's own template drags in tab groups, access selectors and select boxes that are
        // irrelevant here. Its `inject()` calls — the DI surface under test — still all run.
        .overrideComponent(EditMemberDialogComponent, { set: { template: "" } })
        .compileComponents();

      const fixture = TestBed.createComponent(MemberAccessReportComponent);
      const component = fixture.componentInstance;
      component["organizationId"] = ORGANIZATION_ID;
      component["orgIsOnSecretsManagerStandalone"] = false;

      const dialogService = fixture.debugElement.injector.get(DialogService);
      const open = jest.spyOn(dialogService, "open");

      // `edit()` does not settle until the dialog closes. If a dialog dependency cannot be
      // resolved, `EditMemberDialogComponent.open()` throws while `edit()` is still running
      // synchronously, so the returned promise is already rejected by the time we race it.
      const stillOpen = Symbol("dialog still open");
      await expect(
        Promise.race([component.edit(buildRow()), Promise.resolve(stillOpen)]),
      ).resolves.toBe(stillOpen);

      expect(open).toHaveBeenCalledWith(EditMemberDialogComponent, expect.anything());

      // Not merely "open() did not throw" — the dialog component was actually constructed, which
      // means every one of its inject() calls resolved.
      const dialogRef = open.mock.results[0].value as CdkDialogRef<
        MemberDialogResult,
        EditMemberDialogComponent
      >;
      expect(dialogRef.cdkDialogRefBase.componentRef?.instance).toBeInstanceOf(
        EditMemberDialogComponent,
      );

      dialogService.closeAll();
    });
  });

  describe("header", () => {
    it("renders a breadcrumb that navigates back to the reports home page", async () => {
      await TestBed.configureTestingModule({
        imports: [MemberAccessReportComponent],
        providers: [
          ...environmentProviders(),
          ...memberAccessReportRouteProviders(),
          { provide: DialogService, useValue: mock<DialogService>() },
          // Mirrors the real route the report is mounted on, so `../` on the crumb resolves the
          // way it does in the app rather than against the root route.
          provideRouter([
            {
              path: "organizations/:organizationId/reporting/reports",
              children: [{ path: "member-access-report", component: MemberAccessReportComponent }],
            },
          ]),
        ],
      })
        // The rest of the report's template — the real header chain, tables, dialogs — is
        // irrelevant here and drags in the whole web layout. Keep only what renders the crumb.
        .overrideComponent(MemberAccessReportComponent, {
          set: {
            imports: [CommonModule, I18nPipe, Vfo1I18nPipe, BreadcrumbsModule, IconModule],
            schemas: [NO_ERRORS_SCHEMA],
          },
        })
        .compileComponents();

      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(
        `/organizations/${ORGANIZATION_ID}/reporting/reports/member-access-report`,
        MemberAccessReportComponent,
      );

      const breadcrumbs = harness.fixture.debugElement.query(
        By.css("bit-breadcrumbs[slot=breadcrumbs]"),
      );
      expect(breadcrumbs).not.toBeNull();

      const links = breadcrumbs.queryAll(By.css("a[href]"));
      expect(links).toHaveLength(1);
      expect(links[0].nativeElement.getAttribute("href")).toBe(
        `/organizations/${ORGANIZATION_ID}/reporting/reports`,
      );
    });

    it("renders the current page breadcrumb when the VFO1 feature flag is enabled", async () => {
      await TestBed.configureTestingModule({
        imports: [MemberAccessReportComponent],
        providers: [
          ...environmentProviders(),
          ...memberAccessReportRouteProviders(),
          { provide: DialogService, useValue: mock<DialogService>() },
          provideRouter([
            {
              path: "organizations/:organizationId/reporting/reports",
              children: [{ path: "member-access-report", component: MemberAccessReportComponent }],
            },
          ]),
        ],
      })
        .overrideComponent(MemberAccessReportComponent, {
          set: {
            imports: [CommonModule, I18nPipe, Vfo1I18nPipe, BreadcrumbsModule, IconModule],
            schemas: [NO_ERRORS_SCHEMA],
          },
        })
        .compileComponents();

      const configService = TestBed.inject(ConfigService) as MockProxy<ConfigService>;
      configService.getFeatureFlag$.mockReturnValue(of(true));
      const i18nService = TestBed.inject(I18nService) as MockProxy<I18nService>;
      i18nService.t.mockImplementation((key) => key);

      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(
        `/organizations/${ORGANIZATION_ID}/reporting/reports/member-access-report`,
        MemberAccessReportComponent,
      );

      const breadcrumbs = harness.fixture.debugElement.query(
        By.css("bit-breadcrumbs[slot=breadcrumbs]"),
      );
      const crumbs = breadcrumbs.queryAll(By.css("span[bitOverflowItem]"));
      expect(crumbs).toHaveLength(2);
      expect(crumbs[1].nativeElement.textContent.trim()).toBe("memberAccessReport");
    });
  });
});
