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
 * `bit-page` fills `bit-layout`'s main content area as a full-height flex column:
 * a fixed `[slot=header]` and `[slot=footer]`, and a body (default slot) that fills
 * the remaining height and scrolls. Note the header and footer stay put while the
 * body scrolls.
 */
export const Default: Story = {
  render: () => ({
    props: { rows: [...Array(60).keys()] },
    template: /* HTML */ `
      <bit-layout disablePadding>
        <bit-side-nav></bit-side-nav>
        <bit-page>
          <div slot="header" class="tw-mb-4 tw-flex tw-items-center tw-justify-between">
            <h1 bitTypography="h1" class="tw-mb-0">Page title</h1>
            <button bitButton buttonType="primary" type="button">Action</button>
          </div>

          @for (row of rows; track row) {
          <p bitTypography="body1">
            Row {{ row }} — the body fills the page height and scrolls; the header and footer stay
            pinned.
          </p>
          }

          <div slot="footer" class="tw-mt-4">
            <button bitButton buttonType="secondary" type="button">Footer action</button>
          </div>
        </bit-page>
      </bit-layout>
    `,
  }),
};
