import { LiveAnnouncer } from "@angular/cdk/a11y";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ImportedFile } from "../../models";

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
  let liveAnnouncer: MockProxy<LiveAnnouncer>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? "";

  async function create(inputs: { summary?: ImportSummary; importedFile?: ImportedFile } = {}) {
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key, ...args) =>
      [key, ...args.filter((a) => a != null)].join(":"),
    );
    liveAnnouncer = mock<LiveAnnouncer>();
    await TestBed.configureTestingModule({
      imports: [ImportConfirmationSummaryComponent],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: LiveAnnouncer, useValue: liveAnnouncer },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportConfirmationSummaryComponent);
    fixture.componentRef.setInput("summary", inputs.summary ?? summary);
    if (inputs.importedFile != null) {
      fixture.componentRef.setInput("importedFile", inputs.importedFile);
    }
    fixture.detectChanges();
  }

  it("shows the total and a row per type with its icon, label and count", async () => {
    await create();

    expect(text()).toContain("importConfirmationBody:5");
    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll("li"),
      (li) => ({
        icon: li.querySelector("i")?.className,
        cells: Array.from(li.querySelectorAll("span"), (span) => span.textContent?.trim()).filter(
          Boolean,
        ),
      }),
    );
    expect(rows).toEqual([
      { icon: expect.stringContaining("bwi-globe"), cells: ["typeLogin", "3"] },
      { icon: expect.stringContaining("bwi-folder"), cells: ["folders", "2"] },
    ]);
  });

  it("has no heading or success icon, as the host supplies the title", async () => {
    await create();

    expect((fixture.nativeElement as HTMLElement).querySelector("h1")).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector("bit-icon-tile")).toBeNull();
  });

  it("uses the singular sentence for one item", async () => {
    await create({ summary: { total: 1, rows: [] } });

    expect(text()).toContain("importConfirmationBodySingular");
    expect(text()).not.toContain("importConfirmationBody:");
  });

  it("shows the delete-the-file tip with the file name", async () => {
    await create({ importedFile: { name: "export.csv" } });

    expect(text()).toContain("importConfirmationTipLabel");
    expect(text()).toContain("importDeleteFileTip:export.csv");
  });

  it("shows the generic tip when the file has no name to show", async () => {
    await create({ importedFile: {} });

    expect(text()).toContain("importDeleteFileTipGeneric");
    expect(text()).not.toContain("importDeleteFileTip:");
  });

  it("shows the generic tip when the file name is empty", async () => {
    await create({ importedFile: { name: "" } });

    expect(text()).toContain("importDeleteFileTipGeneric");
    expect(text()).not.toContain("importDeleteFileTip:");
  });

  it("shows no tip when no file was picked", async () => {
    await create();

    expect(text()).not.toContain("importDeleteFileTip");
  });

  it("announces the tip, so a screen reader reads it when the dialog opens", async () => {
    await create({ importedFile: { name: "export.csv" } });

    expect(liveAnnouncer.announce).toHaveBeenCalledWith(
      "importConfirmationTipLabel importDeleteFileTip:export.csv",
      "polite",
    );
  });

  it("announces nothing when there is no tip", async () => {
    await create();

    expect(liveAnnouncer.announce).not.toHaveBeenCalled();
  });
});
