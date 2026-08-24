import { signal } from "@angular/core";

import { TableSelectionModel } from "./table-selection-model";

type Row = { id: number };

const rows = (count: number): Row[] => Array.from({ length: count }, (_, id) => ({ id }));

describe("TableSelectionModel", () => {
  describe("max", () => {
    /**
     * The cap has to bind the selection itself. A consumer that instead caps some downstream view
     * of it — what it hands a bulk-action bar, say — leaves the over-cap rows rendering as checked
     * while nothing ever acts on them, so a bulk operation silently skips the remainder.
     */
    it("stops select-all at the cap", () => {
      const model = new TableSelectionModel<Row>({
        multiple: true,
        max: 10,
        rows: signal(rows(25)),
      });

      model.toggleAll();

      expect(model.count()).toBe(10);
    });

    it("stops an explicit select at the cap", () => {
      const model = new TableSelectionModel<Row>({
        multiple: true,
        max: 3,
        rows: signal(rows(10)),
      });

      model.select(...rows(10));

      expect(model.count()).toBe(3);
    });

    it("ignores further selections once the cap is reached", () => {
      const all = rows(10);
      const model = new TableSelectionModel<Row>({ multiple: true, max: 2, rows: signal(all) });

      model.select(all[0], all[1]);
      model.select(all[2]);

      expect(model.selected()).toEqual([all[0], all[1]]);
    });

    it("truncates an over-cap initial selection", () => {
      const all = rows(10);
      const model = new TableSelectionModel<Row>({
        multiple: true,
        max: 4,
        initial: all,
        rows: signal(all),
      });

      expect(model.count()).toBe(4);
    });

    /**
     * The header checkbox reads off these two. Measured against every selectable row they would
     * never resolve once a capped select-all stops short — leaving the header stuck indeterminate
     * with no way to reach a checked state.
     */
    it("resolves allSelected at the cap rather than staying indeterminate", () => {
      const model = new TableSelectionModel<Row>({
        multiple: true,
        max: 10,
        rows: signal(rows(25)),
      });

      model.toggleAll();

      expect(model.allSelected()).toBe(true);
      expect(model.indeterminate()).toBe(false);
    });

    it("is indeterminate below the cap", () => {
      const all = rows(25);
      const model = new TableSelectionModel<Row>({ multiple: true, max: 10, rows: signal(all) });

      model.select(all[0]);

      expect(model.allSelected()).toBe(false);
      expect(model.indeterminate()).toBe(true);
    });

    it("clears a capped selection on the next toggle", () => {
      const model = new TableSelectionModel<Row>({
        multiple: true,
        max: 10,
        rows: signal(rows(25)),
      });

      model.toggleAll();
      model.toggleAll();

      expect(model.count()).toBe(0);
    });

    /**
     * A selection sitting at `max` must not dead-end. Filter onto rows none of which are selected
     * and the header renders unchecked, but there is no budget left to select with — so without
     * this the checkbox would be inert, with no way forward except clearing by some other means.
     */
    it("clears instead of no-opping when the budget is spent and the scope moved", () => {
      const all = rows(1200);
      const filtered = signal<readonly Row[]>(all);
      const model = new TableSelectionModel<Row>({ multiple: true, max: 500, rows: filtered });

      model.toggleAll();
      expect(model.count()).toBe(500);

      // Narrow onto rows that exclude every selected one.
      filtered.set(all.slice(600, 700));
      expect(model.allSelected()).toBe(false);

      model.toggleAll();

      expect(model.count()).toBe(0);
    });

    /** With the budget handed back, the next select-all works within the narrowed view. */
    it("can select again in the new scope after clearing", () => {
      const all = rows(1200);
      const filtered = signal<readonly Row[]>(all);
      const model = new TableSelectionModel<Row>({ multiple: true, max: 500, rows: filtered });

      model.toggleAll();
      filtered.set(all.slice(600, 700));
      model.toggleAll();
      model.toggleAll();

      expect(model.count()).toBe(100);
      expect(model.allSelected()).toBe(true);
    });

    /**
     * A row past the cap window is still visibly checked, so the header has to reflect it.
     * Bounding this to the capped set renders the header empty while a row shows as selected.
     */
    it("is indeterminate when only a row past the cap window is selected", () => {
      const all = rows(600);
      const model = new TableSelectionModel<Row>({ multiple: true, max: 500, rows: signal(all) });

      model.select(all[550]);

      expect(model.indeterminate()).toBe(true);
      expect(model.allSelected()).toBe(false);
    });

    /**
     * `full` is what row checkboxes bind `disabled` to. Left enabled at the cap, a click is
     * silently rejected while the browser has already flipped `checked` — and because the
     * `[checked]` binding's value never changed, Angular does not write it back, so the row keeps
     * rendering as selected when it is not.
     */
    it("reports full at the cap and not below it", () => {
      const all = rows(10);
      const model = new TableSelectionModel<Row>({ multiple: true, max: 2, rows: signal(all) });

      expect(model.full()).toBe(false);

      model.select(all[0]);
      expect(model.full()).toBe(false);

      model.select(all[1]);
      expect(model.full()).toBe(true);
    });

    it("is never full without a cap", () => {
      const all = rows(50);
      const model = new TableSelectionModel<Row>({ multiple: true, rows: signal(all) });

      model.toggleAll();

      expect(model.full()).toBe(false);
    });

    it("leaves an uncapped model selecting everything", () => {
      const model = new TableSelectionModel<Row>({ multiple: true, rows: signal(rows(25)) });

      model.toggleAll();

      expect(model.count()).toBe(25);
      expect(model.allSelected()).toBe(true);
    });

    /** The cap applies to selectable rows, so non-selectable ones don't consume its budget. */
    it("counts only selectable rows against the cap", () => {
      const all = rows(25);
      const model = new TableSelectionModel<Row>({
        multiple: true,
        max: 5,
        canSelect: (row) => row.id % 2 === 0,
        rows: signal(all),
      });

      model.toggleAll();

      expect(model.count()).toBe(5);
      expect(model.selected().every((row) => row.id % 2 === 0)).toBe(true);
    });
  });
});
