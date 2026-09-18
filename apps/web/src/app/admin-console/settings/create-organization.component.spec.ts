import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";

import { InitiationPath, ProductType } from "@bitwarden/common/billing/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { OrganizationPlansComponent } from "../../billing";
import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

import { CreateOrganizationComponent } from "./create-organization.component";

@Component({
  selector: "app-header",
  template: '<ng-content select="[slot=breadcrumbs]"></ng-content>',
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
  // The VFO1 flag drives both the page copy and the breadcrumbs — `Vfo1TerminologyService` reads
  // it from ConfigService too — so each nested describe sets it before rendering.
  const vfo1Enabled = new BehaviorSubject(false);
  const getFeatureFlag$ = jest.fn(() => vfo1Enabled);

  beforeEach(async () => {
    vfo1Enabled.next(false);
    getFeatureFlag$.mockClear();

    await TestBed.configureTestingModule({
      imports: [CreateOrganizationComponent, RouterModule.forRoot([])],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: ConfigService, useValue: { getFeatureFlag$ } },
      ],
    })
      .overrideComponent(CreateOrganizationComponent, {
        remove: { imports: [SharedModule, OrganizationPlansComponent, HeaderModule] },
        add: {
          imports: [
            MockHeaderComponent,
            MockOrganizationPlansComponent,
            MockContainerComponent,
            I18nPipe,
          ],
        },
      })
      .compileComponents();
  });

  function render(): ComponentFixture<CreateOrganizationComponent> {
    const fixture = TestBed.createComponent(CreateOrganizationComponent);
    fixture.detectChanges();
    return fixture;
  }

  // `showBreadcrumbs` uses `toSignal`, which requires an injection context, so build the
  // component inside one rather than calling the constructor bare.
  function createComponent(queryParams: Record<string, unknown>): CreateOrganizationComponent {
    const route = { queryParams: of(queryParams) } as unknown as ActivatedRoute;
    return TestBed.runInInjectionContext(
      () => new CreateOrganizationComponent(route, TestBed.inject(ConfigService)),
    );
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
    function renderedText(): string {
      return render().nativeElement.textContent ?? "";
    }

    it("renders the legacy description when the VFO1 foundation flag is off", () => {
      const text = renderedText();

      expect(text).toContain("newOrganizationDesc");
      expect(text).not.toContain("addPlanDesc");
    });

    it("renders the Add plan description when the VFO1 foundation flag is on", () => {
      vfo1Enabled.next(true);

      const text = renderedText();

      expect(text).toContain("addPlanDesc");
      expect(text).not.toContain("newOrganizationDesc");
    });
  });

  describe("breadcrumbs", () => {
    function renderBreadcrumbs() {
      return render().debugElement.query(By.css("bit-breadcrumbs[slot=breadcrumbs]"));
    }

    it("renders a header breadcrumb that navigates back to settings", () => {
      vfo1Enabled.next(true);

      const breadcrumbs = renderBreadcrumbs();
      expect(breadcrumbs).not.toBeNull();

      const links = breadcrumbs.queryAll(By.css("a[href]"));
      expect(links).toHaveLength(1);
      expect(links[0].nativeElement.getAttribute("href")).toBe("/settings");
    });

    it("renders the current page breadcrumb when the VFO1 feature flag is enabled", () => {
      vfo1Enabled.next(true);

      const crumbs = renderBreadcrumbs().queryAll(By.css("span[bitOverflowItem]"));
      expect(crumbs).toHaveLength(2);
      expect(crumbs[1].nativeElement.textContent.trim()).toBe("addPlan");
    });

    it("renders no breadcrumbs when the VFO1 feature flag is disabled", () => {
      expect(renderBreadcrumbs()).toBeNull();
    });
  });
});
