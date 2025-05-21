// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Pipe, PipeTransform } from "@angular/core";

export interface User {
  name?: string;
  email?: string;
}

@Pipe({
  name: "userName",
  standalone: false,
})
export class UserNamePipe implements PipeTransform {
  transform(user?: User): string {
    if (user == null) {
      return null;
    }

    if (user.name == null && user.email == null) {
      return null;
    }

    return user.name == null || user.name.trim() === "" ? user.email : user.name;
  }
}
