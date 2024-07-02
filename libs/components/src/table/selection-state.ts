const MAX_SELECTION = 500;

export class SelectionState<T> {
  private _selectMap: Map<T, boolean> = new Map();

  selectAll = false;
  canSelect: (row: T) => boolean = () => true;

  set data(data: T[]) {
    const keyValuePairs: [T, boolean][] = data.map((row) => [row, false]);
    this._selectMap = new Map(keyValuePairs);
  }

  getValue(row: T) {
    if (!this.canSelect(row)) {
      return false;
    }

    return this._selectMap.get(row);
  }

  setValue(data: T | T[], value: boolean) {
    if (!Array.isArray(data)) {
      data = [data];
    }

    data = data.filter((d) => this.canSelect(d)).slice(0, MAX_SELECTION);
    if (!data.length) {
      return;
    }

    data.forEach((r) => this._selectMap.set(r, value));

    if (!value) {
      // If the user has deselected a row, make sure the selectAll checkbox is no longer checked
      this.selectAll = false;
    }
  }

  get selectedRows(): T[] {
    const selectedRows: T[] = [];

    for (const row of this._selectMap.keys()) {
      if (this.getValue(row)) {
        selectedRows.push(row);
      }
    }

    return selectedRows;
  }

  deselectAll() {
    for (const key of this._selectMap.keys()) {
      this._selectMap.set(key, false);
    }
  }
}
