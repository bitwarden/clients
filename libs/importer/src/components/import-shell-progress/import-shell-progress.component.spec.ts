import { LiveAnnouncer } from "@angular/cdk/a11y";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NO_ERRORS_SCHEMA,
  signal,
} from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import {
  ActivatedRoute,
  NavigationEnd,
  NavigationStart,
  provideRouter,
  Router,
  RouterOutlet,
} from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject, throwError } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ProgressBarComponent, ScrollLayoutService, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ImportDestinationKind, ImportDestinations } from "../../models";
import { ImportDestinationServiceAbstraction } from "../../services";
import { IMPORT_DESTINATION_ROUTE_PATH } from "../import-destination/import-destination-route";

import { ImportShellProgressComponent } from "./import-shell-progress.component";

const noStep: ImportDestinations = { options: [], hasStep: false };
const withStep: ImportDestinations = {
  options: [
    {
      id: "myVault",
      kind: ImportDestinationKind.MyVault,
      sharedFolders: [],
      restrictions: [],
      removedTypes: [],
    },
  ],
  hasStep: true,
};
const withMyItems: ImportDestinations = {
  options: [
    {
      id: "myItems:a",
      kind: ImportDestinationKind.MyItems,
      sharedFolders: [],
      restrictions: [],
      removedTypes: [],
    },
  ],
  hasStep: true,
};

