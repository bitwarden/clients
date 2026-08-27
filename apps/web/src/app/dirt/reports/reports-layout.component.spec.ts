import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter, Router, RouterOutlet } from "@angular/router";

import { ReportsLayoutComponent } from "./reports-layout.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-stub-report",
  template: "<p>a report</p>",
})
class StubReportComponent {}

describe("ReportsLayoutComponent", () => {
  let fixture: ComponentFixture<ReportsLayoutComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ReportsLayoutComponent],
      imports: [RouterOutlet],
      providers: [
        provideRouter([
          {
            path: "reports",
            component: ReportsLayoutComponent,
            children: [{ path: "weak-passwords", component: StubReportComponent }],
          },
        ]),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(ReportsLayoutComponent);
    fixture.detectChanges();
  });

  it("renders the routed report", async () => {
    await router.navigateByUrl("/reports/weak-passwords");
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.directive(StubReportComponent))).not.toBeNull();
  });

  it("does not render a back to reports button once a report is open", async () => {
    await router.navigateByUrl("/reports/weak-passwords");
    fixture.detectChanges();

    // The layout used to attach a floating "Back to reports" link through a CDK overlay, which
    // renders into the document body rather than into the fixture. Reports now navigate back via
    // the breadcrumb in their own header instead.
    expect(document.querySelector(".cdk-overlay-container")).toBeNull();
    expect(fixture.nativeElement.querySelector("a")).toBeNull();
  });
});
