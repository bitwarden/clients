import { CommonModule } from "@angular/common";
import { NO_ERRORS_SCHEMA, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, provideRouter, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { Vfo1I18nPipe, Vfo1TerminologyService } from "@bitwarden/vault";

import { ReportsHomeComponent } from "./reports-home.component";

describe("ReportsHomeComponent", () => {
  let fixture: ComponentFixture<ReportsHomeComponent>;
  let router: Router;
  let organizationService: MockProxy<OrganizationService>;
  const userId = Utils.newGuid() as UserId;
  const organizationId = Utils.newGuid() as OrganizationId;

  beforeEach(async () => {
    organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(
      of([{ id: organizationId, productTierType: ProductTierType.Enterprise } as Organization]),
    );

    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(false));

    await TestBed.configureTestingModule({
      declarations: [ReportsHomeComponent],
      imports: [CommonModule, Vfo1I18nPipe],
      providers: [
        provideRouter([{ path: "**", children: [] }]),
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId }) },
        },
        { provide: OrganizationService, useValue: organizationService },
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
        { provide: ConfigService, useValue: configService },
        { provide: I18nService, useValue: mock<I18nService>() },
        {
          provide: Vfo1TerminologyService,
          useValue: mock<Vfo1TerminologyService>({ enabled: signal(false) }),
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(ReportsHomeComponent);
  });

  it("lists the reports on the reports home page", async () => {
    await router.navigateByUrl(`/organizations/${organizationId}/reports`);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector("app-report-list")).not.toBeNull();
  });

  it("hides the report list once an individual report is open", async () => {
    await router.navigateByUrl(`/organizations/${organizationId}/reports/weak-passwords`);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector("app-report-list")).toBeNull();
  });

  it("does not render a back to reports button once a report is open", async () => {
    await router.navigateByUrl(`/organizations/${organizationId}/reports/weak-passwords`);
    fixture.detectChanges();

    // This component used to attach a floating "Back to reports" link through a CDK overlay, which
    // renders into the document body rather than into the fixture. Reports now navigate back via
    // the breadcrumb in their own header instead.
    expect(document.querySelector(".cdk-overlay-container")).toBeNull();
    expect(fixture.nativeElement.querySelector("a")).toBeNull();
  });
});
