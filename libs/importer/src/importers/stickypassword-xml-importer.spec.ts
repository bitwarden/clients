import { StickyPasswordXmlImporter } from "./stickypassword-xml-importer";

const xmlWithRemark = `<?xml version="1.0" encoding="utf-8"?>
<root>
  <Database>
    <Logins>
      <Login ID="1" Name="My remark" RealName="alice@example.com" Password="secret1" />
    </Logins>
    <Accounts>
      <Account Name="Example" Link="https://example.com" Comments="">
        <LoginLinks>
          <Login SourceLoginID="1" />
        </LoginLinks>
      </Account>
    </Accounts>
  </Database>
</root>`;

const xmlWithLowercaseRealname = `<?xml version="1.0" encoding="utf-8"?>
<root>
  <Database>
    <Logins>
      <Login ID="3" Name="Another remark" Realname="carol@example.com" Password="secret3" />
    </Logins>
    <Accounts>
      <Account Name="Third" Link="https://third.example" Comments="">
        <LoginLinks>
          <Login SourceLoginID="3" />
        </LoginLinks>
      </Account>
    </Accounts>
  </Database>
</root>`;

const xmlWithoutRemark = `<?xml version="1.0" encoding="utf-8"?>
<root>
  <Database>
    <Logins>
      <Login ID="2" Name="bob@example.com" Password="secret2" />
    </Logins>
    <Accounts>
      <Account Name="Other" Link="https://other.example" Comments="">
        <LoginLinks>
          <Login SourceLoginID="2" />
        </LoginLinks>
      </Account>
    </Accounts>
  </Database>
</root>`;

describe("Sticky Password XML Importer", () => {
  it("uses RealName as username and Name as remark when a remark is present", async () => {
    const importer = new StickyPasswordXmlImporter();
    const result = await importer.parse(xmlWithRemark);
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    expect(result.ciphers[0].login.username).toBe("alice@example.com");
    expect(result.ciphers[0].login.password).toBe("secret1");
  });

  it("accepts the Realname attribute casing", async () => {
    const importer = new StickyPasswordXmlImporter();
    const result = await importer.parse(xmlWithLowercaseRealname);
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    expect(result.ciphers[0].login.username).toBe("carol@example.com");
    expect(result.ciphers[0].login.password).toBe("secret3");
  });

  it("falls back to Name as username when RealName is absent", async () => {
    const importer = new StickyPasswordXmlImporter();
    const result = await importer.parse(xmlWithoutRemark);
    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    expect(result.ciphers[0].login.username).toBe("bob@example.com");
    expect(result.ciphers[0].login.password).toBe("secret2");
  });
});
