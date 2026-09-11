import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SelectItemView, TableModule, TooltipDirective } from "@bitwarden/components";

import {
  AssignmentPickerColumn,
  AssignmentPickerComponent,
  AssignmentPickerHints,
  AssignmentPickerRow,
} from "./assignment-picker.component";

/** Echoes the key. */
const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string, p1?: string | number) => (p1 == null ? id : `${id}:${p1}`),
  translate: (id: string) => id,
};

interface TestRow extends AssignmentPickerRow {
  readonly kind: string;
}

const HINTS: AssignmentPickerHints = {
  default: "hintDefault",
  allAssigned: "hintAllAssigned",
  noneEligible: "hintNoneEligible",
  loadError: "hintLoadError",
  disabled: "hintDisabled",
};

const COLUMNS: AssignmentPickerColumn[] = [
  { headerKey: "colName" },
  { headerKey: "colKind", headerClass: "tw-text-muted" },
];

function option(id: string, name: string): SelectItemView {
  return { id, listName: name, labelName: name };
}

function row(id: string, label: string, kind = "kindEntra"): TestRow {
  return { id, label, kind };
}

@Component({
  selector: "app-assignment-picker-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AssignmentPickerComponent, TableModule],
  template: `
    <pam-assignment-picker
      idPrefix="host"
      headingKey="heading"
      selectLabelKey="selectLabel"
      unassignLabelKey="unassignLabel"
      emptyKey="emptyRow"
      [options]="options"
      [assignments]="assignments"
      [columns]="columns"
      [rowTemplate]="rowTemplate"
      [hints]="hints"
      [assign]="assign"
      [unassign]="unassign"
      [disabled]="disabled"
      [disabledTooltipKey]="disabledTooltipKey"
      [loadError]="loadError"
      [noneEligible]="noneEligible"
      [goToRoute]="goToRoute"
      [goToLabelKey]="goToLabelKey"
    />
    <ng-template #rowTemplate let-row>
      <td bitCell data-testid="cell-label">{{ row.label }}</td>
      <td bitCell data-testid="cell-kind">{{ row.kind }}</td>
    </ng-template>
  `,
})
class AssignmentPickerHostComponent {
  options: SelectItemView[] = [option("opt-1", "Prod Entra")];
  assignments: TestRow[] = [row("row-1", "Prod MSSQL", "kindMssql")];
  columns = COLUMNS;
  hints = HINTS;
  disabled = false;
  disabledTooltipKey: string | null = null;
  loadError = false;
  noneEligible = false;
  goToRoute: unknown[] | null = null;
  goToLabelKey: string | null = null;

  assign: (selected: SelectItemView[]) => Promise<readonly string[] | void> = jest.fn(() =>
    Promise.resolve(),
  );
  unassign: (row: TestRow) => Promise<boolean | void> = jest.fn(() => Promise.resolve());
}

/** The picker's protected surface, as these tests drive it. */
type PickerApi = {
  pendingSelection: { (): SelectItemView[]; set(items: SelectItemView[]): void };
  hintKey: () => string;
  canAssign: () => boolean;
  canSelect: () => boolean;
};

