import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: "replace",
  standalone: true,
})
export class ReplacePipe implements PipeTransform {
  transform(value: string, pattern: string, replacement: string): string {
    return value.replace(pattern, replacement);
  }
}
