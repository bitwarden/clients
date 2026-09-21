import { ApiService } from "../../abstractions/api.service";
import { BreachAccountResponse } from "../models";

export class HibpApiService {
  constructor(private apiService: ApiService) {}

  async getHibpBreach(username: string): Promise<BreachAccountResponse[]> {
    const encodedUsername = encodeURIComponent(username);
    const r = await this.apiService.send(
      "GET",
      "/hibp/breach?username=" + encodedUsername,
      null,
      true,
      true,
    );
    return r.map((a: any) => new BreachAccountResponse(a));
  }

  async getHibpRange(hashPrefix: string): Promise<string> {
    const r = await this.apiService.send("GET", `/hibp/range/${hashPrefix}`, null, true, true);
    return r;
  }
}
