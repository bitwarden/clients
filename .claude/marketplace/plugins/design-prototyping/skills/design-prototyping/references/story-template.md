# Prototype story template

Location: `libs/components/src/stories/playground/<prototype-name>/<prototype-name>.stories.ts`, with `<prototype-name>` in kebab-case.

```ts
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule, CalloutModule, SectionComponent, TypographyModule } from "../../..";
import { I18nMockService } from "../../../utils/i18n-mock.service";

export default {
  title: "Playground / Vault Empty State",
  decorators: [
    moduleMetadata({
      imports: [ButtonModule, CalloutModule, SectionComponent, TypographyModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              close: "Close",
              loading: "Loading",
            }),
        },
      ],
    }),
  ],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} as Meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-section>
        <h2 bitTypography="h2">Your vault is empty</h2>
        <p bitTypography="body1" class="tw-text-fg-body-subtle">Add your first login to get started.</p>
        <button bitButton buttonType="primary" type="button">New login</button>
      </bit-section>
    `,
  }),
};
```

## Notes

- **Title** always starts with `Playground / `, followed by a human-readable prototype name.
- **Imports** come from the library barrel (`"../../.."`). Add each component's module (or standalone component) to `moduleMetadata.imports`; a missing import usually shows up as an unknown element or attribute error.
- **I18nService mock:** many components translate built-in labels (close buttons, loading text, pagination). If text renders blank or a console error names a missing key, add that key to the mock. Copy keys from the component's own `.stories.ts` file.
- **Other services:** if a component needs more providers (router, dialogs, toasts, state), copy the setup from that component's stories or from `stories/kitchen-sink/kitchen-sink.stories.ts`.
- **Full pages** (side nav, header, page layout) need `positionFixedWrapperDecorator()` from `../../storybook-decorators` and usually a router. Follow the kitchen sink.
- **Interactivity:** for state the template can't express (toggling, filtering, multi-step flows), add a standalone component in the same folder, e.g. `vault-empty-state.component.ts`, and render it from the story. Use signals for local state.
- **Variants:** one exported story per state the designer wants to compare (`Default`, `Empty`, `Loading`, `LongContent`). Use `args` only if the designer wants to tweak values in the Controls panel.
- **Realistic content:** use plausible Bitwarden content (login names, URLs, folder names), never real credentials or personal data.
