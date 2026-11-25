// Existing installs and callback URLs still arrive at the old editor address.
if (window.location.pathname === "/") {
  const { search, hash } = window.location;
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.slice(1));
  const authKeys = [
    "access_token", "refresh_token", "provider_token", "code", "token_hash",
    "error", "error_code", "error_description", "type",
  ];
  const editorKeys = ["checkout", "session_id", "access", "from_extension", "internal"];
  const installed = window.matchMedia("(display-mode: standalone)").matches
    || navigator.standalone === true
    || navigator.userAgent.includes("ProductShotDesktop/");

  if (installed || editorKeys.some((key) => query.has(key))
    || authKeys.some((key) => query.has(key) || fragment.has(key))) {
    window.location.replace("/app" + search + hash);
  }
}
