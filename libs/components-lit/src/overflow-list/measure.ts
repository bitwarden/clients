export function measureWidth(el: HTMLElement): number {
  return Math.ceil(el.getBoundingClientRect().width);
}

/**
 * Temporarily unhide an element so its natural width can be read. Returns a function that
 * restores the prior `hidden` and inline `display` state.
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

/**
 * Hide an element by both setting the `hidden` attribute and an inline `display: none`. The
 * attribute alone isn't enough: consumers commonly apply `display: flex`/`inline-flex` via
 * classes, which win on specificity over the user-agent `[hidden] { display: none }` rule.
 */
export function applyHide(el: HTMLElement, hide: boolean): void {
  el.hidden = hide;
  el.style.display = hide ? "none" : "";
}

/** Content-box inline size of `el`, read from computed style so it matches `ResizeObserver`. */
export function contentWidth(el: HTMLElement): number {
  const style = getComputedStyle(el);
  return el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) || 0;
}

/**
 * Tracks an element's content-box width. Calls `onWidth` with an initial reading, then on every
 * resize. Returns a function that stops observing.
 */
export function observeWidth(el: HTMLElement, onWidth: (width: number) => void): () => void {
  const observer = new ResizeObserver(([entry]) => {
    // `contentBoxSize` is the spec'd read; `contentRect` is the older, always-present equivalent,
    // and covers engines that hand back an empty box array.
    onWidth(entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width);
  });
  onWidth(contentWidth(el));
  observer.observe(el);
  return () => observer.disconnect();
}
