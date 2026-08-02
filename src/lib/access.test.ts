import { afterEach, describe, expect, it } from "vitest";
import { localAccessAllowed, sessionValue, tokensEqual, validateLoginToken } from "./access";

const originalNodeEnv = process.env.NODE_ENV;
const originalToken = process.env.VIBECOLLAB_ADMIN_TOKEN;

afterEach(() => {
  Object.assign(process.env, { NODE_ENV: originalNodeEnv });
  if (originalToken === undefined) delete process.env.VIBECOLLAB_ADMIN_TOKEN;
  else process.env.VIBECOLLAB_ADMIN_TOKEN = originalToken;
});

describe("VibeCollab access policy", () => {
  it("allows tokenless access only during local development", () => {
    delete process.env.VIBECOLLAB_ADMIN_TOKEN;
    Object.assign(process.env, { NODE_ENV: "development" });
    expect(localAccessAllowed()).toBe(true);

    Object.assign(process.env, { NODE_ENV: "production" });
    expect(localAccessAllowed()).toBe(false);
    expect(sessionValue()).toBeNull();
  });

  it("validates configured tokens without comparing plaintext values directly", () => {
    process.env.VIBECOLLAB_ADMIN_TOKEN = "team-secret";
    expect(validateLoginToken("team-secret")).toBe(true);
    expect(validateLoginToken("other-secret")).toBe(false);
    expect(tokensEqual("same", "same")).toBe(true);
    expect(tokensEqual("same", "different")).toBe(false);
  });
});
