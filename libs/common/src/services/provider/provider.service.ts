import { InternalProviderService as InternalProviderServiceAbstraction } from "../../abstractions/provider/provider.service.abstraction";
import { StateService } from "../../abstractions/state.service";
import { ProviderData } from "../../models/data/providerData";
import { Provider } from "../../models/domain/provider";

export class ProviderService implements InternalProviderServiceAbstraction {
  constructor(private stateService: StateService) {}

  async get(id: string): Promise<Provider> {
    const providers = await this.stateService.getProviders();
    // eslint-disable-next-line
    if (providers == null || !providers.hasOwnProperty(id)) {
      return null;
    }

    return new Provider(providers[id]);
  }

  async getAll(): Promise<Provider[]> {
    const providers = await this.stateService.getProviders();
    const response: Provider[] = [];
    for (const id in providers) {
      // eslint-disable-next-line
      if (providers.hasOwnProperty(id)) {
        response.push(new Provider(providers[id]));
      }
    }
    return response;
  }

  async save(providers: { [id: string]: ProviderData }) {
    await this.stateService.setProviders(providers);
  }
}
