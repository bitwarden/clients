/**
 * Implemented by components whose interactive element lives in their shadow root (e.g. `bit-button`).
 * Behaviors that need to set ARIA on "the button" (menu triggers, tooltips) target this element.
 */
export interface AriaTargetHost {
  readonly ariaTarget: HTMLElement | null;
}

function isAriaTargetHost(el: Element): el is HTMLElement & AriaTargetHost {
  return "ariaTarget" in el;
}

/**
 * Resolves the element that should carry ARIA state for `el`, waiting for Lit's first render
 * when needed.
 */
export async function resolveAriaTarget(el: HTMLElement): Promise<HTMLElement> {
  if (!isAriaTargetHost(el)) {
    return el;
  }
  await (el as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
  return el.ariaTarget ?? el;
}

/** Sets or removes (`null`/`undefined`) attributes on `el`'s ARIA target. */
export async function setAriaAttributes(
  el: HTMLElement,
  attrs: Record<string, string | null | undefined>,
) {
  const target = await resolveAriaTarget(el);
  for (const [name, value] of Object.entries(attrs)) {
    if (value == null) {
      target.removeAttribute(name);
    } else {
      target.setAttribute(name, value);
    }
  }
}
