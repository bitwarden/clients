import { webServerBaseUrl } from "@playwright-config";

// First seed points at the seeder API proxy, second is the query path of the QueryController
const queryApiUrl = new URL("/seed/query", webServerBaseUrl).toString();

export abstract class Query<TUp, TReturns> {
  abstract template: string;

  constructor(private upArgs: TUp) {}
  async fetch(): Promise<TReturns> {
    const result = await queryFetch<TUp, TReturns>(this.template, this.upArgs);
    return result;
  }
}

async function queryFetch<TUp, TReturns>(template: string, args: TUp): Promise<TReturns> {
  const response = await fetch(queryApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template: template,
      arguments: args,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to run query: ${response.statusText}`);
  }

  return (await response.json()) as TReturns;
}
