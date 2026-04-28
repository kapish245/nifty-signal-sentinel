module.exports = {
  testEnvironment: "node",
  collectCoverageFrom: ["src/**/*.js"],
  testMatch: ["**/tests/**/*.test.js"],
  coveragePathIgnorePatterns: ["/node_modules/"],
};
