import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ImportShellBrowserComponent } from "./import-shell-browser.component";

@Component({
  selector: "popup-page",
  template: "<ng-content></ng-content>",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class PopupPageStubComponent {}

@Component({ selector: "bit-svg", template: "", changeDetection: ChangeDetectionStrategy.OnPush })
class SvgStubComponent {}

@Component({
  selector: "importer-shell-progress",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ImportShellProgressStubComponent {}

@Component({
  selector: "router-outlet",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class RouterOutletStubComponent {}

describe("ImportShellBrowserComponent", () => {
  let fixture: ComponentFixture<ImportShellBrowserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportShellBrowserComponent],
      providers: [
        { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
      ],
    })
      .overrideComponent(ImportShellBrowserComponent, {
        set: {
          imports: [
            PopupPageStubComponent,
            SvgStubComponent,
            TypographyModule,
            I18nPipe,
            ImportShellProgressStubComponent,
            RouterOutletStubComponent,
          ],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportShellBrowserComponent);
    fixture.detectChanges();
  });

  it("renders the logo, the shared step progress, and a router outlet for its children", () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector("bit-svg")).toBeTruthy();
    expect(element.querySelector("importer-shell-progress")).toBeTruthy();
    expect(element.querySelector("router-outlet")).toBeTruthy();
  });
});
