import { RouterTestingModule } from "@angular/router/testing";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";

import { ButtonModule } from "../button";
import { NavigationModule } from "../navigation";
import { positionFixedWrapperDecorator } from "../stories/storybook-decorators";
import { TypographyModule } from "../typography";
import { I18nMockService } from "../utils/i18n-mock.service";
import { StorybookGlobalStateProvider } from "../utils/state-mock";

import { LayoutComponent } from "./layout.component";
import { mockLayoutI18n } from "./mocks";
import { PageComponent } from "./page.component";

export default {
  title: "Component Library/Layout/Page",
  component: PageComponent,
  decorators: [
    positionFixedWrapperDecorator(),
    moduleMetadata({
      imports: [
        LayoutComponent,
        NavigationModule,
        RouterTestingModule,
        ButtonModule,
        TypographyModule,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () => new I18nMockService(mockLayoutI18n),
        },
      ],
    }),
    applicationConfig({
      providers: [
        {
          provide: GlobalStateProvider,
          useClass: StorybookGlobalStateProvider,
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<PageComponent>;

/**
 * `bit-page` fills `bit-layout`'s main content area as a full-height flex column
 * whose body fills the remaining height and scrolls.
 */
export const Default: Story = {
  render: () => ({
    props: { rows: [...Array(60).keys()] },
    template: /* HTML */ `
      <bit-layout>
        <bit-side-nav></bit-side-nav>
        <bit-page>
          <div class="tw-mb-4 tw-flex tw-items-center tw-justify-between">
            <h1 bitTypography="h1" class="tw-mb-0">Page title</h1>
            <button bitButton buttonType="primary" type="button">Action</button>
          </div>

          @for (row of rows; track row) {
          <p bitTypography="body1">Row {{ row }} — the body fills the page height and scrolls.</p>
          }
        </bit-page>
      </bit-layout>
    `,
  }),
};
