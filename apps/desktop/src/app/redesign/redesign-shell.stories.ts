import type { Meta, StoryObj } from "@storybook/angular";

import { KlsRedesignShellComponent } from "./redesign-shell.component";

/**
 * FORK (klappstuhl): viewable preview of the redesigned desktop shell.
 * Run `npm run storybook` and open "Fork Redesign / App Shell". No native
 * module, Electron, or server needed — renders the standalone components with
 * the fork theme and mock data.
 */
export default {
  title: "Fork Redesign/App Shell",
  component: KlsRedesignShellComponent,
  parameters: { layout: "fullscreen" },
} as Meta<KlsRedesignShellComponent>;

type Story = StoryObj<KlsRedesignShellComponent>;

export const Default: Story = {};
