import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../button/button";
import "../input/input";
import type { BitTabLink } from "./tab-nav-bar/tab-link";
import "./tab-group/tab";
import "./tab-group/tab-group";
import "./tab-nav-bar/tab-link";
import "./tab-nav-bar/tab-nav-bar";

type Args = { selectedIndex: number; preserveContent: boolean };

export default {
  title: "Component Library/Tabs",
  component: "bit-tab-group",
  args: { selectedIndex: 0, preserveContent: false },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-41432&t=b5tDKylm5sWm2yKo-4",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const ContentTabs: Story = {
  render: (args) => html`
    <bit-tab-group
      label="Main Content Tabs"
      class="tw-text-main"
      selected-index=${args.selectedIndex}
      ?preserve-content=${args.preserveContent}
    >
      <bit-tab label="First Tab">First Tab Content</bit-tab>
      <bit-tab label="Second Tab">Second Tab Content</bit-tab>
      <bit-tab label="Third Tab" start-icon="bwi-check-circle">Third Tab Content</bit-tab>
      <bit-tab disabled label="Disabled Tab">Disabled Content</bit-tab>
    </bit-tab-group>
  `,
};

/**
 * Stands in for the router: clicking a link marks it `active` and shows the matching "page".
 * In an app, set `active` from the router's current URL.
 */
function fakeRoute(event: MouseEvent) {
  const link = event
    .composedPath()
    .find((el): el is BitTabLink => (el as Element).tagName === "BIT-TAB-LINK");
  if (!link || link.disabled) {
    return;
  }
  event.preventDefault();
  const bar = link.closest("bit-tab-nav-bar");
  bar?.querySelectorAll("bit-tab-link").forEach((l) => (l.active = l === link));
  const outlet = bar?.nextElementSibling;
  if (outlet) {
    outlet.textContent = `Router - ${link.displayText} selected`;
  }
}

export const NavigationTabs: Story = {
  render: () => html`
    <bit-tab-nav-bar label="Main" @click=${fakeRoute}>
      <bit-tab-link href="#active" active berry-value="3" end-icon="bwi-check-circle"
        >Active</bit-tab-link
      >
      <bit-tab-link href="#item-2">Item 2</bit-tab-link>
      <bit-tab-link href="#item-3">Item 3</bit-tab-link>
      <bit-tab-link href="#item-with-child-counter">
        Item With Counter
        <div slot="end" class="tw-ps-2 tw-text-muted">42</div>
      </bit-tab-link>
      <bit-tab-link href="#disabled" disabled>Disabled</bit-tab-link>
    </bit-tab-nav-bar>
    <div class="tw-bg-transparent tw-text-semibold tw-text-center tw-text-main tw-py-10">
      Router - Active selected
    </div>
  `,
};

export const OverflowNavigationTabs: Story = {
  render: () => html`
    <bit-tab-nav-bar label="Main" @click=${fakeRoute}>
      <bit-tab-link
        href="#active"
        active
        label="Active Long Named Tab"
        start-icon="bwi-check-circle"
        berry-value="3"
        end-icon="bwi-check-circle"
      ></bit-tab-link>
      <bit-tab-link href="#item-2">Item 2 Long Named Tab</bit-tab-link>
      <bit-tab-link label="Item 3 Long Named Tab" href="#item-3"
        >Item 3 Long Named Tab</bit-tab-link
      >
      <bit-tab-link
        label="Item With Counter Long Named Tab"
        start-icon="bwi-check-circle"
        berry-value="3"
        end-icon="bwi-check-circle"
        href="#item-with-child-counter"
        >Item With Counter Long Named Tab</bit-tab-link
      >
      <bit-tab-link label="Disabled Long Named Tab" href="#disabled" disabled
        >Disabled Long Named Tab</bit-tab-link
      >
    </bit-tab-nav-bar>
    <div class="tw-bg-transparent tw-text-semibold tw-text-center tw-text-main tw-py-10">
      Router - Active Long Named Tab selected
    </div>
  `,
};

