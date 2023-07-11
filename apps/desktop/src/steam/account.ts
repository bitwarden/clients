export class TrayAccountView {
    username: string;
    url: string;
    password: string;
  
    constructor(username: string, password: string) {
      this.username = username;
      this.password = password;
    }
  }