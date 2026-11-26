import { describe, expect, it } from "vitest";
import { domainRedirect } from "./domains";

const env = { appUrl: "https://app.parcolia.ma", marketingUrl: "https://parcolia.ma" };
const go = (host: string, pathname: string, search = "") => domainRedirect({ host, pathname, search }, env);

describe("domainRedirect", () => {
  it("one domain (no marketing URL, or the same host): never redirects", () => {
    expect(domainRedirect({ host: "parcolia.ma", pathname: "/login", search: "" }, { appUrl: "https://parcolia.ma" })).toBeNull();
    expect(domainRedirect({ host: "parcolia.ma", pathname: "/login", search: "" }, { appUrl: "https://parcolia.ma", marketingUrl: "https://parcolia.ma" })).toBeNull();
  });
  it("marketing domain keeps the home page and the privacy page, in every language", () => {
    expect(go("parcolia.ma", "/")).toBeNull();
    expect(go("parcolia.ma", "/ar")).toBeNull();
    expect(go("parcolia.ma", "/en/privacy")).toBeNull();
  });
  it("app pages opened on the marketing domain go to the app", () => {
    expect(go("parcolia.ma", "/login")).toBe("https://app.parcolia.ma/login");
    expect(go("parcolia.ma", "/ar/signup", "?plan=pro")).toBe("https://app.parcolia.ma/ar/signup?plan=pro");
  });
  it("www goes to the main marketing domain", () => {
    expect(go("www.parcolia.ma", "/en", "?x=1")).toBe("https://parcolia.ma/en?x=1");
  });
  it("the app's home is the dashboard", () => {
    expect(go("app.parcolia.ma", "/")).toBe("https://app.parcolia.ma/dashboard");
    expect(go("app.parcolia.ma", "/ar")).toBe("https://app.parcolia.ma/ar/dashboard");
    expect(go("app.parcolia.ma", "/fleet")).toBeNull();
  });
  it("previews and localhost are never redirected", () => {
    expect(go("parcolia-git-feature.vercel.app", "/login")).toBeNull();
    expect(go("localhost:3000", "/")).toBeNull();
  });
});
