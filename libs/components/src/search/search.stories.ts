import { DOCUMENT } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { formatArgsForCodeSnippet } from "@bitwarden/storybook";

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
  standalone: true,
  selector: "bw-windows-search-story",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SearchComponent, FormsModule],
  template: `<bit-search [useKeyShortcuts]="true"></bit-search>`,
  providers: [{ provide: DOCUMENT, useValue: makeDoc("Win32") }],
})
class WindowsSearchStoryComponent {}

@Component({
  standalone: true,
  selector: "bw-mac-search-story",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SearchComponent, FormsModule],
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
