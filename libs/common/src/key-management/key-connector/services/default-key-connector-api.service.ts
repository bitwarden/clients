import { ApiService } from "../../../abstractions/api.service";
import { KeyConnectorApiService } from "../abstractions/key-connector-api.service";
import { KeyConnectorConfirmationDetailsResponse } from "../models/response/key-connector-confirmation-details.response";

export class DefaultKeyConnectorApiService implements KeyConnectorApiService {
  constructor(private apiService: ApiService) {}

  async getConfirmationDetails(
    orgSsoIdentifier: string,
  ): Promise<KeyConnectorConfirmationDetailsResponse> {
    const r = await this.apiService.send(
      "GET",
      "/accounts/key-connector/confirmation-details/" + encodeURIComponent(orgSsoIdentifier),
      null,
      true,
      true,
    );
    return new KeyConnectorConfirmationDetailsResponse(r);
  }
}
