import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ToastService } from "@bitwarden/components";

import { GrantedProjectAccessPolicyView } from "../../models/view/access-policies/access-policy.view";
import {
  GrantedProjectPolicyPermissionDetailsView,
  ServiceAccountGrantedPoliciesView,
} from "../../models/view/access-policies/service-account-granted-policies.view";
import { AccessPolicyService } from "../../shared/access-policies/access-policy.service";

import { ServiceAccountProjectsComponent } from "./service-account-projects.component";

const ORGANIZATION_ID = "org-1";
const SERVICE_ACCOUNT_ID = "machine-account-1";

/**
 * `submit` is the only member this suite drives, and the component keeps it `protected` so just
 * its template can reach it. Reaching it through a structural view keeps the component's own
 * visibility modifiers intact.
 */
interface ComponentInternals {
  submit: () => Promise<void>;
}

const internals = (component: ServiceAccountProjectsComponent) =>
  component as unknown as ComponentInternals;

/**
 * `ngOnInit` resolves its grantees and granted policies through promises inside `switchMap`, so
 * the component has no selection until those settle. Without this the suite would drive `submit`
 * against a half-initialized component.
 */
const flushPromises = () => new Promise(process.nextTick);

function grantedPolicies(write = false): ServiceAccountGrantedPoliciesView {
  const policy = new GrantedProjectAccessPolicyView();
  policy.grantedProjectId = "project-1";
  policy.grantedProjectName = "Production";
  policy.read = true;
  policy.write = write;

  const details = new GrantedProjectPolicyPermissionDetailsView();
  details.accessPolicy = policy;
  details.hasPermission = true;

  const view = new ServiceAccountGrantedPoliciesView();
  view.grantedProjectPolicies = [details];
  return view;
}

describe("ServiceAccountProjectsComponent", () => {
  let fixture: ComponentFixture<ServiceAccountProjectsComponent>;
  let accessPolicyService: MockProxy<AccessPolicyService>;
  let i18nService: MockProxy<I18nService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let toastService: MockProxy<ToastService>;
  let validationService: MockProxy<ValidationService>;

  async function setup() {
    await TestBed.configureTestingModule({
      declarations: [ServiceAccountProjectsComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({
              organizationId: ORGANIZATION_ID,
              serviceAccountId: SERVICE_ACCOUNT_ID,
            }),
          },
        },
        { provide: AccessPolicyService, useValue: accessPolicyService },
        { provide: I18nService, useValue: i18nService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: ToastService, useValue: toastService },
        { provide: ValidationService, useValue: validationService },
      ],
    })
      .overrideComponent(ServiceAccountProjectsComponent, { set: { template: "" } })
      .compileComponents();

    fixture = TestBed.createComponent(ServiceAccountProjectsComponent);
    fixture.componentInstance.ngOnInit();
    await flushPromises();
    return internals(fixture.componentInstance);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();

    accessPolicyService = mock<AccessPolicyService>();
    i18nService = mock<I18nService>();
    platformUtilsService = mock<PlatformUtilsService>();
    toastService = mock<ToastService>();
    validationService = mock<ValidationService>();

    // Echoing the key lets the assertions below pin the i18n key itself rather than the
    // translated copy, which is what the Service Account -> Machine Account rename got wrong.
    i18nService.t.mockImplementation((key: string) => key);

    accessPolicyService.getProjectsPotentialGrantees.mockResolvedValue([]);
    accessPolicyService.getServiceAccountGrantedPolicies.mockResolvedValue(grantedPolicies());
    accessPolicyService.putServiceAccountGrantedPolicies.mockResolvedValue(grantedPolicies(true));
  });

  describe("submit", () => {
    it("saves the granted policies against the machine account in the route", async () => {
      const component = await setup();

      await component.submit();

      expect(accessPolicyService.putServiceAccountGrantedPolicies).toHaveBeenCalledWith(
        ORGANIZATION_ID,
        SERVICE_ACCOUNT_ID,
        expect.any(ServiceAccountGrantedPoliciesView),
      );
    });

    it("confirms with the machine account toast, not the legacy service account one", async () => {
      const component = await setup();

      await component.submit();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "machineAccountAccessUpdated" }),
      );
      expect(toastService.showToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: "serviceAccountAccessUpdated" }),
      );
    });

    it("surfaces the error and shows no toast when the save fails", async () => {
      const error = new Error("save failed");
      accessPolicyService.putServiceAccountGrantedPolicies.mockRejectedValue(error);
      const component = await setup();

      await component.submit();

      expect(validationService.showError).toHaveBeenCalledWith(error);
      expect(toastService.showToast).not.toHaveBeenCalled();
    });
  });
});
