// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnChanges, OnInit } from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";

import { Utils } from "@bitwarden/common/platform/misc/utils";

@Component({
  selector: "app-avatar",
  template: `<img *ngIf="src" [src]="src" [ngClass]="{ 'rounded-circle': circle }" />`,
  standalone: false,
})
export class AvatarComponent implements OnChanges, OnInit {
  @Input() size = 45;
  @Input() charCount = 2;
  @Input() fontSize = 20;
  @Input() dynamic = false;
  @Input() circle = false;

  @Input() color?: string;
  @Input() id?: string;
  @Input() text?: string;

  private svgCharCount = 2;
  private svgFontWeight = 300;
  src: SafeResourceUrl;

  constructor(public sanitizer: DomSanitizer) {}

  ngOnInit() {
    if (!this.dynamic) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.generate();
    }
  }

  ngOnChanges() {
    if (this.dynamic) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.generate();
    }
  }

  private async generate() {
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

    if (this.color != null) {
      svg = this.createSvgElement(this.size, hexColor);
    } else if (this.id != null) {
      hexColor = Utils.stringToColor(this.id.toString());
      svg = this.createSvgElement(this.size, hexColor);
    } else {
      hexColor = Utils.stringToColor(upperCaseText);
      svg = this.createSvgElement(this.size, hexColor);
    }

    const charObj = this.createTextElement(chars, hexColor);
    svg.appendChild(charObj);
    const html = window.document.createElement("div").appendChild(svg).outerHTML;
    const svgHtml = window.btoa(unescape(encodeURIComponent(html)));
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
      'Inter,"Helvetica Neue",Helvetica,Arial,' +
        'sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"',
    );
    textTag.textContent = character;
    textTag.style.fontWeight = this.svgFontWeight.toString();
    textTag.style.fontSize = this.fontSize + "px";
    return textTag;
  }

  private unicodeSafeSubstring(str: string, count: number) {
    const characters = str.match(/./gu);
    return characters != null ? characters.slice(0, count).join("") : "";
  }
}
