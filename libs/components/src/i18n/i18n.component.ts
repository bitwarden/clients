import { Component, TemplateRef, input, computed, contentChildren } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { SharedModule } from "../shared";

import { I18nPartDirective } from "./i18n-part.directive";

interface I18nStringPart {
  text: string;
  tagId?: number;
  templateRef?: TemplateRef<any>;
}

/**
 * Component that renders a translated string with optional templateRefs for each tag identifier in the translated string.
 *
 * The translated string must be in the following format:
 *
 * `"This will be a <0>translated link</0> and this will be another <1>translated link</1>."`
 *
 * The tag identifiers must be numbers surrounded by angle brackets and will be used to match the corresponding
 * bit-i18n-part. If there are not enough bit-i18n-part directives, the text will be rendered as-is for the remaining
 * tags.
 *
 * ## Caution
 * Care should be taken if this directive is included in large tables/lists. It can cause performance issues
 * when there are many 1000s being rendered at once without optimizations like *cdkVirtualFor. In such cases, it is
 * recommended to use the i18n pipe instead and avoid including templates within the translated content.
 *
 * @example
 * <div bit-i18n="exampleI18nKey">
 *  <a *bit-i18n-part="let text" routerLink="./first-link">{{ text }}</a>
 *  <a *bit-i18n-part="let text" routerLink="./bold-link">
 *    <strong>{{ text }}</strong>
 *  </a>
 * </div>
 */
@Component({
  selector: "[bit-i18n]",
  imports: [SharedModule],
  template: `
    <ng-container *ngFor="let part of translationParts()">
      <ng-container *ngIf="part.templateRef != undefined; else text">
        <ng-container
          *ngTemplateOutlet="part.templateRef; context: { $implicit: part.text }"
        ></ng-container>
      </ng-container>
      <ng-template #text>{{ part.text }}</ng-template>
    </ng-container>
  `,
})
export class I18nComponent {
  translationKey = input.required<string>({ alias: "bit-i18n" });

  /**
   * Optional arguments to pass to the translation function.
   */
  args = input<(string | number)[]>([]);

  /**
   * Escapes any <0></0> like tags that may be present in the arguments to
   * prevent breaking the template rendering.
   */
  escapeArgs(args: (string | number)[]): (string | number)[] {
    return args.map((arg) => {
      if (typeof arg === "string") {
        return arg.replace(/<\/?\d+>/g, (tag) => tag.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
      }
      return arg.toString();
    });
  }

  private tagTemplates = contentChildren(I18nPartDirective, { read: TemplateRef });

  private translatedText = computed(() => {
    const translatedText = this.i18nService.t(
      this.translationKey(),
      ...this.escapeArgs(this.args()),
    );
    return this.parseTranslatedString(translatedText);
  });

  protected translationParts = computed<I18nStringPart[]>(() => {
    const [translationParts, tagCount] = this.translatedText();
    const tagTemplates = this.tagTemplates();
    const tagTemplateCount = tagTemplates.length;

    if (tagCount !== tagTemplateCount) {
      this.logService.warning(
        `The translation for "${this.translationKey()}" has ${tagCount} template tag(s), but ${tagTemplateCount} bit-i18n-part directive(s) were found.`,
      );
    }

    translationParts
      .filter((part) => part.tagId !== undefined)
      .forEach((part) => {
        part.templateRef = tagTemplates[part.tagId!];
      });

    return translationParts;
  });

  constructor(
    private i18nService: I18nService,
    private logService: LogService,
  ) {}

  /**
   * Parses a translated string into an array of parts separated by tag identifiers.
   * Tag identifiers must be numbers surrounded by angle brackets.
   * Includes the number of tags found in the string.
   * @example
   * parseTranslatedString("Hello <0>World</0>!")
   * // returns [[{ text: "Hello " }, { text: "World", tagId: 0 }, { text: "!" }], 1]
   * @param inputString
   * @private
   */
  private parseTranslatedString(inputString: string): [I18nStringPart[], number] {
    const regex = /<(\d+)>(.*?)<\/\1>|([^<]+)/g;
    const parts: I18nStringPart[] = [];
    let match: RegExpMatchArray | null;
    let tagCount = 0;

    while ((match = regex.exec(inputString)) !== null) {
      if (match[1]) {
        parts.push({ text: match[2], tagId: parseInt(match[1]) });
        tagCount++;
      } else {
        parts.push({ text: match[3] });
      }
    }

    return [parts, tagCount];
  }
}
