import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Inject } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  ButtonModule,
  DialogModule,
  DialogRef,
  DIALOG_DATA,
  TableDataSource,
  TableModule,
  CardComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export interface DuplicateReviewDialogResult {
  confirmed: boolean;
  deleteCipherIds: string[];
}

@Component({
  selector: "app-duplicate-review-dialog",
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    FormsModule,
    I18nPipe,
    TableModule,
    CardComponent,
  ],
  templateUrl: "./duplicate-review-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DuplicateReviewDialogComponent {
  selection: Record<string, boolean> = {};
  selectedCount = 0;
  dataSource: TableDataSource<{ key: string; displayKey: string; ciphers: CipherView[] }>;

  private _totalDuplicateItemCount = 0;
  get totalDuplicateItemCount(): number {
    return this._totalDuplicateItemCount;
  }

  constructor(
    private dialogRef: DialogRef<DuplicateReviewDialogResult>,
    @Inject(DIALOG_DATA) public data: { duplicateSets: { key: string; ciphers: CipherView[] }[] },
  ) {
    this.dataSource = new TableDataSource<{
      key: string;
      displayKey: string;
      ciphers: CipherView[];
    }>();
    const sets = (data.duplicateSets ?? []).map((set) => ({
      ...set,
      displayKey: this.getDuplicateSetDomain(set.key),
    }));
    this.dataSource.data = sets;

    for (const set of sets) {
      set.ciphers.forEach((c, idx) => {
        this.selection[c.id] = idx !== 0;
      });
    }

    this._totalDuplicateItemCount = sets.reduce(
      (sum, s) => sum + Math.max(0, s.ciphers.length - 1),
      0,
    );
    this.selectedCount = Object.values(this.selection).filter(Boolean).length;
  }

  /**
   * Extracts the domain or grouping info from the duplicate set key.
   * For keys in the format 'username+uri: username @ domain', returns domain.
   * For keys in the format 'username+name: username & name', returns name.
   * Otherwise returns the key itself.
   */
  getDuplicateSetDomain(key: string): string {
    // username+uri: username @ domain
    if (key.startsWith("username+uri:")) {
      const atIdx = key.lastIndexOf("@");
      if (atIdx !== -1) {
        return key.substring(atIdx + 1).trim();
      }
    }
    // username+name: username & name
    if (key.startsWith("username+name:")) {
      const ampIdx = key.lastIndexOf("&");
      if (ampIdx !== -1) {
        return key.substring(ampIdx + 1).trim();
      }
    }
    return key;
  }
  // Cache TableDataSource per ciphers array to avoid recreating on each change detection
  private dsCache = new WeakMap<CipherView[], TableDataSource<CipherView>>();
  getTableDataSource(ciphers: CipherView[]): TableDataSource<CipherView> {
    if (!ciphers) {
      const empty = new TableDataSource<CipherView>();
      empty.data = [];
      return empty;
    }
    const cached = this.dsCache.get(ciphers);
    if (cached) {
      return cached;
    }
    const ds = new TableDataSource<CipherView>();
    ds.data = ciphers;
    this.dsCache.set(ciphers, ds);
    return ds;
  }

  // Cache URI string per cipher instance
  private urisCache = new WeakMap<CipherView, string>();
  getCipherUris(cipher: CipherView): string {
    if (!cipher) {
      return "";
    }
    const cached = this.urisCache.get(cipher);
    if (cached !== undefined) {
      return cached;
    }
    const value =
      cipher.login?.uris
        ?.map((u) => u?.uri)
        .filter((uri): uri is string => !!uri)
        .join(", ") || "";
    this.urisCache.set(cipher, value);
    return value;
  }

  onSelectChange(id: string, selected: boolean): void {
    const prev = !!this.selection[id];
    if (prev === selected) {
      return;
    }
    this.selection[id] = selected;
    this.selectedCount += selected ? 1 : -1;
  }

  get anySelected(): boolean {
    return this.selectedCount > 0;
  }

  trackBySet(_index: number, set: { key: string }): string {
    return set.key;
  }

  trackByCipher(_index: number, c: { id: string }): string {
    return c?.id;
  }

  confirm(): void {
    const deleteCipherIds = Object.entries(this.selection)
      .filter(([, selected]) => selected)
      .map(([id]) => id);
    this.dialogRef.close({ confirmed: true, deleteCipherIds });
  }

  cancel(): void {
    this.dialogRef.close({ confirmed: false, deleteCipherIds: [] });
  }

  static open(
    dialogService: any,
    data: { duplicateSets: { key: string; ciphers: CipherView[] }[] },
  ) {
    return (dialogService as any).open(DuplicateReviewDialogComponent, { data });
  }
}
