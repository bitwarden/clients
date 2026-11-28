import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, TemplateResult } from "lit";

import { hoverReveal, hoverRevealContainer } from "../hover-reveal/hover-reveal";

import { inLayout, LayoutStoryArgs } from "./story-helpers";
import "./nav-group";
import "./nav-item";
import "./nav-section";
import "./side-nav";
import "../berry/berry";
import "../chips/chip-action/chip-action";
import "../icon-button/icon-button";
import "../icon-tile/icon-tile";
import "../layout/layout";
import "../menu/menu";
import "../menu/menu-item";

type Args = LayoutStoryArgs & { hideIfEmpty?: boolean; renderChildren?: boolean };

export default {
  title: "Component Library/Nav/Nav Group",
  component: "bit-nav-group",
  decorators: [(story, { args }) => inLayout(args as Args, story() as never, { sideNav: false })],
  args: { legacy: true },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-40145&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

const vfo1 = { legacy: false };

const editButton = (className = "") =>
  html`<bit-icon-button
    slot="end"
    class=${className}
    icon="bwi-pencil-square"
    button-type="side-nav"
    size="xsmall"
    label="Edit"
    @click=${() => alert("Edit button clicked!")}
  ></bit-icon-button>`;

const children = (prefix = "") => html`
  <bit-nav-item text="Child A" href="#${prefix}a" icon="bwi-grid"></bit-nav-item>
  <bit-nav-item text="Child B" href="#${prefix}b"></bit-nav-item>
  <bit-nav-item text="Child C" href="#${prefix}c" icon="bwi-grid"></bit-nav-item>
`;

const buttonChildren = html`
  <bit-nav-item text="Child A" icon="bwi-grid"></bit-nav-item>
  <bit-nav-item text="Child B"></bit-nav-item>
  <bit-nav-item text="Child C" icon="bwi-grid"></bit-nav-item>
`;

const sideNav = (content: TemplateResult, variant = "primary") =>
  html`<bit-side-nav variant=${variant}>${content}</bit-side-nav>`;

export const Default: Story = {
  render: () =>
    sideNav(html`
      <bit-nav-group text="Hello World (Anchor)" href="#a" icon="bwi-grid"
        >${children()}</bit-nav-group
      >
      <bit-nav-group text="Lorem Ipsum (Button)" icon="bwi-grid">${buttonChildren}</bit-nav-group>
      <bit-nav-group open text="Lorem Ipsum (Button)" icon="bwi-grid"
        >${buttonChildren}</bit-nav-group
      >
    `),
};

export const DefaultVfo1: Story = { ...Default, args: vfo1 };

export const HideEmptyGroups: Story = {
  args: { hideIfEmpty: true, renderChildren: false },
  render: (args) =>
    sideNav(html`
      <bit-nav-group
        text="Hello World (Anchor)"
        href="#a"
        icon="bwi-grid"
        ?hide-if-empty=${args.hideIfEmpty}
      >
        ${args.renderChildren ? children() : ""}
      </bit-nav-group>
      <bit-nav-group text="Lorem Ipsum (Button)" icon="bwi-grid">${buttonChildren}</bit-nav-group>
    `),
};

export const Secondary: Story = {
  render: () =>
    sideNav(
      html`
        <bit-nav-group text="Hello World (Anchor)" href="#a" icon="bwi-grid">
          ${children()} ${editButton("tw-ms-auto")}
        </bit-nav-group>
        <bit-nav-group text="Lorem Ipsum (Button)" icon="bwi-grid">${buttonChildren}</bit-nav-group>
      `,
      "secondary",
    ),
};

export const SecondaryVfo1: Story = { ...Secondary, args: vfo1 };

export const NestedGroups: Story = {
  render: () =>
    sideNav(html`
      <bit-nav-group text="Nested groups example" icon="bwi-shared-folder" open>
        <bit-nav-item
          text="Level 1 - no children"
          href="#t2"
          icon="bwi-shared-folder"
        ></bit-nav-item>
        <bit-nav-group text="Level 1 - with children" href="#t3" icon="bwi-shared-folder" open>
          <bit-nav-group text="Level 2 - with children" href="#t4" icon="bwi-shared-folder" open>
            <bit-nav-item text="Level 3 - no children, no icon" href="#t5"></bit-nav-item>
            <bit-nav-group text="Level 3 - with children" href="#t6" icon="bwi-shared-folder" open>
              <bit-nav-item text="Level 4 - no children, no icon" href="#t7"></bit-nav-item>
              <bit-nav-group
                text="Level 4 - with children"
                href="#t8"
                icon="bwi-shared-folder"
                open
              >
                <bit-nav-item text="Level 5 - no children, no icon" href="#t9"></bit-nav-item>
              </bit-nav-group>
            </bit-nav-group>
          </bit-nav-group>
        </bit-nav-group>
      </bit-nav-group>
    `),
};

export const NestedGroupsVfo1: Story = { ...NestedGroups, args: vfo1 };

/** Leaf rows reserve the toggle's width only when a row in their own group or section has one. */
export const NestedGroupsInSectionsVfo1: Story = {
  args: vfo1,
  render: () =>
    sideNav(html`
      <bit-nav-group text="Organization" open>
        <bit-nav-item text="All items" href="#t1" icon="bwi-list-alt"></bit-nav-item>
        <bit-nav-item text="Shared folders" href="#t2" icon="bwi-shared-folder"></bit-nav-item>
        <bit-nav-section label="Pinned">
          <bit-nav-item text="No children" href="#t3" icon="bwi-shared-folder"></bit-nav-item>
          <bit-nav-item text="No children" href="#t3"></bit-nav-item>
          <bit-nav-group text="With children" href="#t4" icon="bwi-shared-folder" open>
            <bit-nav-item text="Child" href="#t5" icon="bwi-shared-folder"></bit-nav-item>
          </bit-nav-group>
        </bit-nav-section>
        <bit-nav-section label="Recent">
          <bit-nav-item text="Folder A" href="#t6" icon="bwi-shared-folder"></bit-nav-item>
          <bit-nav-item text="Folder B" href="#t7" icon="bwi-shared-folder"></bit-nav-item>
        </bit-nav-section>
      </bit-nav-group>
    `),
};

export const ForcedActive: Story = {
  render: () =>
    sideNav(html`
      <bit-nav-group
        text="Hello World (Anchor)"
        href="#a"
        icon="bwi-grid"
        hide-if-empty
      ></bit-nav-group>
      <bit-nav-group
        text="Lorem Ipsum (Button)"
        icon="bwi-grid"
        force-active-styles
        disable-toggle-on-click
      >
        ${buttonChildren}
      </bit-nav-group>
    `),
};

/**
 * `active` replaces `routerLinkActive`. An active item opens every ancestor group, so the current
 * page is visible on load. Click rows to toggle; groups are buttons (or links) so Enter and Space
 * work from the keyboard.
 */
export const ActiveChildOpensGroupsVfo1: Story = {
  args: vfo1,
  render: () =>
    sideNav(html`
      <bit-nav-group text="Vault" icon="bwi-lock" href="#vault">
        <bit-nav-item text="All items" href="#all"></bit-nav-item>
        <bit-nav-group text="Folders" href="#folders">
          <bit-nav-item text="Work" href="#work" active></bit-nav-item>
          <bit-nav-item text="Personal" href="#personal"></bit-nav-item>
        </bit-nav-group>
      </bit-nav-group>
      <bit-nav-group text="Send" icon="bwi-send">${buttonChildren}</bit-nav-group>
    `),
};

export const WithTrailingElements: Story = {
  render: () =>
    sideNav(html`
      <bit-nav-group text="With Nav Button" href="#a" icon="bwi-filter">
        <bit-nav-item text="Child A" href="#aa"></bit-nav-item>
        <bit-nav-item text="Child B" href="#ab"></bit-nav-item>
        ${editButton("tw-ms-auto")}
      </bit-nav-group>
      <bit-nav-group text="With Chip" href="#d" icon="bwi-filter">
        <bit-nav-item text="Child A" href="#da"></bit-nav-item>
        <bit-nav-item text="Child B" href="#db"></bit-nav-item>
        <bit-chip-action
          slot="end"
          start-icon="bwi-diamond"
          label="Premium"
          size="small"
        ></bit-chip-action>
      </bit-nav-group>
      <bit-nav-group text="With Berry" href="#e" icon="bwi-filter">
        <bit-nav-item text="Child A" href="#ea"></bit-nav-item>
        <bit-nav-item text="Child B" href="#eb"></bit-nav-item>
        <bit-berry slot="end" variant="danger" .value=${1}></bit-berry>
      </bit-nav-group>
      <bit-nav-group text="With Text" href="#f" icon="bwi-filter">
        <bit-nav-item text="Child A" href="#fa"></bit-nav-item>
        <bit-nav-item text="Child B" href="#fb"></bit-nav-item>
        <span slot="end">12</span>
      </bit-nav-group>
    `),
};

let menuCount = 0;

export const WithHoverReveal: Story = {
  render: () => {
    const triggerId = `nav-group-menu-trigger-${menuCount++}`;
    return html`
      ${sideNav(html`
        <bit-nav-group text="Shared folder" icon="bwi-folder" open ${hoverRevealContainer()}>
          <bit-icon-button
            slot="end"
            icon="bwi-ellipsis-v"
            button-type="side-nav"
            size="xsmall"
            label="Options"
            id=${triggerId}
            ${hoverReveal()}
          ></bit-icon-button>
          <bit-nav-item text="Child A" icon="bwi-folder"></bit-nav-item>
          <bit-nav-item text="Child B" icon="bwi-folder"></bit-nav-item>
        </bit-nav-group>
      `)}
      <bit-menu trigger=${triggerId}>
        <bit-menu-item>Rename</bit-menu-item>
        <bit-menu-item>Unpin</bit-menu-item>
      </bit-menu>
    `;
  },
};

export const WithHoverRevealVfo1: Story = { ...WithHoverReveal, args: vfo1 };

/**
 * A `bit-icon-tile` in a top-level nav group becomes its leading glyph — no `slot` attribute
 * needed, the tile is matched by its tag. (Other leading content still uses `slot="start"`.) Only
 * available in the VFO1 design for top-level groups; the collapse toggle owns the leading position
 * for legacy groups and nested groups.
 */
export const WithStartSlot: Story = {
  args: vfo1,
  render: () =>
    sideNav(html`
      <bit-nav-group text="With Icon Tile" href="#a">
        <bit-icon-tile icon="bwi-star" variant="primary" size="sm"></bit-icon-tile>
        <bit-nav-item text="Child A" href="#aa"></bit-nav-item>
        <bit-nav-item text="Child B" href="#ab"></bit-nav-item>
      </bit-nav-group>
    `),
};

const interactionGroup = (text: string, testClass: string, active = false) =>
  html`<bit-nav-group
    class=${testClass}
    text=${text}
    href="#a"
    icon="bwi-filter"
    ?force-active-styles=${active}
  >
    ${editButton("tw-ms-auto")}
  </bit-nav-group>`;

/** Forces hover and focus-visible states on the group rows with story-only classes. */
export const InteractionStates: Story = {
  render: () =>
    sideNav(html`
      ${interactionGroup("Nav Group", "")} ${interactionGroup("Nav Group Hover", "tw-test-hover")}
      ${interactionGroup("Nav Group Focus", "tw-test-focus-visible")}
      ${interactionGroup("Nav Group Active", "", true)}
      ${interactionGroup("Nav Group Active Hover", "tw-test-hover", true)}
      ${interactionGroup("Nav Group Active Focus", "tw-test-focus-visible", true)}
    `),
};

export const InteractionStatesVfo1: Story = { ...InteractionStates, args: vfo1 };
