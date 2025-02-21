// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgClass } from "@angular/common";
import { Component, Input, OnChanges } from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";

import { Utils } from "@bitwarden/common/platform/misc/utils";

type SizeTypes = "xlarge" | "large" | "default" | "small" | "xsmall";

const SizeClasses: Record<SizeTypes, string[]> = {
  xlarge: ["tw-h-24", "tw-w-24"],
  large: ["tw-h-16", "tw-w-16"],
  default: ["tw-h-10", "tw-w-10"],
  small: ["tw-h-7", "tw-w-7"],
  xsmall: ["tw-h-6", "tw-w-6"],
};

@Component({
  selector: "bit-avatar",
  template: `@if (src) {
    <img [src]="src" title="{{ title || text }}" [ngClass]="classList" />
  }`,
  standalone: true,
  imports: [NgClass],
})
export class AvatarComponent implements OnChanges {
  @Input() border = false;
  @Input() color?: string;
  @Input() id?: string;
  @Input() text?: string;
  @Input() title: string;
  @Input() size: SizeTypes = "default";

  private svgCharCount = 2;
  private svgFontSize = 20;
  private svgFontWeight = 300;
  private svgSize = 48;
  src: SafeResourceUrl;

  constructor(public sanitizer: DomSanitizer) {}

  ngOnChanges() {
    this.generate();
  }

  get classList() {
    return ["tw-rounded-full"]
      .concat(SizeClasses[this.size] ?? [])
      .concat(this.border ? ["tw-border", "tw-border-solid", "tw-border-secondary-600"] : []);
  }

  private generate() {
    let chars: string = null;
    const upperCaseText = this.text?.toUpperCase() ?? "";

    chars = this.getFirstLetters(upperCaseText, this.svgCharCount);

    if (chars == null) {
      chars = this.unicodeSafeSubstring(upperCaseText, this.svgCharCount);
    }

    // If the chars contain an emoji, only show it.
    if (chars.match(Utils.regexpEmojiPresentation)) {
      chars = chars.match(Utils.regexpEmojiPresentation)[0];
    }

    let svg: HTMLElement;
    let hexColor = this.color;

    if (!Utils.isNullOrWhitespace(this.color)) {
      svg = this.createSvgElement(this.svgSize, hexColor);
    } else if (!Utils.isNullOrWhitespace(this.id)) {
      hexColor = Utils.stringToColor(this.id.toString());
      svg = this.createSvgElement(this.svgSize, hexColor);
    } else {
      hexColor = Utils.stringToColor(upperCaseText);
      svg = this.createSvgElement(this.svgSize, hexColor);
    }

    const charObj = this.createTextElement(chars, hexColor);
    svg.appendChild(charObj);
    const html = window.document.createElement("div").appendChild(svg).outerHTML;
    const svgHtml = window.btoa(unescape(encodeURIComponent(html)));

    // This is safe because the only user provided value, chars is set using `textContent`
    this.src = this.sanitizer.bypassSecurityTrustResourceUrl(
      "data:image/svg+xml;base64," + svgHtml,
    );
  }

  private getFirstLetters(data: string, count: number): string {
    const parts = data.split(" ");
    if (parts.length > 1) {
      let text = "";
      for (let i = 0; i < count; i++) {
        text += this.unicodeSafeSubstring(parts[i], 1);
      }
      return text;
    }
    return null;
  }

  private createSvgElement(size: number, color: string): HTMLElement {
    const svgTag = window.document.createElement("svg");
    svgTag.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svgTag.setAttribute("pointer-events", "none");
    svgTag.setAttribute("width", size.toString());
    svgTag.setAttribute("height", size.toString());
    svgTag.style.backgroundColor = color;
    svgTag.style.width = size + "px";
    svgTag.style.height = size + "px";
    return svgTag;
  }

  private createTextElement(character: string, color: string): HTMLElement {
    const textTag = window.document.createElement("text");
    textTag.setAttribute("text-anchor", "middle");
    textTag.setAttribute("y", "50%");
    textTag.setAttribute("x", "50%");
    textTag.setAttribute("dy", "0.35em");
    textTag.setAttribute("pointer-events", "auto");
    textTag.setAttribute("fill", Utils.pickTextColorBasedOnBgColor(color, 135, true));
    textTag.setAttribute(
      "font-family",
      '"DM Sans","Helvetica Neue",Helvetica,Arial,' +
        'sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"',
    );
    // Warning do not use innerHTML here, characters are user provided
    textTag.textContent = character;
    textTag.style.fontWeight = this.svgFontWeight.toString();
    textTag.style.fontSize = this.svgFontSize + "px";
    return textTag;
  }

  private unicodeSafeSubstring(str: string, count: number) {
    const characters = str.match(/./gu);
    return characters != null ? characters.slice(0, count).join("") : "";
  }
}
