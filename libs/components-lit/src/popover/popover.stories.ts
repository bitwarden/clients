import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, render } from "lit";
import { ref } from "lit/directives/ref.js";

import "../button/button";
import "../icon/icon";
import "../icon-button/icon-button";
import "../link/link";

import { attachPopoverAnchor } from "./attach-popover";
import "./popover";
import type { BitPopover } from "./popover";
import "./popover-footer";
import "./popover-header";
import { popoverTrigger } from "./popover-directive";
import { PopoverPosition } from "./popover-position";
import { openPopover, PopoverRef } from "./popover-ref";

type Args = { position: PopoverPosition };

const positions: PopoverPosition[] = [
  "right-start",
  "right-center",
  "right-end",
  "left-start",
  "left-center",
  "left-end",
  "below-start",
  "below-center",
  "below-end",
  "above-start",
  "above-center",
  "above-end",
];

const openTrigger = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await customElements.whenDefined("bit-popover");
  await new Promise((resolve) => requestAnimationFrame(resolve));
  canvasElement.querySelector<HTMLElement>("[data-trigger]")?.click();
};

const trigger = (position?: PopoverPosition) => html`
  <bit-icon-button
    id="trigger"
    data-trigger
    icon="bwi-question-circle"
    label="Open popover"
    button-type="primaryGhost"
    tooltip=""
  ></bit-icon-button>
  <bit-popover
    trigger="trigger"
    position=${position ?? "right-start"}
    heading="We've just released a new dashboard"
  >
    A new and improved dashboard is now live! Enjoy a smoother, more intuitive experience.
  </bit-popover>
`;

const footer = html`<bit-popover-footer>
  <div class="tw-flex tw-gap-2">
    <bit-button end-icon="bwi-arrow-right" button-type="secondary">Read more</bit-button>
    <bit-button end-icon="bwi-arrow-right" button-type="primary">Confirm</bit-button>
  </div>
</bit-popover-footer>`;

const media = html`<bit-popover-header>
  <div slot="media" class="tw-h-[200px] tw-bg-bg-gray tw-flex tw-items-center tw-justify-center">
    <h1>Media Slot</h1>
  </div>
</bit-popover-header>`;

