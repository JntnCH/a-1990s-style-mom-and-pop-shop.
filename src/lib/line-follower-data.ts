const LEGACY_SAMPLE_LINE_USER_IDS = new Set([
  "C112233445566778899",
  "U77b8899aabbccdde1",
  "U55c66778899aabb11",
  "U44d5566778899aabb",
  "C998877665544332211",
  "U88f0192a83b27b9c1",
  "U99e1234c56d78a9b2",
]);

/** Remove only the known hard-coded sample accounts from older app data. */
export function removeLegacySampleLineFollowers<T extends { userId: string }>(
  followers: readonly T[] | null | undefined,
): T[] {
  if (!Array.isArray(followers)) return [];
  return followers.filter(
    (follower) =>
      Boolean(follower) &&
      typeof follower.userId === "string" &&
      !LEGACY_SAMPLE_LINE_USER_IDS.has(follower.userId),
  );
}
