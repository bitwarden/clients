// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { UserId } from "../../types/guid";
import { ProviderData } from "../models/data/provider.data";
import { Provider } from "../models/domain/provider";

export abstract class ProviderService {
  get$: (id: string) => Observable<Provider>;
  get: (id: string) => Promise<Provider>;
  getAll: () => Promise<Provider[]>;
  save: (providers: { [id: string]: ProviderData }, userId?: UserId) => Promise<any>;
}
