import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ImportShellWebComponent } from "./import-shell-web.component";

@Component({
  selector: "app-header",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HeaderStubComponent {}

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

describe("ImportShellWebComponent", () => {
  let fixture: ComponentFixture<ImportShellWebComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportShellWebComponent],
    })
      .overrideComponent(ImportShellWebComponent, {
        set: {
          imports: [
            HeaderStubComponent,
            ImportShellProgressStubComponent,
            RouterOutletStubComponent,
          ],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportShellWebComponent);
    fixture.detectChanges();
  });

  it("renders the page header, the shared step progress, and a router outlet for its children", () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector("app-header")).toBeTruthy();
    expect(element.querySelector("importer-shell-progress")).toBeTruthy();
    expect(element.querySelector("router-outlet")).toBeTruthy();
  });
});
