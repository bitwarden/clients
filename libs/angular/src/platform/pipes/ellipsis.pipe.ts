import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: "ellipsis",
  standalone: false,
})
/**
 * @deprecated Use the tailwind class 'tw-truncate' instead
 */
export class EllipsisPipe implements PipeTransform {
  transform(value: string, limit = 25, completeWords = false, ellipsis = "...") {
    if (value.length <= limit) {
      return value;
    }
    limit -= ellipsis.length;
    if (completeWords && value.length > limit && value.indexOf(" ") > 0) {
      limit = value.substring(0, limit).lastIndexOf(" ");
    }
    return value.substring(0, limit) + ellipsis;
  }
}
