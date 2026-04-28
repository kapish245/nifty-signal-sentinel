const KITE_LOGIN_URL = "https://kite.zerodha.com/connect/login";

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

function generateLoginUrl(apiKey) {
  const normalizedApiKey = requireNonEmptyString(apiKey, "API key");
  const query = new URLSearchParams({
    v: "3",
    api_key: normalizedApiKey,
  });

  return `${KITE_LOGIN_URL}?${query.toString()}`;
}

function getTokenFromValue(value) {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return getTokenFromValue(value[0]);
  }

  return null;
}

function extractRequestToken(callbackInput) {
  if (typeof callbackInput === "string") {
    let callbackUrl;

    try {
      callbackUrl = new URL(callbackInput);
    } catch (error) {
      throw new Error("Callback URL is invalid");
    }

    const requestToken = callbackUrl.searchParams.get("request_token");

    if (!requestToken) {
      throw new Error("Missing request_token in callback");
    }

    return requestToken;
  }

  if (callbackInput && typeof callbackInput === "object") {
    const requestToken = getTokenFromValue(callbackInput.request_token);

    if (!requestToken) {
      throw new Error("Missing request_token in callback");
    }

    return requestToken;
  }

  throw new Error("Callback payload is required");
}

module.exports = {
  generateLoginUrl,
  extractRequestToken,
  KITE_LOGIN_URL,
};
