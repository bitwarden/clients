import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ImportConfirmationSummaryComponent } from "./import-confirmation-summary.component";
import { ImportSummary } from "./import-summary";

describe("ImportConfirmationSummaryComponent", () => {
  const summary: ImportSummary = {
    total: 5,
    rows: [
      { icon: "globe", labelKey: "typeLogin", count: 3 },
      { icon: "folder", labelKey: "folders", count: 2 },
    ],
  };

  let fixture: ComponentFixture<ImportConfirmationSummaryComponent>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? "";

  async function create(inputs: { fileName?: string; showHeading?: boolean } = {}) {
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key, ...args) =>
      [key, ...args.filter((a) => a != null)].join(":"),
    );
    await TestBed.configureTestingModule({
      imports: [ImportConfirmationSummaryComponent],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportConfirmationSummaryComponent);
    fixture.componentRef.setInput("summary", summary);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  }

  it("shows the heading, the total, and a row per type with its count", async () => {
    await create();

    expect(text()).toContain("importSuccessful");
    expect(text()).toContain("importConfirmationBody:5");
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll("li"), (li) =>
      Array.from(li.querySelectorAll("span"), (span) => span.textContent?.trim()),
    );
    expect(rows).toEqual([
      ["typeLogin", "3"],
      ["folders", "2"],
    ]);
  });

  it("hides the heading when the host supplies the title", async () => {
    await create({ showHeading: false });

    expect((fixture.nativeElement as HTMLElement).querySelector("h1")).toBeNull();
  });

  it("shows the delete-the-file tip with the file name", async () => {
    await create({ fileName: "export.csv" });

    expect(text()).toContain("importConfirmationTipLabel");
    expect(text()).toContain("importDeleteFileTip:export.csv");
  });

  it("shows no tip when no file was picked", async () => {
    await create();

    expect(text()).not.toContain("importDeleteFileTip");
  });
});