export const PreserveContentTabs: Story = {
  args: { preserveContent: true },
  render: (args) => html`
    <bit-tab-group
      label="Preserve Content Tabs"
      ?preserve-content=${args.preserveContent}
      class="tw-text-main"
    >
      <bit-tab label="Text Tab">
        <p>Play the video in the other tab and switch back to hear the video is still playing.</p>
      </bit-tab>
      <bit-tab label="Video Tab">
        <iframe
          width="560"
          height="315"
          src="https://www.youtube.com/embed/H0-yWbe5XG4"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </bit-tab>
    </bit-tab-group>
  `,
};

/**
 * Content inside a `<template>` child isn't created until the tab is first shown, and is removed
 * again when the tab is hidden unless `preserve-content` is set. Check the DOM while switching.
 */
export const LazyTemplateContent: Story = {
  render: (args) => html`
    <bit-tab-group label="Lazy Tabs" ?preserve-content=${args.preserveContent} class="tw-text-main">
      <bit-tab label="Eager">Slotted content is in the DOM but only rendered while active.</bit-tab>
      <bit-tab label="Lazy">
        <template>
          <p data-lazy>Stamped from a template on first activation.</p>
        </template>
      </bit-tab>
    </bit-tab-group>
  `,
};

export const KeyboardNavigation: Story = {
  render: () => html`
    <bit-tab-group label="Keyboard Navigation Tabs" class="tw-text-main">
      <bit-tab label="Form Tab">
        <p>
          You can navigate through all tab labels, form inputs, and the button that is outside the
          tab group via the keyboard.
        </p>
        <bit-input label="First Input"></bit-input>
        <bit-input label="Second Input"></bit-input>
      </bit-tab>
      <bit-tab label="No Focusable Content Tab" content-tab-index="0">
        <p>This tab has no focusable content, but the panel should still be focusable</p>
      </bit-tab>
    </bit-tab-group>
    <bit-button button-type="primary" class="tw-mt-5">External Button</bit-button>
  `,
};

export const TabsWithIcons: Story = {
  render: () => html`
    <bit-tab-group label="Tabs With Icons" class="tw-text-main">
      <bit-tab start-icon="bwi-check-circle" label="First Tab Content">First Tab Content</bit-tab>
      <bit-tab label="Second Tab" berry-value="2" end-icon="bwi-check-circle"
        >Second Tab Content</bit-tab
      >
      <bit-tab
        start-icon="bwi-check-circle"
        label="Third Tab Content"
        berry-value="3"
        end-icon="bwi-check-circle"
        >Third Tab Content</bit-tab
      >
    </bit-tab-group>
  `,
};

export const OverflowTabs: Story = {
  render: () => html`
    <bit-tab-group label="Overflow Tabs" class="tw-text-main">
      <bit-tab label="First Long Named Tab" end-icon="bwi-check-circle">First Tab Content</bit-tab>
      <bit-tab label="Second Long Named Tab" end-icon="bwi-check-circle"
        >Second Tab Content</bit-tab
      >
      <bit-tab label="Third Long Named Tab" end-icon="bwi-check-circle">Third Tab Content</bit-tab>
      <bit-tab label="Fourth Long Named Tab" end-icon="bwi-check-circle"
        >Fourth Tab Content</bit-tab
      >
      <bit-tab
        label="Another Even Longer Named Tab"
        start-icon="bwi-check-circle"
        end-icon="bwi-check-circle"
        >Another Even Longer Tab Content</bit-tab
      >
    </bit-tab-group>
  `,
};

/** The More menu open in a narrow container. */
export const OverflowMenuOpen: Story = {
  render: () => html`
    <div style="width: 360px">
      <bit-tab-group label="Overflow Tabs" class="tw-text-main">
        <bit-tab label="First Long Named Tab">First Tab Content</bit-tab>
        <bit-tab label="Second Long Named Tab" berry-value="4">Second Tab Content</bit-tab>
        <bit-tab label="Third Long Named Tab" start-icon="bwi-check-circle"
          >Third Tab Content</bit-tab
        >
        <bit-tab label="Disabled Tab" disabled>Disabled</bit-tab>
      </bit-tab-group>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector("bit-tab-group");
    await new Promise((resolve) => setTimeout(resolve, 300));
    group?.shadowRoot?.querySelector<HTMLButtonElement>("[data-more]")?.click();
  },
};
