import { DebugElement } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { MemberAdoptionReportBreadcrumbsComponent } from "./member-adoption-report-breadcrumbs.component";

const ORGANIZATION_ID = "5a1c0000-0000-4000-8000-00000000000f" as OrganizationId;

const REPORT_URL = `/organizations/${ORGANIZATION_ID}/reporting/reports/member-adoption-report`;

/**
 * A crumb is projected into `bit-breadcrumbs` as a template rather than an element, so the
 * `bit-breadcrumb` hosts never reach the DOM — these assert on what each crumb renders as instead:
 * a link for a crumb pointing elsewhere, and the `aria-current="page"` element for the active one.
 */
describe("MemberAdoptionReportBreadcrumbsComponent", () => {
  let harness: RouterTestingHarness;

  /** @param query Query params on the report URL, as the table writes when a filter is applied. */
  async function setup(query = ""): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: "organizations/:organizationId/reporting/reports/member-adoption-report",
            component: MemberAdoptionReportBreadcrumbsComponent,
          },
        ]),
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    });

    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`${REPORT_URL}${query}`);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function links(): DebugElement[] {
    return harness.fixture.debugElement.queryAll(By.css("a[href]"));
  }

  function activeCrumb(): DebugElement {
    return harness.fixture.debugElement.query(By.css('[aria-current="page"]'));
  }

  function separators(): DebugElement[] {
    return harness.fixture.debugElement.queryAll(By.css(".bwi-angle-right"));
  }

  it("links the reports crumb to the organization's reports home, not the individual vault's", async () => {
    await setup();

    const [reports] = links();
    expect(reports.nativeElement.getAttribute("href")).toBe(
      `/organizations/${ORGANIZATION_ID}/reporting/reports`,
    );
    expect(reports.nativeElement.textContent).toContain("reports");
  });

  it("gives the reports crumb the side nav's glyph for the reporting section", async () => {
    await setup();

    const [reports] = links();
    expect(reports.query(By.css(".bwi-sliders"))).not.toBeNull();
  });

  it("marks the member adoption crumb as the current page, and does not link it", async () => {
    await setup();

    const active = activeCrumb();
    expect(active.nativeElement.textContent).toContain("memberAdoptionReport");
    expect(active.nativeElement.tagName).not.toBe("A");
    expect(links()).toHaveLength(1);
  });

  it("keeps the member adoption crumb current once the table writes its filters to the URL", async () => {
    await setup("?memberAdoption.search=tanaka");

    expect(activeCrumb().nativeElement.textContent).toContain("memberAdoptionReport");
  });

  it("exposes the trail as a named navigation landmark", async () => {
    await setup();

    const nav = harness.fixture.debugElement.query(By.css('[role="navigation"]'));
    expect(nav).not.toBeNull();
    expect(nav.nativeElement.getAttribute("aria-label")).toBe("breadcrumbs");
  });

  it("hides every separator from assistive technology", async () => {
    await setup();

    expect(separators().length).toBeGreaterThan(0);
    separators().forEach((separator) => {
      expect(separator.nativeElement.getAttribute("aria-hidden")).toBe("true");
    });
  });
});
