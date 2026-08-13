import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { NEVER, of } from "rxjs";

// The component library modules pulled in by SharedModule use browser observers not available in jsdom
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
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CdkDialogRef, DialogService, ToastService } from "@bitwarden/components";
// Imported only as a DI token to mock out — MemberActionsService injects it. No crypto is used here.
// eslint-disable-next-line no-restricted-imports
import { LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
import { Vfo1TerminologyService } from "@bitwarden/vault";
import {
  GroupApiService,
  UserAdminService,
} from "@bitwarden/web-vault/app/admin-console/organizations/core";
import { EditMemberDialogComponent } from "@bitwarden/web-vault/app/admin-console/organizations/members/components/edit-member-dialog";
import { DeleteManagedMemberWarningService } from "@bitwarden/web-vault/app/admin-console/organizations/members/services";

import { MemberAccessReportComponent } from "./member-access-report.component";
import { MemberAccessReportService } from "./services/member-access-report.service";
import { MemberAccessReportView } from "./view/member-access-report.view";

const ORGANIZATION_ID = "org-id" as OrganizationId;

function buildRow(): MemberAccessReportView {
  return {
    name: "Test User",
    email: "test@example.com",
    avatarColor: "#000000",
    collectionsCount: 0,
    groupsCount: 0,
    itemsCount: 0,
    userGuid: "org-user-id" as MemberAccessReportView["userGuid"],
    usesKeyConnector: false,
    userIdFromOrgUser: "user-id",
  };
}

/**
 * Every dependency EditMemberDialogComponent (and the services it injects) needs, mocked at the
 * environment-injector level — i.e. everything the running app gets from `providedIn: "root"` or
 * from a module imported at bootstrap.
 *
 * MemberActionsService, MemberDialogManagerService and BillingConstraintService are deliberately
 * absent, and nothing here stands in for MembersModule. They are the subject of this test: the
 * dialog has to bring them itself, because this page cannot.
 */
function environmentProviders() {
  const accountService = mock<AccountService>();
  accountService.activeAccount$ = of({ id: "user-id" } as any);

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

  const userAdminService = mock<UserAdminService>();
  userAdminService.get.mockResolvedValue(undefined);

  const organizationMetadataService = mock<OrganizationMetadataServiceAbstraction>();
  organizationMetadataService.getOrganizationMetadata$.mockReturnValue(
    of({
      organizationOccupiedSeats: 0,
      isOnSecretsManagerStandalone: false,
    } as OrganizationBillingMetadataResponse),
  );

  const configService = mock<ConfigService>();
  configService.getFeatureFlag.mockResolvedValue(false);

  const i18nService = mock<I18nService>();
  i18nService.t.mockReturnValue("translated");

  const userNamePipe = mock<UserNamePipe>();
  userNamePipe.transform.mockReturnValue("Test User");

  return [
    provideNoopAnimations(),
    {
      provide: ActivatedRoute,
      useValue: {
        params: of({ organizationId: ORGANIZATION_ID }),
        // HeaderComponent, rendered by the report template, reads `data`.
        data: of({ titleId: "memberAccessReport" }),
        queryParams: of({}),
      },
    },
    // DialogService and DrawerService inject Router non-optionally, subscribe to `events` and
    // read `url` on construction.
    { provide: Router, useValue: mock<Router>({ events: NEVER, url: "/" }) },
    { provide: AccountService, useValue: accountService },
    { provide: OrganizationService, useValue: organizationService },
    { provide: CollectionAdminService, useValue: collectionAdminService },
    { provide: UserAdminService, useValue: userAdminService },
    { provide: OrganizationMetadataServiceAbstraction, useValue: organizationMetadataService },
    { provide: ConfigService, useValue: configService },
    { provide: I18nService, useValue: i18nService },
    { provide: UserNamePipe, useValue: userNamePipe },
    { provide: GroupApiService, useValue: mock<GroupApiService>() },
    { provide: OrganizationUserApiService, useValue: mock<OrganizationUserApiService>() },
    { provide: OrganizationUserService, useValue: mock<OrganizationUserService>() },
    { provide: ApiService, useValue: mock<ApiService>() },
    { provide: LegacyCompatKeyService, useValue: mock<LegacyCompatKeyService>() },
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
    { provide: MemberAccessReportService, useValue: mock<MemberAccessReportService>() },
    {
      provide: Vfo1TerminologyService,
      useValue: { enabled: () => false, iconClass: (icon: string) => icon },
    },
  ];
}

describe("MemberAccessReportComponent", () => {
  afterEach(() => TestBed.resetTestingModule());

  describe("edit", () => {
    // Guards PM-41880: the report is not under MembersModule, so any dependency the dialog needs
    // that is neither root-provided nor in the dialog's own `providers` breaks this page — and only
    // at the moment a user clicks a member. This test fails instead.
    it("opens EditMemberDialogComponent with every dialog dependency resolvable", async () => {
      await TestBed.configureTestingModule({
        imports: [MemberAccessReportComponent],
        providers: environmentProviders(),
      })
        // The dialog's own template drags in tab groups, access selectors and select boxes that
        // have nothing to do with this test. Its `inject()` calls — the DI surface under test —
        // still run in full.
        .overrideComponent(EditMemberDialogComponent, { set: { template: "" } })
        .compileComponents();

      const fixture = TestBed.createComponent(MemberAccessReportComponent);
      const component = fixture.componentInstance;
      (component as any).organizationId = ORGANIZATION_ID;
      (component as any).orgIsOnSecretsManagerStandalone = false;

      const open = jest.spyOn(DialogService.prototype, "open");

      // `edit()` does not settle until the dialog closes. If a dialog dependency cannot be
      // resolved, `EditMemberDialogComponent.open()` throws while `edit()` is still running
      // synchronously, so the returned promise is already rejected by the time we race it.
      const stillOpen = Symbol("dialog still open");
      await expect(
        Promise.race([component.edit(buildRow()), Promise.resolve(stillOpen)]),
      ).resolves.toBe(stillOpen);

      // Not merely "open() did not throw" — the dialog component was actually constructed, which
      // means every one of its inject() calls resolved. `componentRef` rather than
      // `componentInstance`: jsdom never runs an ApplicationRef tick, so the overlay detaches
      // straight away and CDK nulls `componentInstance` on detach.
      expect(open).toHaveBeenCalledWith(EditMemberDialogComponent, expect.anything());
      const dialogRef = open.mock.results[0].value as CdkDialogRef<unknown, unknown>;
      expect(dialogRef.cdkDialogRefBase.componentRef?.instance).toBeInstanceOf(
        EditMemberDialogComponent,
      );

      fixture.debugElement.injector.get(DialogService).closeAll();
    });
  });
});
