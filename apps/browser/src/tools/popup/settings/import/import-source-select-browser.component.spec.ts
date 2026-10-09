import { ChangeDetectionStrategy, Component, input, NO_ERRORS_SCHEMA, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ImportType } from "@bitwarden/importer-core";
import { I18nPipe } from "@bitwarden/ui-common";

import { ImportSourceSelectBrowserComponent } from "./import-source-select-browser.component";

@Component({
  selector: "importer-source-select",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ImporterSourceSelectStubComponent {
  readonly initialSource = input<ImportType>();
  readonly continue = output<ImportType>();
}

describe("ImportSourceSelectBrowserComponent", () => {
  let fixture: ComponentFixture<ImportSourceSelectBrowserComponent>;
  let router: MockProxy<Router>;

  const setup = async (query: Record<string, string> = {}) => {
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ImportSourceSelectBrowserComponent],
      providers: [
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
        { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
      ],
    })
      .overrideComponent(ImportSourceSelectBrowserComponent, {
        set: {
          imports: [ImporterSourceSelectStubComponent, I18nPipe],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportSourceSelectBrowserComponent);
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

    expect(router.navigate).toHaveBeenCalledWith(["/import-source-select", "keeper"]);
  });
});
