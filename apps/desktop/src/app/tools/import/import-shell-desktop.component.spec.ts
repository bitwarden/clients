import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, NavigationEnd, NavigationStart, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ProgressBarComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ImportShellDesktopComponent } from "./import-shell-desktop.component";

@Component({
  selector: "app-header",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HeaderStubComponent {}

@Component({
  selector: "router-outlet",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class RouterOutletStubComponent {}

describe("ImportShellDesktopComponent", () => {
  let fixture: ComponentFixture<ImportShellDesktopComponent>;
  let routerEvents: Subject<unknown>;
  let firstChildPath: string;

  const setup = async () => {
    routerEvents = new Subject();
    const router = { events: routerEvents.asObservable() } as unknown as Router;
    // A getter, not a plain property: isStepTwoSnapshot() re-reads this on every router event, so
    // the reactive-update test needs it to reflect firstChildPath's *current* value, not whatever
    // it was when setup() ran.
    const route = {
      snapshot: {
        get firstChild() {
          return { routeConfig: { path: firstChildPath } };
        },
      },
    } as unknown as ActivatedRoute;

    await TestBed.configureTestingModule({
      imports: [ImportShellDesktopComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: route },
        { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
      ],
    })
      .overrideComponent(ImportShellDesktopComponent, {
        set: {
          imports: [
            HeaderStubComponent,
            RouterOutletStubComponent,
            ProgressBarComponent,
            TypographyModule,
            I18nPipe,
          ],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportShellDesktopComponent);
    fixture.detectChanges();
  };

  const component = () => fixture.componentInstance;

  it("reports step 1 when the active child route is the empty step-1 path, synchronously from the snapshot", async () => {
    firstChildPath = "";
    await setup();

    expect(component()["currentStep"]()).toBe(1);
    expect(component()["progressValue"]()).toBeCloseTo((1 / 2) * 100);
    expect(component()["headingKey"]()).toBe("importSourceBreadcrumb");
  });

  it("reports step 2 when the active child route is the :importType path, synchronously from the snapshot", async () => {
    firstChildPath = ":importType";
    await setup();

    expect(component()["currentStep"]()).toBe(2);
    expect(component()["progressValue"]()).toBeCloseTo((2 / 2) * 100);
    expect(component()["headingKey"]()).toBe("importData");
  });

  it("updates reactively when the router navigates between steps", async () => {
    firstChildPath = "";
    await setup();
    expect(component()["currentStep"]()).toBe(1);

    firstChildPath = ":importType";
    routerEvents.next(new NavigationEnd(1, "/import/keeper", "/import/keeper"));
    fixture.detectChanges();

    expect(component()["currentStep"]()).toBe(2);
    expect(component()["headingKey"]()).toBe("importData");
  });

  it("ignores NavigationStart — only NavigationEnd should update the step", async () => {
    firstChildPath = "";
    await setup();

    firstChildPath = ":importType";
    routerEvents.next(new NavigationStart(1, "/import/keeper"));
    fixture.detectChanges();

    expect(component()["currentStep"]()).toBe(1);
  });
});
