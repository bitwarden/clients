import { Observable } from "rxjs";

import { UserId } from "../../types/guid";
import { ProviderData } from "../models/data/provider.data";
import { Provider } from "../models/domain/provider";

export abstract class ProviderService {
  abstract get$(id: string): Observable<Provider>;
  abstract get(id: string): Promise<Provider>;
  abstract getAll(): Promise<Provider[]>;
  abstract save(providers: { [id: string]: ProviderData }, userId?: UserId): Promise<any>;
}
