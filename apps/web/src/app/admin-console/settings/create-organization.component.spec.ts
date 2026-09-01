import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { of } from "rxjs";

import { InitiationPath, ProductType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Vfo1TerminologyService } from "@bitwarden/vault";

import { OrganizationPlansComponent } from "../../billing";
import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

import { CreateOrganizationComponent } from "./create-organization.component";

@Component({
  selector: "app-header",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockHeaderComponent {}

@Component({
  selector: "app-organization-plans",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockOrganizationPlansComponent {
  readonly enableSecretsManagerByDefault = input<unknown>();
  readonly initialPlan = input<unknown>();
  readonly initialProductTier = input<unknown>();
  readonly trialLength = input<unknown>();
  readonly initiationPath = input<unknown>();
}

@Component({
  selector: "bit-container",
  template: "<ng-content></ng-content>",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockContainerComponent {}

describe("CreateOrganizationComponent", () => {
  function createComponent(queryParams: Record<string, unknown>): CreateOrganizationComponent {
    const route = { queryParams: of(queryParams) } as unknown as ActivatedRoute;
    return new CreateOrganizationComponent(route);
  }

  describe("initiationPath derivation from the product query param", () => {
    it("marks a Password Manager marketing trial when the product param is Password Manager", () => {
      const component = createComponent({ product: `${ProductType.PasswordManager}` });

      component.ngOnInit();

      expect(component["initiationPath"]).toBe(
        InitiationPath.PasswordManagerTrialFromMarketingWebsite,
      );
    });

    it("marks a Secrets Manager marketing trial when the product param is Secrets Manager", () => {
      const component = createComponent({ product: `${ProductType.SecretsManager}` });

      component.ngOnInit();

      expect(component["initiationPath"]).toBe(
        InitiationPath.SecretsManagerTrialFromMarketingWebsite,
      );
    });

    it("stays in-product when no product param is present", () => {
      const component = createComponent({ plan: "teams" });

      component.ngOnInit();

      expect(component["initiationPath"]).toBe(InitiationPath.NewOrganizationCreationInProduct);
    });
  });

  describe("page copy", () => {
    async function renderedText(vfo1Enabled: boolean): Promise<string> {
      const i18nService = { t: (key: string) => key } as unknown as I18nService;

      await TestBed.resetTestingModule()
        .configureTestingModule({
          imports: [CreateOrganizationComponent],
          providers: [
            { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
            { provide: I18nService, useValue: i18nService },
            // The Vfo1I18nPipe rendering the copy injects this service.
            { provide: Vfo1TerminologyService, useValue: { enabled: () => vfo1Enabled } },
          ],
        })
        .overrideComponent(CreateOrganizationComponent, {
          remove: { imports: [SharedModule, OrganizationPlansComponent, HeaderModule] },
          add: {
            imports: [MockHeaderComponent, MockOrganizationPlansComponent, MockContainerComponent],
          },
        })
        .compileComponents();

      const fixture = TestBed.createComponent(CreateOrganizationComponent);
      fixture.detectChanges();
      return fixture.nativeElement.textContent ?? "";
    }

    it("renders the legacy description when the VFO1 foundation flag is off", async () => {
      const text = await renderedText(false);

      expect(text).toContain("newOrganizationDesc");
      expect(text).not.toContain("addPlanDesc");
    });

    it("renders the Add plan description when the VFO1 foundation flag is on", async () => {
      const text = await renderedText(true);

      expect(text).toContain("addPlanDesc");
      expect(text).not.toContain("newOrganizationDesc");
    });
  });
});
