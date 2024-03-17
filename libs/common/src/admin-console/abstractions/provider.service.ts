import { UserId } from "../../types/guid";
import { ProviderData } from "../models/data/provider.data";
import { Provider } from "../models/domain/provider";

export abstract class ProviderService {
  get: (id: string) => Promise<Provider>;
  getAll: () => Promise<Provider[]>;
  save: (providers: { [id: string]: ProviderData }, userId?: UserId) => Promise<any>;
}
