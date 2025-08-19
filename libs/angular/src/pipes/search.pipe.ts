// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Pipe, PipeTransform } from "@angular/core";

type PropertyValueFunction<T> = (item: T) => { toString: () => string };

@Pipe({
  name: "search",
  standalone: false,
})
export class SearchPipe implements PipeTransform {
  transform<T>(
    items: T[],
    searchText: string,
    prop1?: keyof T,
    prop2?: keyof T,
    prop3?: keyof T,
  ): T[];
  transform<T>(
    items: T[],
    searchText: string,
    prop1?: PropertyValueFunction<T>,
    prop2?: PropertyValueFunction<T>,
    prop3?: PropertyValueFunction<T>,
  ): T[];
  transform<T>(
    items: T[],
    searchText: string,
    prop1?: keyof T | PropertyValueFunction<T>,
    prop2?: keyof T | PropertyValueFunction<T>,
    prop3?: keyof T | PropertyValueFunction<T>,
  ): T[] {
    if (items == null || items.length === 0) {
      return [];
    }

    if (searchText == null || searchText.length < 2) {
      return items;
    }

    searchText = searchText.trim().toLowerCase();
    return items.filter((i) => {
      if (prop1 != null) {
        const propValue = typeof prop1 === "function" ? prop1(i) : i[prop1];

        if (propValue?.toString().toLowerCase().indexOf(searchText) > -1) {
          return true;
        }
      }

      if (prop2 != null) {
        const propValue = typeof prop2 === "function" ? prop2(i) : i[prop2];

        if (propValue?.toString().toLowerCase().indexOf(searchText) > -1) {
          return true;
        }
      }

      if (prop3 != null) {
        const propValue = typeof prop3 === "function" ? prop3(i) : i[prop3];

        if (propValue?.toString().toLowerCase().indexOf(searchText) > -1) {
          return true;
        }
      }

      return false;
    });
  }
}
