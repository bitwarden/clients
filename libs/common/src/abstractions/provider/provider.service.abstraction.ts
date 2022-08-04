import { ProviderData } from "../../models/data/providerData";
import { Provider } from "../../models/domain/provider";

export abstract class ProviderServiceAbstraction {
  get: (id: string) => Promise<Provider>;
  getAll: () => Promise<Provider[]>;
}

export abstract class InternalProviderService extends ProviderServiceAbstraction {
  save: (providers: { [id: string]: ProviderData }) => Promise<any>;
}
