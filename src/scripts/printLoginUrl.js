require("dotenv").config();

const { generateLoginUrl } = require("../auth/login");

try {
  console.log(generateLoginUrl(process.env.ZERODHA_API_KEY));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
