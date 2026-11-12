import { html, LitElement } from "lit";

import "../../button/button";
import "../../popover/popover";
import type { PopoverPosition } from "../../popover/popover-position";

export type KitchenSinkRoute = "bitwarden" | "empty" | "virtual-scroll";

export type TourStep = 0 | 1 | 2 | 3 | 4;

/** The guided tour's current step (0 = not running). Replaces Angular's `KitchenSinkTourService`. */
class KitchenSinkTour {
  private readonly listeners = new Set<() => void>();
  private current: TourStep = 0;

  get step(): TourStep {
    return this.current;
  }

  start() {
    this.set(1);
  }

  next() {
    const step = this.current;
    this.set(step > 0 && step < 4 ? ((step + 1) as TourStep) : 0);
  }

  end() {
    this.set(0);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(step: TourStep) {
    if (step !== this.current) {
      this.current = step;
      this.listeners.forEach((listener) => listener());
    }
  }
}

export const kitchenSinkTour = new KitchenSinkTour();

let instances = 0;

/**
 * Base for the kitchen sink's page-level composites. They render into light DOM, like Angular
 * component templates, so declarative `trigger`/`anchor` ids resolve against the document and the
 * page's Tailwind classes apply.
 *
 * @internal Stories only.
 */
export abstract class KitchenSinkElement extends LitElement {
  /** Prefix for ids, unique per instance so several kitchen sinks can share a page. */
  protected readonly uid = `ks${++instances}`;

  protected readonly tour = kitchenSinkTour;

  private unsubscribe?: () => void;

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.unsubscribe = kitchenSinkTour.subscribe(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
  }

  /** A spotlight popover for one step of the guided tour, anchored to the element with id `anchor`. */
  protected tourPopover(options: {
    step: TourStep;
    anchor: string;
    heading: string;
    position: PopoverPosition;
    body: unknown;
    last?: boolean;
  }) {
    const { step, anchor, heading, position, body, last = false } = options;
    const onOpenChange = (event: CustomEvent<{ open: boolean }>) => {
      // Dismissing the spotlight (Escape, outside click) ends the tour too.
      if (!event.detail.open && this.tour.step === step) {
        this.tour.end();
      }
    };
    return html`<bit-popover
      anchor=${anchor}
      position=${position}
      spotlight
      heading=${heading}
      ?open=${this.tour.step === step}
      @closed=${() => this.tour.end()}
      @openChange=${onOpenChange}
    >
      ${body}
      <div class="tw-flex tw-gap-2 tw-mt-4">
        <bit-button
          button-type="primary"
          @click=${() => (last ? this.tour.end() : this.tour.next())}
          >${last ? "Finish Tour" : "Next"}</bit-button
        >
        <bit-button button-type="secondary" @click=${() => this.tour.end()}>Skip Tour</bit-button>
      </div>
    </bit-popover>`;
  }
}
