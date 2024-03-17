import { Meta, StoryObj, componentWrapperDecorator, moduleMetadata } from "@storybook/angular";

import { TypographyModule } from "../typography";

import { SectionComponent } from "./section.component";

export default {
  title: "Component Library/Section",
  component: SectionComponent,
  decorators: [
    moduleMetadata({
      imports: [TypographyModule],
    }),
    componentWrapperDecorator((story) => `<div class="tw-text-main">${story}</div>`),
  ],
} as Meta;

type Story = StoryObj<SectionComponent>;

/** Sections are simple containers that apply a bottom margin. They often contain a heading. */
export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
        <bit-section>
            <h2 bitTypography="h2">Foo</h2>
            <p bitTypography="body1">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras vitae congue risus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nunc elementum odio nibh, eget pellentesque sem ornare vitae. Etiam vel ante et velit fringilla egestas a sed sem. Fusce molestie nisl et nisi accumsan dapibus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Sed eu risus ex. </p>
        </bit-section>
        <bit-section>
            <h2 bitTypography="h2">Bar</h2>
            <p bitTypography="body1">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras vitae congue risus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nunc elementum odio nibh, eget pellentesque sem ornare vitae. Etiam vel ante et velit fringilla egestas a sed sem. Fusce molestie nisl et nisi accumsan dapibus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Sed eu risus ex. </p>
        </bit-section>
    `,
  }),
};
