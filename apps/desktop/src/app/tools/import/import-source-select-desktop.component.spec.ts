import { ChangeDetectionStrategy, Component, input, NO_ERRORS_SCHEMA, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { ImportType } from "@bitwarden/importer-core";

import { ImportSourceSelectDesktopComponent } from "./import-source-select-desktop.component";

@Component({
  selector: "importer-source-select",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ImporterSourceSelectStubComponent {
  readonly initialSource = input<ImportType>();
  readonly continue = output<ImportType>();
}

describe("ImportSourceSelectDesktopComponent", () => {
  let fixture: ComponentFixture<ImportSourceSelectDesktopComponent>;
  let router: MockProxy<Router>;

  const setup = async (query: Record<string, string> = {}) => {
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ImportSourceSelectDesktopComponent],
      providers: [
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
      ],
    })
      .overrideComponent(ImportSourceSelectDesktopComponent, {
        set: { imports: [ImporterSourceSelectStubComponent], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportSourceSelectDesktopComponent);
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

    expect(router.navigate).toHaveBeenCalledWith(["/import", "keeper"]);
  });
});
