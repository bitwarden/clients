export class UpdateProfileRequest {
  name: string;
  culture = "en-US"; // deprecated

  constructor(name: string) {
    this.name = name;
  }
}