export default {
  title: "Component Library/Popover",
  component: "bit-popover",
  args: { position: "right-start" },
  argTypes: { position: { control: "select", options: positions } },
  parameters: { chromatic: { disableSnapshot: true } },
  render: (args) => html`<div class="tw-mt-44 tw-h-[400px]">${trigger(args.position)}</div>`,
  play: openTrigger,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const WithFooter: Story = {
  render: () =>
    html`<div class="tw-mt-44 tw-h-[400px]">
      <bit-icon-button
        id="t"
        data-trigger
        icon="bwi-question-circle"
        label="Open popover"
        tooltip=""
      ></bit-icon-button>
      <bit-popover trigger="t" heading="We've just released a new dashboard">
        A new and improved dashboard is now live! Enjoy a smoother, more intuitive experience.
        ${footer}
      </bit-popover>
    </div>`,
};

export const WithMedia: Story = {
  render: () =>
    html`<div class="tw-mt-44 tw-h-[400px]">
      <bit-icon-button
        id="t"
        data-trigger
        icon="bwi-question-circle"
        label="Open popover"
        tooltip=""
      ></bit-icon-button>
      <bit-popover trigger="t" heading="We've just released a new dashboard">
        ${media} A new and improved dashboard is now live! Enjoy a smoother, more intuitive
        experience.
      </bit-popover>
    </div>`,
};

export const WithMediaAndFooter: Story = {
  render: () =>
    html`<div class="tw-mt-44 tw-h-[500px]">
      <bit-icon-button
        id="t"
        data-trigger
        icon="bwi-question-circle"
        label="Open popover"
        tooltip=""
      ></bit-icon-button>
      <bit-popover trigger="t" heading="We've just released a new dashboard">
        ${media} A new and improved dashboard is now live! Enjoy a smoother, more intuitive
        experience. ${footer}
      </bit-popover>
    </div>`,
};

export const Stepper: Story = {
  render: () => {
    let step = 1;
    const update = (host: HTMLElement) => {
      const popover = host.querySelector<BitPopover>("bit-popover")!;
      render(
        html`<bit-popover-header>
            <div class="tw-h-[200px] tw-bg-bg-gray tw-flex tw-items-center tw-justify-center">
              <h1>Media Slot</h1>
            </div>
          </bit-popover-header>
          <p class="tw-mb-2 tw-mt-0">
            A new and improved dashboard is now live! Enjoy a smoother, more intuitive experience.
          </p>
          <ul class="tw-list-none tw-ps-0 tw-mb-2 tw-mt-0">
            <li class="tw-flex tw-items-center tw-gap-2 tw-mb-1">
              <bit-icon name="bwi-check" class="tw-text-success-600"></bit-icon> Upper &amp; lower
              case letters
            </li>
            <li class="tw-flex tw-items-center tw-gap-2 tw-mb-1">
              <bit-icon name="bwi-close" class="tw-text-danger-600"></bit-icon> A symbol (#$&amp;)
            </li>
            <li class="tw-flex tw-items-center tw-gap-2">
              <bit-icon name="bwi-close" class="tw-text-danger-600"></bit-icon> A longer password
            </li>
          </ul>
          <bit-link href="#" end-icon="bwi-arrow-right">Learn more</bit-link>
          <bit-popover-footer>
            <div class="tw-flex tw-items-center tw-justify-between tw-w-full">
              <span class="tw-text-sm">${step} of 5</span>
              <div class="tw-flex tw-items-center tw-gap-2">
                <bit-button
                  button-type="secondary"
                  ?disabled=${step === 1}
                  @click=${() => {
                    step--;
                    update(host);
                  }}
                  >Back</bit-button
                >
                <bit-button
                  button-type="primary"
                  @click=${() => {
                    if (step < 5) {
                      step++;
                      update(host);
                    } else {
                      popover.close();
                    }
                  }}
                  >${step === 5 ? "Finish" : "Next"}</bit-button
                >
              </div>
            </div>
          </bit-popover-footer>`,
        popover,
      );
    };
    return html`<div class="tw-mt-44 tw-h-[500px]" ${refCallback((host) => update(host))}>
      <bit-icon-button
        id="t"
        data-trigger
        icon="bwi-question-circle"
        label="Open popover"
        tooltip=""
      ></bit-icon-button>
      <bit-popover trigger="t" heading="We've just released a new dashboard"></bit-popover>
    </div>`;
  },
};

const positioned = (position: PopoverPosition, justify: string): Story => ({
  args: { position },
  render: (args) =>
    html`<div class="tw-h-[500px] tw-mt-44">
      <div class="tw-flex ${justify}">${trigger(args.position)}</div>
    </div>`,
});

export const RightStart = positioned("right-start", "");
export const RightCenter = positioned("right-center", "");
export const RightEnd = positioned("right-end", "");
export const LeftStart = positioned("left-start", "tw-justify-end");
export const LeftCenter = positioned("left-center", "tw-justify-end");
export const LeftEnd = positioned("left-end", "tw-justify-end");
export const BelowStart = positioned("below-start", "tw-justify-center");
export const BelowCenter = positioned("below-center", "tw-justify-center");
export const BelowEnd = positioned("below-end", "tw-justify-center");
export const AboveStart = positioned("above-start", "tw-justify-center");
export const AboveCenter = positioned("above-center", "tw-justify-center");
export const AboveEnd = positioned("above-end", "tw-justify-center");

const card = (id: string, icon: string, heading: string, text: string) =>
  html`<div
    id=${id}
    class="tw-p-6 tw-border tw-border-solid tw-border-secondary-300 tw-rounded-lg tw-bg-background tw-text-center"
  >
    <bit-icon name=${icon} class="tw-text-4xl tw-text-primary-600 tw-mb-3"></bit-icon>
    <h3 class="tw-text-base tw-font-semibold tw-mb-2">${heading}</h3>
    <p class="tw-text-sm tw-text-muted tw-mb-0">${text}</p>
  </div>`;

export const SpotlightTour: Story = {
  play: undefined,
  render: () => {
    const setStep = (host: HTMLElement, step: number) => {
      host.querySelectorAll<BitPopover>("bit-popover").forEach((popover, index) => {
        popover.open = index + 1 === step;
      });
    };
    const host = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>("[data-tour]")!;
    const step = (n: number, title: string, body: string, last = false) =>
      html`<bit-popover
        anchor="step${n}"
        position="below-center"
        spotlight
        heading=${title}
        @closed=${(e: Event) => setStep(host(e), 0)}
      >
        <div>${body}</div>
        <div class="tw-flex tw-gap-2 tw-mt-4">
          <bit-button
            button-type="primary"
            @click=${(e: Event) => setStep(host(e), last ? 0 : n + 1)}
            >${last ? "Finish Tour" : "Next"}</bit-button
          >
          <bit-button button-type="secondary" @click=${(e: Event) => setStep(host(e), 0)}
            >Skip Tour</bit-button
          >
        </div>
      </bit-popover>`;
    return html`<div data-tour class="tw-h-[600px] tw-mt-32">
      <div class="tw-mb-6">
        <bit-button button-type="primary" @click=${(e: Event) => setStep(host(e), 1)}
          >Start Tour</bit-button
        >
      </div>
      <div class="tw-grid tw-grid-cols-3 tw-gap-4">
        ${card("step1", "bwi-plus-circle", "Create", "Add new items")}
        ${card("step2", "bwi-search", "Search", "Find anything")}
        ${card("step3", "bwi-cog", "Settings", "Configure options")}
      </div>
      ${step(1, "Step 1: Create Items", "Click the Create button to add new items to your vault.")}
      ${step(2, "Step 2: Search", "Use the Search feature to quickly find any item in your vault.")}
      ${step(
        3,
        "Step 3: Settings",
        "Access Settings to customize your experience and manage your account.",
        true,
      )}
    </div>`;
  },
};

export const MultipleSpotlights: Story = {
  play: undefined,
  render: () => {
    const popovers = (e: Event) =>
      (e.target as HTMLElement).closest("[data-root]")!.querySelectorAll<BitPopover>("bit-popover");
    return html`<div data-root class="tw-h-[600px] tw-mt-32">
      <div class="tw-mb-6 tw-flex tw-gap-2">
        <bit-button
          button-type="primary"
          @click=${(e: Event) => popovers(e).forEach((p) => (p.open = true))}
          >Open Both</bit-button
        >
        <bit-button
          button-type="secondary"
          @click=${(e: Event) => popovers(e).forEach((p) => (p.open = false))}
          >Close Both</bit-button
        >
      </div>
      <div class="tw-grid tw-grid-cols-2 tw-gap-8">
        ${card("feature1", "bwi-star", "Feature 1", "First feature card")}
        ${card("feature2", "bwi-heart", "Feature 2", "Second feature card")}
      </div>
      <bit-popover anchor="feature1" spotlight position="below-center" heading="Feature 1">
        <div>This is the first popover with spotlight.</div>
        <p class="tw-mt-2 tw-mb-0">
          All spotlight popovers are automatically grouped, so only one can be open at a time.
        </p>
      </bit-popover>
      <bit-popover anchor="feature2" spotlight position="below-center" heading="Feature 2">
        <div>This is the second popover with spotlight.</div>
        <p class="tw-mt-2 tw-mb-0">
          When you opened both, Feature 1 automatically closed because spotlight popovers are
          grouped.
        </p>
      </bit-popover>
    </div>`;
  },
};

export const SpotlightFollowsLayoutShift: Story = {
  play: undefined,
  render: () =>
    html`<div class="tw-h-[600px] tw-mt-32">
      <div
        id="banner"
        hidden
        class="tw-mb-6 tw-p-8 tw-rounded-lg tw-bg-background-alt2 tw-text-center"
      >
        Banner above the anchor
      </div>
      ${card("shift-anchor", "bwi-star", "Anchor", "Moves when the banner toggles")}
      <bit-popover
        anchor="shift-anchor"
        open
        spotlight
        position="below-center"
        heading="Layout shift"
      >
        <div>The spotlight and popover follow the anchor when it moves without resizing.</div>
        <div class="tw-flex tw-gap-2 tw-mt-4">
          <bit-button
            button-type="primary"
            @click=${(e: Event) => {
              const banner = (e.target as HTMLElement).getRootNode() as Document;
              const el = banner.getElementById("banner")!;
              el.hidden = !el.hidden;
            }}
            >Toggle banner</bit-button
          >
        </div>
      </bit-popover>
    </div>`,
};

/** `openPopover(popover, anchor, options)` replaces `PopoverService.open`. */
export const OpenFromCode: Story = {
  play: undefined,
  render: () => {
    let ref: PopoverRef | undefined;
    const root = (e: Event) => (e.target as HTMLElement).closest("[data-root]")!;
    return html`<div data-root class="tw-h-[400px] tw-mt-32 tw-flex tw-gap-2">
      <bit-button
        button-type="primary"
        @click=${(e: Event) => {
          ref?.close();
          const r = root(e);
          ref = openPopover(
            r.querySelector("bit-popover")!,
            r.querySelector<HTMLElement>(".target"),
            {
              position: "below-center",
              spotlight: true,
            },
          );
        }}
        >Open</bit-button
      >
      <div
        class="target tw-w-fit tw-p-6 tw-border tw-border-solid tw-border-secondary-300 tw-rounded-lg tw-bg-background"
      >
        Anchor
      </div>
      <bit-popover heading="Opened from code">
        <div>Opened with <code>openPopover</code>.</div>
        <div class="tw-mt-4">
          <bit-button button-type="secondary" @click=${() => ref?.close()}>Close</bit-button>
        </div>
      </bit-popover>
    </div>`;
  },
};

/** The `popoverTrigger()` Lit directive, for triggers in Lit templates. */
export const LitDirective: Story = {
  render: () => {
    const popover = document.createElement("bit-popover");
    popover.heading = "Directive";
    popover.textContent = "Attached with popoverTrigger(popover).";
    return html`<div class="tw-mt-44 tw-h-[400px]">
      <bit-icon-button
        data-trigger
        ${popoverTrigger(popover)}
        icon="bwi-question-circle"
        label="Open popover"
        tooltip=""
      ></bit-icon-button>
      ${popover}
    </div>`;
  },
};

/** `attachPopoverAnchor(anchor, popover, { open })` drives a popover from any framework. */
export const AttachFunction: Story = {
  play: undefined,
  render: () =>
    html`<div class="tw-mt-32 tw-h-[400px]">
      <div
        class="tw-w-fit tw-p-6 tw-border tw-border-solid tw-border-secondary-300 tw-rounded-lg"
        ${refCallback((anchor) => {
          const popover = anchor.nextElementSibling as BitPopover;
          const handle = attachPopoverAnchor(anchor, popover, { position: "below-center" });
          anchor.addEventListener("click", () => handle.toggle());
        })}
      >
        Click to toggle
      </div>
      <bit-popover heading="Attached">Opened with a handle from attachPopoverAnchor.</bit-popover>
    </div>`,
};

/** Runs `callback` with the element once it's connected. */
function refCallback(callback: (el: HTMLElement) => void) {
  return ref((el) => {
    if (el instanceof HTMLElement) {
      queueMicrotask(() => callback(el));
    }
  });
}