describe("AssignmentPickerComponent", () => {
  let fixture: ComponentFixture<AssignmentPickerHostComponent>;
  let host: AssignmentPickerHostComponent;

  async function render(): Promise<PickerApi> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.debugElement.query(By.directive(AssignmentPickerComponent))
      .componentInstance as unknown as PickerApi;
  }

  function el<T extends HTMLElement>(selector: string): T | null {
    return (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
  }

  /** Assign's own tooltip. */
  function assignTooltip(): TooltipDirective {
    return fixture.debugElement.query(By.css("#host_button_assign")).injector.get(TooltipDirective);
  }

  function textOf(selector: string): string {
    return el(selector)?.textContent?.trim() ?? "";
  }

  async function click(selector: string): Promise<void> {
    el<HTMLElement>(selector)?.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignmentPickerHostComponent, NoopAnimationsModule],
      providers: [provideRouter([]), { provide: I18nService, useValue: i18nFake }],
    }).compileComponents();

    fixture = TestBed.createComponent(AssignmentPickerHostComponent);
    host = fixture.componentInstance;
  });

  afterEach(() => TestBed.resetTestingModule());

  describe("the assigned table", () => {
    it("renders the caller's cells for every assigned row", async () => {
      host.assignments = [row("row-1", "Prod MSSQL", "kindMssql"), row("row-2", "Staging Entra")];
      await render();

      const labels = (fixture.nativeElement as HTMLElement).querySelectorAll(
        '[data-testid="cell-label"]',
      );
      const kinds = (fixture.nativeElement as HTMLElement).querySelectorAll(
        '[data-testid="cell-kind"]',
      );

      expect([...labels].map((c) => c.textContent?.trim())).toEqual([
        "Prod MSSQL",
        "Staging Entra",
      ]);
      expect([...kinds].map((c) => c.textContent?.trim())).toEqual(["kindMssql", "kindEntra"]);
    });

    it("names the row in the remove control, which is all a screen reader gets", async () => {
      await render();

      expect(el("#host_button_unassign-row-1")?.getAttribute("aria-label")).toBe(
        "unassignLabel:Prod MSSQL",
      );
    });

    it("stands an empty row in for no assignments, spanning every column", async () => {
      host.assignments = [];
      await render();

      const empty = el("bit-table td");
      expect(empty?.textContent?.trim()).toBe("emptyRow");
      // The caller's two columns plus the options column the picker appends.
      expect(empty?.getAttribute("colspan")).toBe("3");
      expect(el("#host_button_unassign-row-1")).toBeNull();
    });
  });

  describe("assigning", () => {
    it("hands the pending selection to the caller and empties the picker", async () => {
      const picker = await render();
      picker.pendingSelection.set([option("opt-1", "Prod Entra")]);
      fixture.detectChanges();

      await click("#host_button_assign");

      expect(host.assign).toHaveBeenCalledWith([option("opt-1", "Prod Entra")]);
      expect(picker.pendingSelection()).toEqual([]);
    });

    it("keeps what the caller could not assign, for a retry without reselecting", async () => {
      host.assign = jest.fn(() => Promise.resolve(["opt-1"]));
      const picker = await render();
      picker.pendingSelection.set([option("opt-1", "Prod Entra"), option("opt-2", "Staging")]);
      fixture.detectChanges();

      await click("#host_button_assign");

      expect(picker.pendingSelection()).toEqual([option("opt-2", "Staging")]);
    });

    it("keeps an option picked while the assign was in flight", async () => {
      let release: (assigned: readonly string[]) => void = () => {};
      host.assign = jest.fn(
        () =>
          new Promise<readonly string[]>((resolve) => {
            release = resolve;
          }),
      );
      const picker = await render();
      picker.pendingSelection.set([option("opt-1", "Prod Entra")]);
      fixture.detectChanges();

      el<HTMLElement>("#host_button_assign")?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      // The multi-select stays live while the call is out.
      picker.pendingSelection.set([option("opt-1", "Prod Entra"), option("opt-2", "Staging")]);

      release(["opt-1"]);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(host.assign).toHaveBeenCalledWith([option("opt-1", "Prod Entra")]);
      expect(picker.pendingSelection()).toEqual([option("opt-2", "Staging")]);
    });

    it("does not assign an empty selection, and says so without taking focus away", async () => {
      const picker = await render();

      expect(picker.canAssign()).toBe(false);
      expect(el("#host_button_assign")?.getAttribute("aria-disabled")).toBe("true");

      el<HTMLElement>("#host_button_assign")?.focus();
      expect(document.activeElement).toBe(el("#host_button_assign"));

      await click("#host_button_assign");

      expect(host.assign).not.toHaveBeenCalled();
    });

    it("does not assign while the record is blocked", async () => {
      host.disabled = true;
      const picker = await render();
      picker.pendingSelection.set([option("opt-1", "Prod Entra")]);
      fixture.detectChanges();

      await click("#host_button_assign");

      expect(host.assign).not.toHaveBeenCalled();
      expect(picker.canSelect()).toBe(false);
    });

    it("describes a blocked Assign through a tooltip that stays reachable", async () => {
      host.disabled = true;
      host.disabledTooltipKey = "blockedTooltip";
      await render();

      const tooltip = assignTooltip();

      expect(tooltip.tooltipContent()).toBe("blockedTooltip");
      expect(tooltip.addTooltipToDescribedby()).toBe(true);
    });

    it("leaves the tooltip off an Assign that is merely waiting for a selection", async () => {
      host.disabledTooltipKey = "blockedTooltip";
      await render();

      const tooltip = assignTooltip();

      expect(tooltip.tooltipContent()).toBe("");
      expect(tooltip.addTooltipToDescribedby()).toBe(false);
    });
  });

  describe("unassigning", () => {
    it("hands the row to the caller and returns focus to Assign", async () => {
      await render();

      await click("#host_button_unassign-row-1");

      expect(host.unassign).toHaveBeenCalledWith(row("row-1", "Prod MSSQL", "kindMssql"));
      expect(document.activeElement).toBe(el("#host_button_assign"));
    });

    it("leaves focus alone when the caller reports nothing was removed", async () => {
      host.unassign = jest.fn(() => Promise.resolve(false));
      await render();

      await click("#host_button_unassign-row-1");

      expect(document.activeElement).not.toBe(el("#host_button_assign"));
    });

    it("holds every remove control while one removal is in flight", async () => {
      let release: () => void = () => {};
      host.unassign = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      );
      host.assignments = [row("row-1", "Prod MSSQL"), row("row-2", "Staging Entra")];
      await render();

      el<HTMLElement>("#host_button_unassign-row-1")?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(el("#host_button_unassign-row-2")?.getAttribute("aria-disabled")).toBe("true");
      el<HTMLElement>("#host_button_unassign-row-2")?.click();
      expect(host.unassign).toHaveBeenCalledTimes(1);

      release();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(el("#host_button_unassign-row-2")?.hasAttribute("aria-disabled")).toBe(false);
    });
  });

  describe("the hint", () => {
    it("explains what can be assigned while there is something to pick", async () => {
      const picker = await render();

      expect(picker.hintKey()).toBe("hintDefault");
      expect(textOf("bit-hint")).toBe("hintDefault");
    });

    it("says everything eligible is already assigned when the options run out", async () => {
      host.options = [];
      const picker = await render();

      expect(picker.hintKey()).toBe("hintAllAssigned");
    });

    it("distinguishes having nothing eligible from having assigned it all", async () => {
      host.options = [];
      host.noneEligible = true;
      const picker = await render();

      expect(picker.hintKey()).toBe("hintNoneEligible");
    });

    it("says the list could not be read rather than that there is nothing to assign", async () => {
      host.options = [];
      host.noneEligible = true;
      host.loadError = true;
      const picker = await render();

      expect(picker.hintKey()).toBe("hintLoadError");
    });

    it("answers a blocked record first, since nothing else is actionable until it is", async () => {
      host.disabled = true;
      host.loadError = true;
      const picker = await render();

      expect(picker.hintKey()).toBe("hintDisabled");
    });

    it("falls through to the other states when the caller gives no blocked hint", async () => {
      host.hints = { ...HINTS, disabled: undefined };
      host.disabled = true;
      host.loadError = true;
      const picker = await render();

      expect(picker.hintKey()).toBe("hintLoadError");
    });
  });

  describe("the escape hatch", () => {
    it("offers the caller's link when there is nothing eligible to assign", async () => {
      host.noneEligible = true;
      host.goToRoute = ["/somewhere"];
      host.goToLabelKey = "goToLabel";
      await render();

      expect(textOf("#host_anchor_go-to")).toBe("goToLabel");
    });

    it("stays hidden while something is still eligible", async () => {
      host.goToRoute = ["/somewhere"];
      host.goToLabelKey = "goToLabel";
      await render();

      expect(el("#host_anchor_go-to")).toBeNull();
    });

    it("stays hidden when the caller offers nowhere to go", async () => {
      host.noneEligible = true;
      await render();

      expect(el("#host_anchor_go-to")).toBeNull();
    });

    it("stays hidden when the list is empty because its read failed", async () => {
      host.noneEligible = true;
      host.loadError = true;
      host.goToRoute = ["/somewhere"];
      host.goToLabelKey = "goToLabel";
      const picker = await render();

      expect(picker.hintKey()).toBe("hintLoadError");
      expect(el("#host_anchor_go-to")).toBeNull();
    });
  });
});
