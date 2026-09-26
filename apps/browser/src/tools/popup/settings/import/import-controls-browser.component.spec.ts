import { ChangeDetectionStrategy, Component, input, NO_ERRORS_SCHEMA, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ImportType } from "@bitwarden/importer-core";
import { I18nPipe } from "@bitwarden/ui-common";

import { ImportControlsBrowserComponent } from "./import-controls-browser.component";

@Component({
  selector: "importer-controls",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ImporterControlsStubComponent {
  readonly importType = input.required<ImportType>();
  readonly back = output<void>();
  readonly continue = output<void>();
}

describe("ImportControlsBrowserComponent", () => {
  let fixture: ComponentFixture<ImportControlsBrowserComponent>;
  let router: MockProxy<Router>;

  const setup = async (importTypeParam: string) => {
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ImportControlsBrowserComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ importType: importTypeParam }) },
            paramMap: of(convertToParamMap({ importType: importTypeParam })),
          },
        },
      ],
    })
      .overrideComponent(ImportControlsBrowserComponent, {
        set: {
          imports: [ImporterControlsStubComponent, I18nPipe],
          providers: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportControlsBrowserComponent);
    fixture.detectChanges();
  };

  it("reads the vendor from the route and passes it to the controls component", async () => {
    await setup("keeper");

    const stub = fixture.debugElement.query(By.directive(ImporterControlsStubComponent))
      .componentInstance as ImporterControlsStubComponent;
    expect(stub.importType()).toBe("keeper");
  });

  it("navigates back to Select source when the controls component emits back", async () => {
    await setup("keeper");

    fixture.debugElement.query(By.css("importer-controls")).triggerEventHandler("back", undefined);

    expect(router.navigate).toHaveBeenCalledWith(["/import-source-select"]);
  });
});
