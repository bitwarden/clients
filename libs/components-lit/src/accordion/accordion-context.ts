import { createContext } from "@lit/context";

import type { AccordionVariant } from "./accordion";

/** @internal */
export type AccordionGroupContext = {
  variant: AccordionVariant;
  notifyOpened(accordion: HTMLElement): void;
};

/** @internal */
export const accordionGroupContext = createContext<AccordionGroupContext>(
  Symbol("bit-accordion-group"),
);
