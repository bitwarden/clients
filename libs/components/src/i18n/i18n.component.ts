import {
  AfterContentInit,
  Component,
  ContentChildren,
  Input,
  QueryList,
  TemplateRef,
} from "@angular/core";

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
    <ng-container *ngFor="let part of translationParts">
      <ng-container *ngIf="part.templateRef != undefined; else text">
        <ng-container
          *ngTemplateOutlet="part.templateRef; context: { $implicit: part.text }"
        ></ng-container>
      </ng-container>
      <ng-template #text>{{ part.text }}</ng-template>
    </ng-container>
  `,
  standalone: true,
})
export class I18nComponent implements AfterContentInit {
  @Input("bit-i18n")
  translationKey: string;

  /**
   * Optional arguments to pass to the translation function.
   */
  @Input()
  args: (string | number)[] = [];

  @ContentChildren(I18nPartDirective)
  templateTags: QueryList<I18nPartDirective>;

  protected translationParts: I18nStringPart[] = [];

  constructor(
    private i18nService: I18nService,
    private logService: LogService,
  ) {}

  ngAfterContentInit() {
    const translatedText = this.i18nService.t(
      this.translationKey,
      this.args[0],
      this.args[1],
      this.args[2],
    );
    const [translationParts, tagCount] = this.parseTranslatedString(translatedText);
    this.translationParts = translationParts;

    if (tagCount !== this.templateTags.length) {
      this.logService.warning(
        `The translation for "${this.translationKey}" has ${tagCount} template tag(s), but ${this.templateTags.length} bit-i18n-part directive(s) were found.`,
      );
    }

    // Assign any templateRefs to the translation parts
    this.templateTags.forEach((tag, index) => {
      this.translationParts.forEach((part) => {
        if (part.tagId === index) {
          part.templateRef = tag.templateRef;
        }
      });
    });
  }

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
    let match: RegExpMatchArray;
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
