import { signal } from "@angular/core";

import { TableSelectionModel } from "./table-selection-model";

type Row = { id: number };

const rows = (count: number): Row[] => Array.from({ length: count }, (_, id) => ({ id }));

describe("TableSelectionModel", () => {
  describe("single-select", () => {
    it("reports multiSelect false so the table can omit select-all", () => {
      const model = new TableSelectionModel<Row>({ multiple: false, rows: signal(rows(5)) });

      expect(model.multiSelect).toBe(false);
    });

    it("reports multiSelect true when multiple is set", () => {
      const model = new TableSelectionModel<Row>({ multiple: true, rows: signal(rows(5)) });

      expect(model.multiSelect).toBe(true);
    });

    it("keeps only the last row selected", () => {
      const all = rows(5);
      const model = new TableSelectionModel<Row>({ multiple: false, rows: signal(all) });

      model.select(all[0], all[1], all[2]);

      expect(model.selected()).toEqual([all[2]]);
    });

    it("truncates an initial selection to one row", () => {
      const all = rows(5);
      const model = new TableSelectionModel<Row>({
        multiple: false,
        initial: all,
        rows: signal(all),
      });

      expect(model.count()).toBe(1);
    });
  });

  describe("rows leaving scope", () => {
    it("keeps selected rows that leave scope", () => {
      const all = rows(10);
      const scope = signal<readonly Row[]>(all);
      const model = new TableSelectionModel<Row>({ multiple: true, rows: scope });

      model.toggleAll();
      scope.set(all.slice(0, 2));

      expect(model.count()).toBe(10);
    });

    it("lets the header recover a budget spent on out-of-scope rows", () => {
      const all = rows(10);
      const scope = signal<readonly Row[]>(all);
      const model = new TableSelectionModel<Row>({ multiple: true, max: 5, rows: scope });

      model.toggleAll();
      scope.set(all.slice(8));
      expect(model.full()).toBe(true);
      model.select(all[8]);
      expect(model.isSelected(all[8])).toBe(false);

      model.toggleAll();

      expect(model.full()).toBe(false);
      model.select(all[8]);
      expect(model.isSelected(all[8])).toBe(true);
    });
  });

  describe("max", () => {
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

    it("reads as partial at the cap, not complete", () => {
      const model = new TableSelectionModel<Row>({
        multiple: true,
        max: 10,
        rows: signal(rows(25)),
      });

      model.toggleAll();

      expect(model.allSelected()).toBe(false);
      expect(model.indeterminate()).toBe(true);
    });

    it("reads as complete when the cap happens to cover every row", () => {
      const model = new TableSelectionModel<Row>({
        multiple: true,
        max: 10,
        rows: signal(rows(10)),
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

    it("clears instead of no-opping when the budget is spent and the scope moved", () => {
      const all = rows(1200);
      const filtered = signal<readonly Row[]>(all);
      const model = new TableSelectionModel<Row>({ multiple: true, max: 500, rows: filtered });

      model.toggleAll();
      expect(model.count()).toBe(500);

      filtered.set(all.slice(600, 700));
      expect(model.allSelected()).toBe(false);

      model.toggleAll();

      expect(model.count()).toBe(0);
    });

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

    it("is indeterminate when only a row past the cap window is selected", () => {
      const all = rows(600);
      const model = new TableSelectionModel<Row>({ multiple: true, max: 500, rows: signal(all) });

      model.select(all[550]);

      expect(model.indeterminate()).toBe(true);
      expect(model.allSelected()).toBe(false);
    });

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
