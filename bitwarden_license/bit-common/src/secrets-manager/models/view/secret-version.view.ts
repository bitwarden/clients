export type SecretVersionViewInit = {
  id: string;
  secretId: string;
  value: string;
  versionDate: string;
  authorName?: string;
};

export class SecretVersionView {
  readonly id: string;
  readonly secretId: string;
  readonly value: string;
  readonly versionDate: string;
  readonly authorName?: string;

  constructor(init: SecretVersionViewInit) {
    this.id = init.id;
    this.secretId = init.secretId;
    this.value = init.value;
    this.versionDate = init.versionDate;
    this.authorName = init.authorName;
  }
}
