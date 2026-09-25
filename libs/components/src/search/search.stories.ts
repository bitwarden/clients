import { DOCUMENT } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { RouterTestingModule } from "@angular/router/testing";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { formatArgsForCodeSnippet } from "@bitwarden/storybook";

import { ButtonModule } from "../button";
import { DialogModule, DialogService } from "../dialog";
import { InputModule } from "../input/input.module";
import { I18nMockService } from "../utils/i18n-mock.service";

import { SearchComponent } from "./search.component";

export default {
  title: "Component Library/Form/Search",
  component: SearchComponent,
  decorators: [
    moduleMetadata({
      imports: [InputModule, FormsModule, ReactiveFormsModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              search: "Search",
              resetSearch: "Reset search",
              clearSearchTooltip: "Clear by clicking here or pressing Esc.",
              close: "Close",
            });
          },
        },
      ],
    }),
  ],
  args: {
    placeholder: "search",
    disabled: false,
  },
} as Meta;

type Story = StoryObj<SearchComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-search [(ngModel)]="searchText"${formatArgsForCodeSnippet<SearchComponent>(args)}></bit-search>
    `,
  }),
  args: {},
};

export const WithShortcutHints: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-search [(ngModel)]="searchText"${formatArgsForCodeSnippet<SearchComponent>(args)}></bit-search>
    `,
  }),
  args: {
    useKeyShortcuts: true,
  },
};

const makeDoc = (platform: string) =>
  ({
    defaultView: { navigator: { platform } },
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as Document;

@Component({
  selector: "bw-windows-search-story",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SearchComponent],
  template: `<bit-search [useKeyShortcuts]="true"></bit-search>`,
  providers: [{ provide: DOCUMENT, useValue: makeDoc("Win32") }],
})
class WindowsSearchStoryComponent {}

@Component({
  selector: "bw-mac-search-story",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SearchComponent],
  template: `<bit-search [useKeyShortcuts]="true"></bit-search>`,
  providers: [{ provide: DOCUMENT, useValue: makeDoc("MacIntel") }],
})
class MacSearchStoryComponent {}

export const WithShortcutHintsWindows: Story = {
  decorators: [moduleMetadata({ imports: [WindowsSearchStoryComponent] })],
  render: () => ({ template: `<bw-windows-search-story></bw-windows-search-story>` }),
};

export const WithShortcutHintsMac: Story = {
  decorators: [moduleMetadata({ imports: [MacSearchStoryComponent] })],
  render: () => ({ template: `<bw-mac-search-story></bw-mac-search-story>` }),
};

@Component({
  selector: "bw-dialog-search-story",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SearchComponent, ButtonModule],
  template: `
    <bit-search [useKeyShortcuts]="true" placeholder="Page search" />
    <div class="tw-mt-4 tw-flex tw-gap-2">
      <button bitButton type="button" (click)="openDialogWithSearch()">
        Open dialog with a search
      </button>
      <button bitButton type="button" (click)="openDialogWithoutSearch()">
        Open dialog without a search
      </button>
    </div>
  `,
})
class DialogSearchStoryComponent {
  private dialogService = inject(DialogService);

  openDialogWithSearch() {
    this.dialogService.open(DialogWithSearchComponent);
  }

  openDialogWithoutSearch() {
    this.dialogService.open(DialogWithoutSearchComponent);
  }
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SearchComponent, DialogModule, ButtonModule],
  template: `
    <bit-dialog title="Dialog">
      <span bitDialogContent>
        <bit-search [useKeyShortcuts]="true" placeholder="Dialog search" />
      </span>
      <ng-container bitDialogFooter>
        <button type="button" bitButton buttonType="secondary" bitDialogClose>Close</button>
      </ng-container>
    </bit-dialog>
  `,
})
class DialogWithSearchComponent {}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, ButtonModule],
  template: `
    <bit-dialog title="Dialog">
      <span bitDialogContent>No search in here.</span>
      <ng-container bitDialogFooter>
        <button type="button" bitButton buttonType="secondary" bitDialogClose>Close</button>
      </ng-container>
    </bit-dialog>
  `,
})
class DialogWithoutSearchComponent {}

/**
 * ⌘/Ctrl+F is a noop for any search behind an open dialog — the browser's native find opens
 * instead. With the dialog that has no search, nothing takes the shortcut at all; with the dialog
 * that has one, the search inside it still responds. Closing either restores the page search.
 */
export const WithDialogOpen: Story = {
  parameters: {
    // Nothing renders until a button is clicked, so there is no state worth snapshotting.
    chromatic: { disableSnapshot: true },
  },
  decorators: [
    moduleMetadata({
      imports: [DialogSearchStoryComponent, NoopAnimationsModule, RouterTestingModule],
      providers: [DialogService],
    }),
  ],
  render: () => ({ template: `<bw-dialog-search-story></bw-dialog-search-story>` }),
};
