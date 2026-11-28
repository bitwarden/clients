import { getOverlayRoot } from "./overlay";

let region: HTMLElement | undefined;

/** Announces a message to screen readers via a shared visually hidden live region. */
export function announce(message: string, politeness: "polite" | "assertive" = "polite") {
  // Outside the topmost modal everything is inert, so the region has to move inside it.
  const root = getOverlayRoot();
  if (!region) {
    region = document.createElement("div");
    region.setAttribute("aria-atomic", "true");
    Object.assign(region.style, {
      position: "absolute",
      width: "1px",
      height: "1px",
      overflow: "hidden",
      clip: "rect(0 0 0 0)",
      whiteSpace: "nowrap",
    });
  }
  if (region.parentElement !== root) {
    root.append(region);
  }
  region.setAttribute("aria-live", politeness);
  region.textContent = "";
  // Clearing then setting on the next frame makes repeated identical messages re-announce.
  requestAnimationFrame(() => {
    if (region) {
      region.textContent = message;
    }
  });
}
