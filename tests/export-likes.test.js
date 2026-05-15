/**
 * @jest-environment node
 */

function getArtistName(user) {
  const display = user?.display_name?.trim();
  if (display) return display;
  const username = user?.username?.trim();
  if (username) return username;
  return "Unknown Artist";
}

function formatLikeLine(track) {
  const title = track.title?.trim() || "Untitled";
  return `${title} - ${getArtistName(track.user)}`;
}

function likesToExportLines(likes) {
  return likes.map((like) => formatLikeLine(like.track));
}

function buildLikesExportFilename(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `soundcloud-likes-${y}-${m}-${d}.txt`;
}

describe("export-likes formatting", () => {
  test("prefers display_name over username", () => {
    expect(getArtistName({ display_name: "M83", username: "m83" })).toBe("M83");
  });

  test("falls back to username when display_name missing", () => {
    expect(getArtistName({ username: "m83" })).toBe("m83");
  });

  test("uses Unknown Artist when user missing", () => {
    expect(getArtistName(undefined)).toBe("Unknown Artist");
  });

  test("formats Title - Artist line", () => {
    expect(
      formatLikeLine({
        title: "Midnight City",
        user: { display_name: "M83", username: "m83" },
      })
    ).toBe("Midnight City - M83");
  });

  test("maps likes collection to lines in order", () => {
    const lines = likesToExportLines([
      { track: { title: "A", user: { username: "u1" } } },
      { track: { title: "B", user: { display_name: "Artist B" } } },
    ]);
    expect(lines).toEqual(["A - u1", "B - Artist B"]);
  });

  test("builds dated filename", () => {
    expect(buildLikesExportFilename(new Date("2026-05-14T12:00:00"))).toBe(
      "soundcloud-likes-2026-05-14.txt"
    );
  });
});
