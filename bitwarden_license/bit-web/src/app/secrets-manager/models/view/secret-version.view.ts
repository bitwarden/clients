export class SecretVersionView {
  constructor(
    readonly id: string,
    readonly secretId: string,
    readonly value: string,
    readonly versionDate: string,
    readonly authorName?: string,
  ) {}
}