describe("ImportShellProgressComponent", () => {
  let fixture: ComponentFixture<ImportShellProgressComponent>;
  let routerEvents: Subject<unknown>;
  let hasImportTypeParam: boolean;
  let onDestinationRoute: boolean;
  let destinations$: BehaviorSubject<ImportDestinations>;
  let destinationService: MockProxy<ImportDestinationServiceAbstraction>;
  let liveAnnouncer: MockProxy<LiveAnnouncer>;
  let scrollElement: HTMLElement;

  beforeEach(() => {
    onDestinationRoute = false;
    destinations$ = new BehaviorSubject<ImportDestinations>(noStep);
    // Assigned after mock(): a property passed to mock() is wrapped and its subscribe goes silent.
    destinationService = Object.assign(mock<ImportDestinationServiceAbstraction>(), {
      destinations$: destinations$.asObservable(),
    });
  });

  const setup = async () => {
    routerEvents = new Subject();
    // Mirrors the real Router: by the time this component is constructed, `router.url` already
    // reflects the current page (committed on BeforeActivateRoutes, before ActivateRoutes
    // constructs anything) — the arrival-announce dedup logic is seeded from this value.
    const router = {
      events: routerEvents.asObservable(),
      url: hasImportTypeParam ? "/import/keeper" : "/import",
    } as unknown as Router;
    // A getter, not a plain property: isStepTwoSnapshot() re-reads this on every router event, so
    // the reactive-update test needs it to reflect hasImportTypeParam's *current* value, not
    // whatever it was when setup() ran.
    const route = {
      snapshot: {
        get firstChild() {
          return {
            paramMap: { has: (key: string) => key === "importType" && hasImportTypeParam },
            routeConfig: {
              path: onDestinationRoute ? IMPORT_DESTINATION_ROUTE_PATH : ":importType",
            },
          };
        },
      },
    } as unknown as ActivatedRoute;

    liveAnnouncer = mock<LiveAnnouncer>();

    scrollElement = document.createElement("div");
    scrollElement.scrollTo = jest.fn();
    const scrollLayout = {
      scrollableRef: signal({ nativeElement: scrollElement } as ElementRef<HTMLElement>),
    } as unknown as ScrollLayoutService;

    await TestBed.configureTestingModule({
      imports: [ImportShellProgressComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: route },
        { provide: ImportDestinationServiceAbstraction, useValue: destinationService },
        { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
        { provide: LiveAnnouncer, useValue: liveAnnouncer },
        { provide: ScrollLayoutService, useValue: scrollLayout },
      ],
    })
      .overrideComponent(ImportShellProgressComponent, {
        set: {
          imports: [ProgressBarComponent, TypographyModule, I18nPipe],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportShellProgressComponent);
    fixture.detectChanges();
  };

  const component = () => fixture.componentInstance;

  it("reports step 1 when the active child route has no importType param, synchronously from the snapshot", async () => {
    hasImportTypeParam = false;
    await setup();

    expect(component()["currentStep"]()).toBe(1);
    expect(component()["progressValue"]()).toBeCloseTo((1 / 2) * 100);
    expect(component()["headingKey"]()).toBe("importSourceBreadcrumb");
  });

  it("renders the step heading as a real <h2>, not a plain paragraph, so heading navigation finds it", async () => {
    hasImportTypeParam = false;
    await setup();

    const heading: HTMLElement = fixture.nativeElement.querySelector("h2");
    expect(heading).toBeTruthy();
    expect(heading.textContent?.trim()).toBe("importSourceBreadcrumb");
  });

  it("announces the current step once on initial render, so arrival is never silent regardless of entry path", async () => {
    hasImportTypeParam = false;
    await setup();

    expect(liveAnnouncer.announce).toHaveBeenCalledTimes(1);
    expect(liveAnnouncer.announce).toHaveBeenCalledWith(
      "importSourceBreadcrumb, importSourceStepCount",
      "polite",
    );
  });

  it("announces the new heading and step count, politely, on a step transition", async () => {
    hasImportTypeParam = false;
    await setup();

    hasImportTypeParam = true;
    routerEvents.next(new NavigationEnd(1, "/import/keeper", "/import/keeper"));
    fixture.detectChanges();

    expect(liveAnnouncer.announce).toHaveBeenCalledWith(
      "importData, importSourceStepCount",
      "polite",
    );
  });

  it("does not re-announce on a same-URL navigation (e.g. the browser popup's onSameUrlNavigation: reload)", async () => {
    hasImportTypeParam = true;
    await setup();

    routerEvents.next(new NavigationEnd(1, "/import/keeper", "/import/keeper"));
    routerEvents.next(new NavigationEnd(2, "/import/keeper", "/import/keeper"));
    fixture.detectChanges();

    // Just the one arrival announce from construction — both events match the router's
    // already-current URL (the seed), so neither reaches the subscriber.
    expect(liveAnnouncer.announce).toHaveBeenCalledTimes(1);
  });

  it("does not reset scroll on initial render — a fresh mount never has stale scroll to begin with", async () => {
    hasImportTypeParam = false;
    await setup();

    expect(scrollElement.scrollTo).not.toHaveBeenCalled();
  });

  it("resets scroll to the top on a step transition", async () => {
    hasImportTypeParam = false;
    await setup();

    hasImportTypeParam = true;
    routerEvents.next(new NavigationEnd(1, "/import/keeper", "/import/keeper"));
    fixture.detectChanges();

    expect(scrollElement.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
  });

  it("does not reset scroll for navigation events other than NavigationEnd", async () => {
    hasImportTypeParam = false;
    await setup();

    routerEvents.next(new NavigationStart(1, "/import/keeper"));
    fixture.detectChanges();

    expect(scrollElement.scrollTo).not.toHaveBeenCalled();
  });

  it("does not reset scroll again on a same-URL navigation", async () => {
    hasImportTypeParam = true;
    await setup();

    routerEvents.next(new NavigationEnd(1, "/import/keeper", "/import/keeper"));
    routerEvents.next(new NavigationEnd(2, "/import/keeper", "/import/keeper"));
    fixture.detectChanges();

    expect(scrollElement.scrollTo).not.toHaveBeenCalled();
  });

  it("reports step 2 when the active child route has an importType param, synchronously from the snapshot", async () => {
    hasImportTypeParam = true;
    await setup();

    expect(component()["currentStep"]()).toBe(2);
    expect(component()["progressValue"]()).toBeCloseTo((2 / 2) * 100);
    expect(component()["headingKey"]()).toBe("importData");
  });

  it("updates reactively when the router navigates between steps", async () => {
    hasImportTypeParam = false;
    await setup();
    expect(component()["currentStep"]()).toBe(1);

    hasImportTypeParam = true;
    routerEvents.next(new NavigationEnd(1, "/import/keeper", "/import/keeper"));
    fixture.detectChanges();

    expect(component()["currentStep"]()).toBe(2);
    expect(component()["headingKey"]()).toBe("importData");
  });

  it("ignores NavigationStart — only NavigationEnd should update the step", async () => {
    hasImportTypeParam = false;
    await setup();

    hasImportTypeParam = true;
    routerEvents.next(new NavigationStart(1, "/import/keeper"));
    fixture.detectChanges();

    expect(component()["currentStep"]()).toBe(1);
  });

  describe("with location selection", () => {
    beforeEach(() => destinations$.next(withStep));

    it("counts three steps on the source picker and credential parsing", async () => {
      hasImportTypeParam = false;
      await setup();

      expect(component()["totalSteps"]()).toBe(3);
      expect(component()["progressValue"]()).toBeCloseTo((1 / 3) * 100);
      expect(component()["stepText"]()).toBe("importSourceStepCount");
    });

    it("reports the location page (3 of 3) on the destination route with the vault label", async () => {
      hasImportTypeParam = true;
      onDestinationRoute = true;
      await setup();

      expect(component()["currentStep"]()).toBe(3);
      expect(component()["totalSteps"]()).toBe(3);
      expect(component()["progressValue"]()).toBeCloseTo(100);
      expect(component()["headingKey"]()).toBe("selectVault");
    });

    it("uses the location label when a My items card is offered", async () => {
      destinations$.next(withMyItems);
      hasImportTypeParam = true;
      onDestinationRoute = true;
      await setup();

      expect(component()["headingKey"]()).toBe("selectLocation");
    });

    it("still reports credential parsing (2 of 3) on the :importType route", async () => {
      hasImportTypeParam = true;
      await setup();

      expect(component()["currentStep"]()).toBe(2);
      expect(component()["headingKey"]()).toBe("importData");
    });
  });

  it("hides the step count until the destination lookup resolves", async () => {
    (destinationService as { destinations$: unknown }).destinations$ = new Subject().asObservable();
    hasImportTypeParam = false;
    await setup();

    expect(component()["stepText"]()).toBe("");
    expect(component()["progressValue"]()).toBe(0);
    expect(liveAnnouncer.announce).toHaveBeenCalledWith("importSourceBreadcrumb", "polite");
  });

  it("keeps two steps when the destination lookup fails", async () => {
    (destinationService as { destinations$: unknown }).destinations$ = throwError(
      () => new Error("lookup failed"),
    );
    hasImportTypeParam = false;
    await setup();

    expect(component()["totalSteps"]()).toBe(2);
    expect(component()["stepText"]()).toBe("importSourceStepCount");
  });
});

// A real two-child route config, not a hand-rolled ActivatedRoute stub — pins the DI contract the
// doc comment on ImportShellProgressComponent describes: it must be declared directly in a shell's
// own template (not behind another router-outlet) to inherit the shell's ActivatedRoute.
describe("ImportShellProgressComponent (real routing)", () => {
  @Component({
    selector: "test-shell",
    template: `<importer-shell-progress></importer-shell-progress><router-outlet></router-outlet>`,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ImportShellProgressComponent, RouterOutlet],
  })
  class TestShellComponent {}

  @Component({
    selector: "test-step-one",
    template: "",
    changeDetection: ChangeDetectionStrategy.OnPush,
  })
  class TestStepOneComponent {}

  @Component({
    selector: "test-step-two",
    template: "",
    changeDetection: ChangeDetectionStrategy.OnPush,
  })
  class TestStepTwoComponent {}

  @Component({
    selector: "test-location",
    template: "",
    changeDetection: ChangeDetectionStrategy.OnPush,
  })
  class TestLocationComponent {}

  async function setup(url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: "import",
            component: TestShellComponent,
            children: [
              { path: "", pathMatch: "full", component: TestStepOneComponent },
              { path: ":importType", component: TestStepTwoComponent },
              { path: IMPORT_DESTINATION_ROUTE_PATH, component: TestLocationComponent },
            ],
          },
        ]),
        { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
        {
          provide: ImportDestinationServiceAbstraction,
          useValue: Object.assign(mock<ImportDestinationServiceAbstraction>(), {
            destinations$: new BehaviorSubject<ImportDestinations>(withStep).asObservable(),
          }),
        },
      ],
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, TestShellComponent);

    const progress = harness.fixture.debugElement.query(By.directive(ImportShellProgressComponent))
      .componentInstance as ImportShellProgressComponent;
    return progress;
  }

  it("resolves the shell's own route and reports step 1 at the parent's empty child", async () => {
    const progress = await setup("/import");

    expect(progress["currentStep"]()).toBe(1);
    expect(progress["headingKey"]()).toBe("importSourceBreadcrumb");
  });

  it("resolves the shell's own route and reports step 2 once routed to the :importType child", async () => {
    const progress = await setup("/import/keeper");

    expect(progress["currentStep"]()).toBe(2);
    expect(progress["headingKey"]()).toBe("importData");
  });

  it("reports the location page once routed to the destination child, not credential parsing", async () => {
    const progress = await setup("/import/keeper/destination");

    expect(progress["currentStep"]()).toBe(3);
    expect(progress["totalSteps"]()).toBe(3);
    expect(progress["headingKey"]()).toBe("selectVault");
  });
});
