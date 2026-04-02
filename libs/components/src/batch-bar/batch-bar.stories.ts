import { OverlayModule } from "@angular/cdk/overlay";
import { CommonModule } from "@angular/common";
import { Meta, StoryObj, componentWrapperDecorator, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { CheckboxModule } from "../checkbox/checkbox.module";
import { TableDataSource } from "../table/table-data-source";
import { TableModule } from "../table/table.module";
import { I18nMockService } from "../utils/i18n-mock.service";

import { BatchBarComponent } from "./batch-bar.component";

const asyncDelay = (ms = 1500) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  title: "Component Library/Batch Bar",
  component: BatchBarComponent,
  decorators: [
    moduleMetadata({
      imports: [BatchBarComponent, OverlayModule, CommonModule, TableModule, CheckboxModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => new I18nMockService({}),
        },
      ],
    }),
    componentWrapperDecorator(
      (story) =>
        `<div class="tw-bg-background tw-p-10 tw-text-main tw-min-h-[200px]">${story}</div>`,
    ),
  ],
  args: {
    selectedCount: 3,
  },
  argTypes: {
    overflowButton: { control: "boolean" },
  },
} as Meta;

type Story = StoryObj<BatchBarComponent>;

/** Default state with a primary action, secondary actions, and an overflow menu. */
export const Default: Story = {
  render: (args) => ({
    props: {
      ...args,
      actions: [
        { label: "Move", icon: "bwi-folder", handler: () => asyncDelay() },
        { label: "Assign", icon: "bwi-users", handler: () => asyncDelay() },
        { label: "Export", icon: "bwi-download", handler: () => asyncDelay() },
      ],
      menuActions: [
        { label: "Archive", icon: "bwi-archive", handler: () => asyncDelay() },
        { label: "Delete", icon: "bwi-trash", handler: () => asyncDelay() },
      ],
      onCleared: () => alert("Selection cleared"),
    },
    template: /*html*/ `
      <bit-batch-bar
        [selectedCount]="selectedCount"
        [actions]="actions"
        [menuActions]="menuActions"
        [overflowButton]="overflowButton"
        (cleared)="onCleared()"
      />
    `,
  }),
};

/** Minimal setup — actions only, no overflow menu. */
export const NoOverflowMenu: Story = {
  render: (args) => ({
    props: {
      ...args,
      actions: [
        { label: "Move", icon: "bwi-folder", handler: () => asyncDelay() },
        { label: "Delete", icon: "bwi-trash", handler: () => asyncDelay() },
      ],
      onCleared: () => alert("Selection cleared"),
    },
    template: /*html*/ `
      <bit-batch-bar
        [selectedCount]="selectedCount"
        [actions]="actions"
        [overflowButton]="overflowButton"
        (cleared)="onCleared()"
      />
    `,
  }),
};

/** Actions disabled due to missing permissions remain visible with a muted color and tooltip. */
export const WithDisabledActions: Story = {
  render: (args) => ({
    props: {
      ...args,
      actions: [
        { label: "Move", icon: "bwi-folder", handler: () => asyncDelay() },
        {
          label: "Delete",
          icon: "bwi-trash",
          handler: () => asyncDelay(),
          inactive: true,
          inactiveReason: "You don't have permission to delete",
        },
        {
          label: "Export",
          icon: "bwi-download",
          handler: () => asyncDelay(),
          inactive: true,
          inactiveReason: "Export requires an Enterprise plan",
        },
      ],
      onCleared: () => alert("Selection cleared"),
    },
    template: /*html*/ `
      <bit-batch-bar
        [selectedCount]="selectedCount"
        [actions]="actions"
        (cleared)="onCleared()"
      />
    `,
  }),
};

/** Single item selected — count reads "1 selected". */
export const SingleSelection: Story = {
  args: {
    selectedCount: 1,
  },
  render: (args) => ({
    props: {
      ...args,
      actions: [
        { label: "Edit", icon: "bwi-pencil", handler: () => asyncDelay() },
        { label: "Clone", icon: "bwi-clone", handler: () => asyncDelay() },
        { label: "Delete", icon: "bwi-trash", handler: () => asyncDelay() },
      ],
      onCleared: () => alert("Selection cleared"),
    },
    template: /*html*/ `
      <bit-batch-bar
        [selectedCount]="selectedCount"
        [actions]="actions"
        (cleared)="onCleared()"
      />
    `,
  }),
};

interface SsoMember {
  id: number;
  name: string;
  email: string;
  ssoStatus: "Enrolled" | "Not enrolled";
  groups: number;
  lastActive: string;
}

