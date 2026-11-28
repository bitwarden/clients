import { ReactiveController, ReactiveControllerHost } from "lit";

type Host = ReactiveControllerHost & HTMLElement;

/**
 * Tracks which named slots have light DOM content, so wrappers around optional slots (prefix,
 * hint) can be hidden when empty. `"[default]"` refers to the unnamed slot.
 */
export class SlotController implements ReactiveController {
  constructor(private readonly host: Host) {
    host.addController(this);
  }

  hostConnected() {
    this.host.shadowRoot?.addEventListener("slotchange", this.onSlotChange);
  }

  hostUpdated() {
    // The shadow root exists after the first update; `addEventListener` dedupes repeat calls.
    this.host.shadowRoot?.addEventListener("slotchange", this.onSlotChange);
  }

  hostDisconnected() {
    this.host.shadowRoot?.removeEventListener("slotchange", this.onSlotChange);
  }

  has(name: string): boolean {
    return Array.from(this.host.childNodes).some((node) => {
      if (name === "[default]") {
        return node.nodeType === Node.TEXT_NODE
          ? !!node.textContent?.trim()
          : node instanceof Element && !node.hasAttribute("slot");
      }
      return node instanceof Element && node.getAttribute("slot") === name;
    });
  }

  /** Elements assigned to `name`. */
  elements(name: string): Element[] {
    return Array.from(this.host.children).filter((el) => el.getAttribute("slot") === name);
  }

  private onSlotChange = () => this.host.requestUpdate();
}
