import { describe, expect, it } from "vitest";
import { removeLegacySampleLineFollowers } from "./line-follower-data";

describe("removeLegacySampleLineFollowers", () => {
  it("removes only the hard-coded legacy sample IDs", () => {
    const followers = [
      { userId: "C112233445566778899", displayName: "ตัวอย่าง" },
      { userId: "U-real-line-user-id", displayName: "ผู้ใช้จริง" },
    ];

    expect(removeLegacySampleLineFollowers(followers)).toEqual([
      { userId: "U-real-line-user-id", displayName: "ผู้ใช้จริง" },
    ]);
  });

  it("returns an empty list when no follower data exists", () => {
    expect(removeLegacySampleLineFollowers(undefined)).toEqual([]);
  });
});
