import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of, Subject } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";

import { ServiceAccountView } from "../models/view/service-account.view";
import { AccessPolicyService } from "../shared/access-policies/access-policy.service";
import { CountService } from "../shared/counts/count.service";

import { AccessService } from "./access/access.service";
import { ServiceAccountComponent } from "./service-account.component";
import { ServiceAccountService } from "./service-account.service";

describe("ServiceAccountComponent", () => {
  const organizationId = "org-1" as OrganizationId;
  const userId = "user-1" as UserId;

  let fixture: ComponentFixture<ServiceAccountComponent>;
  let organizationService: MockProxy<OrganizationService>;

  function createComponent(organizations: Partial<Organization>[]) {
    organizationService.organizations$.mockReturnValue(of(organizations as Organization[]));

    // `useEvents` subscribes as soon as the component is built, so there is no
    // need to run change detection or ngOnInit for these tests.
    fixture = TestBed.createComponent(ServiceAccountComponent);
    return fixture.componentInstance;
  }

  beforeEach(async () => {
    organizationService = mock<OrganizationService>();

    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(false));

    await TestBed.configureTestingModule({
      declarations: [ServiceAccountComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId, serviceAccountId: "sa-1" }) },
        },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: userId } as Account) },
        },
        { provide: OrganizationService, useValue: organizationService },
        { provide: ConfigService, useValue: configService },
        {
          provide: ServiceAccountService,
          useValue: mock<ServiceAccountService>({
            serviceAccount$: new Subject<ServiceAccountView>(),
          }),
        },
        { provide: AccessPolicyService, useValue: mock<AccessPolicyService>() },
        { provide: AccessService, useValue: mock<AccessService>() },
        { provide: CountService, useValue: mock<CountService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
      ],
    })
      // The real template pulls in the tab bar and header. Those are not under test here.
      .overrideTemplate(ServiceAccountComponent, "")
      .compileComponents();
  });

  describe("useEvents", () => {
    it("is true when the organization in the route has events enabled", () => {
      const component = createComponent([{ id: organizationId, useEvents: true }]);

      expect(component["useEvents"]()).toBe(true);
      expect(organizationService.organizations$).toHaveBeenCalledWith(userId);
    });

    it("is false when the organization in the route has events disabled", () => {
      const component = createComponent([{ id: organizationId, useEvents: false }]);

      expect(component["useEvents"]()).toBe(false);
    });

    it("is false when the organization in the route is not found", () => {
      const component = createComponent([{ id: "other-org" as OrganizationId, useEvents: true }]);

      expect(component["useEvents"]()).toBe(false);
    });
  });
});
