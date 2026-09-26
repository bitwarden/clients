import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router } from "@angular/router";
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
  readonly continue = output<ImportType>();
}

describe("ImportSourceSelectBrowserComponent", () => {
  let fixture: ComponentFixture<ImportSourceSelectBrowserComponent>;
  let router: MockProxy<Router>;

  beforeEach(async () => {
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ImportSourceSelectBrowserComponent],
      providers: [
        { provide: Router, useValue: router },
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
  });

  it("navigates to the chosen vendor's Import data route when the picker emits continue", () => {
    fixture.debugElement
      .query(By.css("importer-source-select"))
      .triggerEventHandler("continue", "keeper");

    expect(router.navigate).toHaveBeenCalledWith(["/import", "keeper"]);
  });
});
