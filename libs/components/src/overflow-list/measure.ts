export function measureWidth(el: HTMLElement): number {
  return Math.ceil(el.getBoundingClientRect().width);
}

/**
 * Temporarily unhide an element so its natural width can be read. Returns a
 * function that restores the prior `hidden` and inline `display` state.
 */
export function revealForMeasurement(el: HTMLElement): () => void {
  const prevHidden = el.hidden;
  const prevDisplay = el.style.display;
  el.hidden = false;
  el.style.display = "";
  return () => {
    el.hidden = prevHidden;
    el.style.display = prevDisplay;
  };
}
