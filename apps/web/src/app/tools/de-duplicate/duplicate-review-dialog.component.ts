import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ButtonModule, DialogModule, DialogRef, DIALOG_DATA } from "@bitwarden/components";

export interface DuplicateReviewDialogData {
  duplicateSets: { key: string; ciphers: CipherView[] }[];
}

export interface DuplicateReviewDialogResult {
  confirmed: boolean;
  deleteCipherIds: string[];
}

@Component({
  selector: "app-duplicate-review-dialog",
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule, FormsModule],
  template: `
    <bit-dialog>
      <span bitDialogTitle class="tw-font-semibold">Duplicate items found</span>
      <div bitDialogContent>
        <div class="tw-space-y-4 tw-w-[min(90vw,960px)]">
          <p class="tw-text-muted tw-m-0">Review and delete duplicate entries.</p>
          <div *ngIf="duplicateSets?.length" class="tw-text-sm tw-font-medium">
            {{ totalDuplicateItemCount }} duplicated item{{
              totalDuplicateItemCount === 1 ? "" : "s"
            }}
            found for {{ duplicateSets.length }} credential{{
              duplicateSets.length === 1 ? "" : "s"
            }}
          </div>

          <ng-container *ngIf="duplicateSets?.length; else noneFound">
            <div
              class="tw-max-h-96 tw-overflow-auto tw-border tw-rounded tw-divide-y tw-bg-background"
            >
              <div
                *ngFor="let set of duplicateSets; let i = index"
                class="tw-p-3 tw-space-y-2 tw-bg-background-alt"
              >
                <div class="tw-text-sm tw-font-medium">
                  {{ i + 1 }}. {{ set.ciphers[0]?.login?.username || "—" }}
                </div>
                <div class="tw-text-xs tw-text-muted">{{ set.ciphers.length }} item(s)</div>
                <table class="tw-w-full tw-text-sm tw-border-collapse">
                  <thead>
                    <tr class="tw-text-left tw-text-xs tw-text-muted">
                      <th class="tw-w-6"></th>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Folder</th>
                      <th>Organization</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      *ngFor="let cipher of set.ciphers; let idx = index"
                      class="tw-align-top hover:tw-bg-background-alt/40"
                    >
                      <td>
                        <input
                          type="checkbox"
                          [disabled]="idx === 0"
                          [(ngModel)]="selection[cipher.id]"
                          [ngModelOptions]="{ standalone: true }"
                        />
                      </td>
                      <td class="tw-pr-2">
                        <span [ngClass]="{ 'tw-font-semibold': idx === 0 }">{{ cipher.name }}</span>
                        <span *ngIf="cipher.isDeleted" class="tw-italic tw-text-xs tw-text-muted">
                          (In Trash)</span
                        >
                      </td>
                      <td class="tw-pr-2">{{ cipher.login?.username }}</td>
                      <td class="tw-pr-2">{{ cipher.folderId || "—" }}</td>
                      <td class="tw-pr-2">{{ cipher.organizationId || "—" }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </ng-container>
          <ng-template #noneFound>
            <div class="tw-text-sm tw-text-muted">No duplicates found.</div>
          </ng-template>
        </div>
      </div>
      <ng-container bitDialogFooter>
        <button bitButton buttonType="secondary" type="button" (click)="cancel()">Keep All</button>
        <button
          bitButton
          buttonType="danger"
          type="button"
          (click)="confirm()"
          [disabled]="!hasAnySelected()"
        >
          Delete Selected
        </button>
      </ng-container>
    </bit-dialog>
  `,
})
export class DuplicateReviewDialogComponent {
  duplicateSets: { key: string; ciphers: CipherView[] }[] = [];
  selection: Record<string, boolean> = {};

  get totalDuplicateItemCount(): number {
    return this.duplicateSets.reduce((sum, set) => sum + Math.max(0, set.ciphers.length - 1), 0);
  }

  constructor(
    private dialogRef: DialogRef<DuplicateReviewDialogResult>,
    @Inject(DIALOG_DATA) public data: DuplicateReviewDialogData,
  ) {
    this.duplicateSets = data.duplicateSets ?? [];
    for (const set of this.duplicateSets) {
      set.ciphers.forEach((c, idx) => {
        if (idx === 0) {
          this.selection[c.id] = false;
        } else {
          this.selection[c.id] = true;
        }
      });
    }
  }

  hasAnySelected() {
    return Object.values(this.selection).some((v) => v);
  }

  confirm() {
    const deleteCipherIds = Object.entries(this.selection)
      .filter(([, selected]) => selected)
      .map(([id]) => id);
    this.dialogRef.close({ confirmed: true, deleteCipherIds });
  }

  cancel() {
    this.dialogRef.close({ confirmed: false, deleteCipherIds: [] });
  }

  static open(dialogService: any, data: DuplicateReviewDialogData) {
    return (dialogService as any).open(DuplicateReviewDialogComponent, { data });
  }
}
