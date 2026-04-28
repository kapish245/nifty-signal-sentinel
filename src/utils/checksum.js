const crypto = require("crypto");

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

function generateChecksum({ apiKey, requestToken, apiSecret }) {
  const normalizedApiKey = requireNonEmptyString(apiKey, "API key");
  const normalizedRequestToken = requireNonEmptyString(
    requestToken,
    "Request token",
  );
  const normalizedApiSecret = requireNonEmptyString(apiSecret, "API secret");

  return crypto
    .createHash("sha256")
    .update(
      `${normalizedApiKey}${normalizedRequestToken}${normalizedApiSecret}`,
      "utf8",
    )
    .digest("hex");
}

module.exports = {
  generateChecksum,
};
