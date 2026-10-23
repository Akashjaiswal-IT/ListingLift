import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildReferralLink,
  clearReferralCode,
  isPermanentReferralError,
  normalizeReferralCode,
  readReferralCode,
  referralCodeFromSearch,
  saveReferralCode,
} from "./referral-link";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

describe("referral link helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", fakeStorage());
  });

  it("normalises valid codes and rejects anything else", () => {
    expect(normalizeReferralCode(" pesh-ab12cd ")).toBe("PESH-AB12CD");
    for (const bad of ["", "AB12CD", "PESH-", "PESH-AB 12", "PESH-<script>", null, undefined]) {
      expect(normalizeReferralCode(bad as string)).toBeNull();
    }
  });

  it("builds the signup link and reads the code back from it", () => {
    const link = buildReferralLink("https://peshkarai.in/", "PESH-AB12CD");
    expect(link).toBe("https://peshkarai.in/signup?ref=PESH-AB12CD");
    expect(referralCodeFromSearch(new URL(link).search)).toBe("PESH-AB12CD");
    expect(referralCodeFromSearch("?utm=x")).toBeNull();
    expect(referralCodeFromSearch("?ref=not-a-code")).toBeNull();
  });

  it("remembers a code, forgets it on clear, and expires it after 30 days", () => {
    const now = 1_000_000_000_000;
    saveReferralCode("PESH-AB12CD", now);
    expect(readReferralCode(now + 1000)).toBe("PESH-AB12CD");
    expect(readReferralCode(now + 31 * 24 * 3600 * 1000)).toBeNull();
    expect(localStorage.getItem("peshkar_ref")).toBeNull(); // expired entry is removed

    saveReferralCode("PESH-AB12CD", now);
    clearReferralCode();
    expect(readReferralCode(now)).toBeNull();
  });

  it("ignores a tampered stored value", () => {
    localStorage.setItem("peshkar_ref", JSON.stringify({ code: "<img>", savedAt: Date.now() }));
    expect(readReferralCode()).toBeNull();
    localStorage.setItem("peshkar_ref", "not json");
    expect(readReferralCode()).toBeNull();
  });

  it("never throws when storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => saveReferralCode("PESH-AB12CD")).not.toThrow();
    expect(readReferralCode()).toBeNull();
    expect(() => clearReferralCode()).not.toThrow();
  });

  it("forgets the code only on rejections that can never succeed", () => {
    expect(isPermanentReferralError("BAD_REQUEST")).toBe(true);
    expect(isPermanentReferralError("NOT_FOUND")).toBe(true);
    for (const code of ["UNAUTHORIZED", "INTERNAL_SERVER_ERROR", "TOO_MANY_REQUESTS", undefined]) {
      expect(isPermanentReferralError(code)).toBe(false);
    }
  });
});
