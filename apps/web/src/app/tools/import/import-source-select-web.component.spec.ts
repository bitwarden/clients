import { ChangeDetectionStrategy, Component, input, NO_ERRORS_SCHEMA, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ImportType } from "@bitwarden/importer-core";

import { ImportSourceSelectWebComponent } from "./import-source-select-web.component";

@Component({
  selector: "importer-source-select",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ImporterSourceSelectStubComponent {
  readonly initialSource = input<ImportType>();
  readonly continue = output<ImportType>();
}

describe("ImportSourceSelectWebComponent", () => {
  let fixture: ComponentFixture<ImportSourceSelectWebComponent>;
  let router: MockProxy<Router>;

  const orgId = "5bb2e4b0-5d4e-4a58-9a6a-3a5f5b8c2f11";

  const setup = async (query: Record<string, string> = {}, organizationId?: string) => {
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ImportSourceSelectWebComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: AccountService, useValue: mock<AccountService>() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(query),
              paramMap: convertToParamMap(organizationId == null ? {} : { organizationId }),
            },
          },
        },
      ],
    })
      .overrideComponent(ImportSourceSelectWebComponent, {
        set: { imports: [ImporterSourceSelectStubComponent], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportSourceSelectWebComponent);
    fixture.detectChanges();
  };

  const stub = () =>
    fixture.debugElement.query(By.directive(ImporterSourceSelectStubComponent))
      .componentInstance as ImporterSourceSelectStubComponent;

  it("passes a valid source query param to the picker as the initial source", async () => {
    await setup({ source: "keeper" });

    expect(stub().initialSource()).toBe("keeper");
  });

  it("ignores an invalid source query param", async () => {
    await setup({ source: "not-a-real-vendor" });

    expect(stub().initialSource()).toBeUndefined();
  });

  it("navigates to the chosen vendor's Import data route when the picker emits continue", async () => {
    await setup();

    fixture.debugElement
      .query(By.css("importer-source-select"))
      .triggerEventHandler("continue", "keeper");

    expect(router.navigate).toHaveBeenCalledWith(["/tools/import", "keeper"]);
  });

  it("keeps returnTo in the URL when continuing", async () => {
    await setup({ returnTo: "access-intelligence" }, orgId);

    fixture.debugElement
      .query(By.css("importer-source-select"))
      .triggerEventHandler("continue", "keeper");

    expect(router.navigate).toHaveBeenCalledWith(
      ["/organizations", orgId, "settings", "tools", "import", "keeper"],
      { queryParams: { returnTo: "access-intelligence" } },
    );
  });

  it("navigates under the organization's admin console when the route has an organization", async () => {
    await setup({}, orgId);

    fixture.debugElement
      .query(By.css("importer-source-select"))
      .triggerEventHandler("continue", "keeper");

    expect(router.navigate).toHaveBeenCalledWith([
      "/organizations",
      orgId,
      "settings",
      "tools",
      "import",
      "keeper",
    ]);
  });
});
