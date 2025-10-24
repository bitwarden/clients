import { ReferenceId } from "./protocol";

export class ReferenceStore {
  private _store = new Map<ReferenceId, any>();
  private _nextId = 1;

  get<T>(id: number): T | undefined {
    return this._store.get(id);
  }

  store<T>(value: T): ReferenceId {
    const id = this.generateId();
    this._store.set(id, value);
    return id;
  }

  release(id: ReferenceId): void {
    this._store.delete(id);
  }

  private generateId(): ReferenceId {
    return this._nextId++;
  }
}