const members: SsoMember[] = [
  {
    id: 1,
    name: "Alice Nguyen",
    email: "alice@acme.com",
    ssoStatus: "Enrolled",
    groups: 3,
    lastActive: "Mar 25, 2026",
  },
  {
    id: 2,
    name: "Bob Smith",
    email: "bob@acme.com",
    ssoStatus: "Not enrolled",
    groups: 1,
    lastActive: "Mar 20, 2026",
  },
  {
    id: 3,
    name: "Carol Davis",
    email: "carol@acme.com",
    ssoStatus: "Enrolled",
    groups: 2,
    lastActive: "Mar 18, 2026",
  },
  {
    id: 4,
    name: "David Lee",
    email: "david@acme.com",
    ssoStatus: "Not enrolled",
    groups: 0,
    lastActive: "Mar 10, 2026",
  },
  {
    id: 5,
    name: "Eva Martinez",
    email: "eva@acme.com",
    ssoStatus: "Enrolled",
    groups: 5,
    lastActive: "Mar 24, 2026",
  },
  {
    id: 6,
    name: "Frank Wilson",
    email: "frank@acme.com",
    ssoStatus: "Not enrolled",
    groups: 1,
    lastActive: "Feb 28, 2026",
  },
  {
    id: 7,
    name: "Grace Kim",
    email: "grace@acme.com",
    ssoStatus: "Enrolled",
    groups: 4,
    lastActive: "Mar 23, 2026",
  },
  {
    id: 8,
    name: "Henry Brown",
    email: "henry@acme.com",
    ssoStatus: "Not enrolled",
    groups: 2,
    lastActive: "Mar 15, 2026",
  },
];

const memberDataSource = new TableDataSource<SsoMember>();
memberDataSource.data = members;

/**
 * Fully interactive prototype showing the Batch Bar working with a data table.
 * Check rows to select them — the Batch Bar appears with bulk actions.
 * Use "Select all" to select every row at once, or press Escape to clear.
 */
export const WithDataTable: Story = {
  args: {
    selectedCount: 0,
  },
  render: () => ({
    props: {
      dataSource: memberDataSource,
      selectedIds: new Set<number>(),
      selectedCount: 0,
      allSelected: false,
      actions: [
        { label: "Activate SSO", icon: "bwi-key", handler: () => asyncDelay() },
        { label: "Add to group", icon: "bwi-users", handler: () => asyncDelay() },
        { label: "Reinvite", icon: "bwi-send", handler: () => asyncDelay() },
      ],
      menuActions: [{ label: "Remove members", icon: "bwi-trash", handler: () => asyncDelay() }],
      toggleRow(id: number, checked: boolean) {
        const next = new Set<number>(this.selectedIds as Set<number>);
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
        this.selectedIds = next;
        this.selectedCount = next.size;
        this.allSelected = next.size === members.length;
      },
      toggleAll(checked: boolean) {
        const next = new Set<number>();
        if (checked) {
          members.forEach((m) => next.add(m.id));
        }
        this.selectedIds = next;
        this.selectedCount = next.size;
        this.allSelected = checked;
      },
      onCleared() {
        this.selectedIds = new Set<number>();
        this.selectedCount = 0;
        this.allSelected = false;
      },
    },
    template: /*html*/ `
      <div class="tw-relative tw-pb-24">
        <bit-table [dataSource]="dataSource">
          <ng-container header>
            <tr>
              <th bitCell class="tw-w-14">
                <input
                  type="checkbox"
                  bitCheckbox
                  [checked]="allSelected"
                  (change)="toggleAll($any($event).target.checked)"
                  aria-label="Select all"
                />
              </th>
              <th bitCell>Member</th>
              <th bitCell>SSO status</th>
              <th bitCell class="tw-w-20">Groups</th>
              <th bitCell>Last active</th>
            </tr>
          </ng-container>
          <ng-template body let-rows$>
            <tr bitRow *ngFor="let r of rows$ | async">
              <td bitCell>
                <input
                  type="checkbox"
                  bitCheckbox
                  [checked]="selectedIds.has(r.id)"
                  (change)="toggleRow(r.id, $any($event).target.checked)"
                  [attr.aria-label]="'Select ' + r.name"
                />
              </td>
              <td bitCell>
                <div class="tw-font-semibold">{{ r.name }}</div>
                <div class="tw-text-muted tw-text-sm">{{ r.email }}</div>
              </td>
              <td bitCell>{{ r.ssoStatus }}</td>
              <td bitCell>{{ r.groups }}</td>
              <td bitCell>{{ r.lastActive }}</td>
            </tr>
          </ng-template>
        </bit-table>
        <bit-batch-bar
          [selectedCount]="selectedCount"
          [actions]="actions"
          [menuActions]="menuActions"
          (cleared)="onCleared()"
        />
      </div>
    `,
  }),
};

/** Hidden when selectedCount is 0 — the bar should not be visible. */
export const Hidden: Story = {
  args: {
    selectedCount: 0,
  },
  render: (args) => ({
    props: {
      ...args,
      actions: [{ label: "Move", icon: "bwi-folder", handler: () => asyncDelay() }],
      onCleared: () => alert("Selection cleared"),
    },
    template: /*html*/ `
      <p class="tw-text-muted">No rows selected — the Batch Bar is hidden.</p>
      <bit-batch-bar
        [selectedCount]="selectedCount"
        [actions]="actions"
        (cleared)="onCleared()"
      />
    `,
  }),
};
