import { Observable } from "rxjs";

import { UserId } from "../../types/guid";
import { ProviderData } from "../models/data/provider.data";
import { Provider } from "../models/domain/provider";

export abstract class ProviderService {
  abstract get$(id: string, userId: UserId): Observable<Provider | undefined>;
  abstract get(id: string, userId: UserId): Promise<Provider | undefined>;
  abstract getAll(userId: UserId): Promise<Provider[]>;
  abstract save(providers: { [id: string]: ProviderData }, userId: UserId): Promise<any>;
}
