import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { CheckboxModule } from "../checkbox";
import { TableDataSource } from "../table/table-data-source";
import { TableModule } from "../table/table.module";
import { I18nMockService } from "../utils/i18n-mock.service";

import { BulkActionComponent } from "./bulk-action.component";
import { BulkActionsBarComponent } from "./bulk-actions-bar.component";

type Row = { id: number; name: string; type: string };

@Component({
  selector: "story-bulk-actions-table",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TableModule,
    CheckboxModule,
    BulkActionsBarComponent,
    BulkActionComponent,
  ],
  template: /*html*/ `
    <bit-table [dataSource]="dataSource">
      <ng-container header>
        <tr>
          <th bitCell class="tw-w-8">
            <input
              type="checkbox"
              bitCheckbox
              id="checkAll"
              [checked]="allSelected()"
              [indeterminate]="someSelected()"
              (change)="toggleAll()"
            />
            <label for="checkAll" class="tw-sr-only">Select all</label>
          </th>
          <th bitCell>Name</th>
          <th bitCell>Type</th>
        </tr>
      </ng-container>
      <ng-template body let-rows$>
        <tr bitRow *ngFor="let r of rows$ | async">
          <td bitCell>
            <input
              type="checkbox"
              bitCheckbox
              [id]="'check-' + r.id"
              [checked]="isSelected(r.id)"
              (change)="toggle(r.id)"
            />
            <label [for]="'check-' + r.id" class="tw-sr-only">Select {{ r.name }}</label>
          </td>
          <td bitCell>{{ r.name }}</td>
          <td bitCell>{{ r.type }}</td>
        </tr>
      </ng-template>
    </bit-table>

    <bit-bulk-actions-bar [selectedCount]="selectedCount()" (clear)="clearAll()">
      <button bitBulkAction icon="bwi-folder" type="button">Move</button>
      <button bitBulkAction icon="bwi-archive" type="button">Archive</button>
      <button bitBulkAction icon="bwi-trash" type="button">Delete</button>
    </bit-bulk-actions-bar>
  `,
})
class StoryBulkActionsTableComponent {
  protected readonly dataSource = new TableDataSource<Row>();

  private readonly selectedIds = signal(new Set<number>());

  protected readonly selectedCount = computed(() => this.selectedIds().size);
  protected readonly allSelected = computed(
    () => this.selectedCount() > 0 && this.selectedCount() === this.dataSource.data.length,
  );
  protected readonly someSelected = computed(() => this.selectedCount() > 0 && !this.allSelected());

  constructor() {
    this.dataSource.data = [
      { id: 1, name: "GitHub", type: "Login" },
      { id: 2, name: "AWS root", type: "Login" },
      { id: 3, name: "Passport", type: "Identity" },
      { id: 4, name: "Visa **** 4242", type: "Card" },
      { id: 5, name: "Wi-Fi password", type: "Secure note" },
      { id: 6, name: "1Password import", type: "Login" },
    ];
  }

  protected isSelected(id: number): boolean {
    return this.selectedIds().has(id);
  }

  protected toggle(id: number): void {
    this.selectedIds.update((s) => {
      const next = new Set(s);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  protected toggleAll(): void {
    this.selectedIds.update((s) =>
      s.size === this.dataSource.data.length
        ? new Set()
        : new Set(this.dataSource.data.map((r) => r.id)),
    );
  }

  protected clearAll(): void {
    this.selectedIds.set(new Set());
  }
}

export default {
  title: "Component Library/Bulk Actions Bar",
  component: BulkActionsBarComponent,
  decorators: [
    moduleMetadata({
      imports: [
        BulkActionComponent,
        CommonModule,
        TableModule,
        CheckboxModule,
        StoryBulkActionsTableComponent,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              selected: "selected",
              selectionCleared: "Selection cleared",
              clear: "Clear",
              bulkActionsBar: "Bulk actions",
              bulkActionsBarAnnouncement:
                "__$1__ items selected. The bulk actions bar is now available at the bottom of the screen. Press __$2__+B to toggle focus to the bulk action bar.",
              close: "Close",
              loading: "Loading",
              move: "Move",
              archive: "Archive",
              delete: "Delete",
            }),
        },
      ],
    }),
  ],
  args: {
    selectedCount: 3,
  },
  argTypes: {
    clear: { action: "clear" },
  },
} as Meta<BulkActionsBarComponent>;

type Story = StoryObj<BulkActionsBarComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-bulk-actions-bar [selectedCount]="selectedCount" (clear)="clear($event)">
        <button bitBulkAction icon="bwi-folder" type="button">Move</button>
        <button bitBulkAction icon="bwi-archive" type="button">Archive</button>
        <button bitBulkAction icon="bwi-trash" type="button">Delete</button>
      </bit-bulk-actions-bar>
    `,
  }),
};

export const WithTableSelection: Story = {
  render: () => ({
    template: /*html*/ `<story-bulk-actions-table></story-bulk-actions-table>`,
  }),
};
