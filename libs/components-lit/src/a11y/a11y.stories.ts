import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../button/button";
import "../icon-button/icon-button";

import { a11yTitle } from "./a11y-title";
import { ariaDisable } from "./aria-disable";
import { autofocus, autofocusFallback } from "./autofocus";
import { createRouterFocusManager } from "./router-focus-manager";

export default {
  title: "Component Library/A11y",
} satisfies Meta;

type Story = StoryObj;

const log = (event: Event) => {
  const output = (event.currentTarget as HTMLElement)
    .closest("[data-demo]")
    ?.querySelector("output");
  if (output) {
    output.textContent = `Clicked at ${new Date().toLocaleTimeString()}`;
  }
};

/** `a11yTitle()` sets `title` and `aria-label` together. Hover for the native tooltip. */
export const A11yTitle: Story = {
  render: () => html`
    <button
      type="button"
      class="tw-rounded tw-border tw-border-solid tw-border-border-base tw-px-3 tw-py-1"
      ${a11yTitle("Copy password")}
    >
      <i class="bwi bwi-clone" aria-hidden="true"></i>
    </button>
  `,
};

/**
 * `ariaDisable()` keeps a disabled control focusable (`aria-disabled`) while swallowing its clicks.
 * Built into `bit-button`; use it for other elements such as links.
 */
export const AriaDisable: Story = {
  render: () => html`
    <div data-demo class="tw-flex tw-flex-col tw-gap-2 tw-items-start">
      <a href="#" class="tw-text-fg-brand tw-underline" ${ariaDisable(true)} @click=${log}
        >Disabled link (still focusable, clicks ignored)</a
      >
      <a
        href="#"
        class="tw-text-fg-brand tw-underline"
        ${ariaDisable(false)}
        @click=${(e: Event) => {
          e.preventDefault();
          log(e);
        }}
        >Enabled link</a
      >
      <output class="tw-text-sm tw-text-muted"></output>
    </div>
  `,
};

/** `autofocus()` focuses the element once it's visible. */
export const Autofocus: Story = {
  render: () => html`
    <div class="tw-flex tw-gap-2">
      <bit-button>Not focused</bit-button>
      <bit-button ${autofocus()}>Autofocused</bit-button>
    </div>
  `,
};

/**
 * `autofocusFallback(el)` focuses `el` (here the heading) only when nothing inside the container has
 * `autofocus()`. Add `autofocus()` to the button and the heading is left alone.
 */
export const AutofocusFallback: Story = {
  render: () => {
    const heading = document.createElement("h2");
    heading.tabIndex = -1;
    heading.className = "tw-text-lg tw-font-medium focus:tw-outline focus:tw-outline-2";
    heading.textContent = "Dialog title (fallback focus target)";
    return html`
      <div
        class="tw-border tw-border-solid tw-border-border-base tw-rounded-xl tw-p-4"
        ${autofocusFallback(heading)}
      >
        ${heading}
        <bit-button>Action</bit-button>
      </div>
    `;
  },
};

/**
 * Simulated SPA navigation. The first "navigation" (page load) is skipped; later ones focus `main`
 * unless the link opts out or names another target.
 */
export const RouterFocusManager: Story = {
  render: () => {
    const manager = createRouterFocusManager();
    void manager.onNavigationEnd();
    const navigate = (focusAfterNav?: boolean | string) => (event: Event) => {
      const page = (event.currentTarget as HTMLElement)
        .closest("[data-demo]")
        ?.querySelector("[data-page]");
      if (page) {
        page.textContent = `Page loaded at ${new Date().toLocaleTimeString()}`;
      }
      void manager.onNavigationEnd(focusAfterNav);
    };
    return html`
      <div data-demo class="tw-flex tw-flex-col tw-gap-4">
        <nav class="tw-flex tw-gap-2">
          <bit-button @click=${navigate()}>Navigate (focus main)</bit-button>
          <bit-button @click=${navigate("#custom-target")}>Navigate (focus custom)</bit-button>
          <bit-button @click=${navigate(false)}>Navigate (opt out)</bit-button>
        </nav>
        <main
          tabindex="-1"
          class="tw-border tw-border-solid tw-border-border-base tw-rounded-xl tw-p-4 focus:tw-outline focus:tw-outline-2"
        >
          <p data-page>Initial page</p>
          <button
            id="custom-target"
            type="button"
            class="tw-rounded tw-border tw-border-solid tw-border-border-base tw-px-3 tw-py-1 focus:tw-outline focus:tw-outline-2"
          >
            Custom target
          </button>
        </main>
      </div>
    `;
  },
};
