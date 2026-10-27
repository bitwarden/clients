import { ApiService } from "../../../../abstractions/api.service";

export class VaultHealthReportApiService {
  constructor(private apiService: ApiService) {}

  async restoreExcludedCipher(cipherId: string): Promise<void> {
    const response = await this.apiService.send(
      "PUT",
      `/ciphers/${cipherId}/unexclude`,
      null,
      true,
      true,
    );

    return response;
  }
}
