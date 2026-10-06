import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DIALOG_DATA } from "../dialog";
import { TooltipDirective } from "../tooltip";
import { I18nMockService } from "../utils/i18n-mock.service";

import { FilterDialogComponent, FilterDialogParams } from "./filter-dialog.component";
import { FilterPresenter } from "./filter-tokens";

/** A drill-in-less filter (a toggle's shape), which is all the row list needs to draw a row. */
function presenter(label: string, summaryLabels: string[]): FilterPresenter {
  return {
    key: signal(label),
    label: signal(label),
    icon: signal(undefined),
    active: signal(summaryLabels.length > 0),
    multiple: signal(summaryLabels.length > 1),
    summary: signal(summaryLabels.join(", ")),
    selections: signal(summaryLabels.map((label) => ({ value: label, label }))),
    optionsTemplate: signal(undefined),
    flip: () => undefined,
    deselect: () => undefined,
    clear: () => undefined,
  };
}

describe("FilterDialogComponent", () => {
  const setUp = async (filters: readonly FilterPresenter[]) => {
    await TestBed.configureTestingModule({
      imports: [FilterDialogComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              filter: "Filter",
              back: "Back",
              close: "Close",
              done: "Done",
              clear: "Clear",
              clearAll: "Clear all",
              filtersSelected: (count?: string) => `${count} selected`,
            }),
        },
        {
          provide: DIALOG_DATA,
          useValue: { filters: signal(filters) } satisfies FilterDialogParams,
        },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<FilterDialogComponent> =
      TestBed.createComponent(FilterDialogComponent);
    fixture.detectChanges();

    return fixture;
  };

  // Scoped to the dialog body: the header's close icon button carries a tooltip of its own.
  const rowTooltips = (fixture: ComponentFixture<FilterDialogComponent>) =>
    fixture.debugElement
      .query(By.css("[bitDialogContent]"))
      .queryAll(By.directive(TooltipDirective))
      .map((row) => (row.injector.get(TooltipDirective) as TooltipDirective).tooltipContent());

  it("tooltips each row with its label and full selection", async () => {
    // The row truncates its label and hides all but the first selected names behind a `+N`, so
    // the tooltip is the only place the whole thing is readable.
    const fixture = await setUp([
      presenter("Shared folders", ["A long collection name", "Another long collection name"]),
      presenter("My folders", []),
    ]);

    expect(rowTooltips(fixture)).toEqual([
      "Shared folders: A long collection name, Another long collection name",
      "My folders",
    ]);
  });
});
