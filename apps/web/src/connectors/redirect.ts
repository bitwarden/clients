// This redirect connector is used to redirect users to the correct URL after they have been sent here from an email link.
// The fragment contains the information needed to redirect the user to the correct page.
// This is required because android app links couldn't properly handle the angular hash based route we originally had in the email link.
window.addEventListener("load", () => {
  // ex: https://vault.bitwarden.com/redirect-connector.html#finish-signup?token=fakeToken&email=example%40example.com&fromEmail=true
  const currentUrl = new URL(window.location.href);

  // Get the fragment (everything after the #)
  const fragment = currentUrl.hash.substring(1); // Remove the leading #

  if (!fragment) {
    throw new Error("No fragment found in URL. Cannot determine redirect.");
  }

  const newUrl = `${window.location.origin}/#/${fragment}`;
  window.location.href = newUrl;
});
