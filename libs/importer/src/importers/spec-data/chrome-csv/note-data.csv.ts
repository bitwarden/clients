// Mirrors a current Chrome password export: `note` column, CRLF line endings,
// and a quoted multi-line note containing a comma and escaped quotes.
export const data =
  "name,url,username,password,note\r\n" +
  'www.example.com,https://www.example.com/,username@example.com,fake-password,"First line, with a comma\r\nSecond line with ""quotes"""\r\n';
