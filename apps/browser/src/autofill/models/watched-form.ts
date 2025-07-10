import { FormData } from "../services/abstractions/autofill.service";
export interface WatchedForm {
  data: FormData;
  formEl: HTMLFormElement;
  usernameEl: HTMLInputElement | null;
  passwordEl: HTMLInputElement | null;
  passwordEls: HTMLInputElement[] | null;
}
