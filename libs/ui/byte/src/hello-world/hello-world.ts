import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bit-hello")
export class BitHelloElement extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      font-family: var(--font-sans, system-ui, sans-serif);
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      background: var(--color-primary-100, #eef);
      color: var(--color-text-main, #222);
    }
  `;

  @property() name = "world";

  render() {
    return html`<p>Hello, ${this.name}!</p>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-hello": BitHelloElement;
  }
}
