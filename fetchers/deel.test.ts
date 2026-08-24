import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPostings } from "./deel.ts";

// Mimics the double-escaped RSC flight payload Deel inlines into the page
// HTML: self.__next_f.push([1,"...\"jobId\":\"...\",\"title\":\"...\"..."])
function fakePosting(jobId: string, title: string, location: string, createdAt: string): string {
  return (
    `\\"jobId\\":\\"${jobId}\\",\\"title\\":\\"${title}\\",` +
    `\\"richtextDescription\\":\\"$31\\",\\"applicationFormId\\":\\"x\\",` +
    `\\"isCompensationVisible\\":true,\\"createdAt\\":\\"${createdAt}\\",` +
    `\\"updatedAt\\":\\"${createdAt}\\",\\"job\\":{\\"id\\":\\"${jobId}\\",` +
    `\\"workArrangementEnum\\":\\"ON_SITE\\",\\"jobLocations\\":[{\\"id\\":\\"loc1\\",` +
    `\\"location\\":{\\"id\\":\\"l1\\",\\"name\\":\\"${location}\\"}}]}`
  );
}

test("extractPostings pulls jobId, title, location, createdAt from the flight payload", () => {
  const html = `self.__next_f.push([1,"${fakePosting("11111111-1111-1111-1111-111111111111", "Credit Data Engineer", "Stockholm", "2026-01-16T09:18:02.741Z")}"])`;
  const postings = extractPostings(html);
  assert.deepEqual(postings, [
    {
      jobId: "11111111-1111-1111-1111-111111111111",
      title: "Credit Data Engineer",
      location: "Stockholm",
      createdAt: "2026-01-16T09:18:02.741Z",
    },
  ]);
});

test("extractPostings dedupes repeated jobIds (Deel repeats postings across page chunks)", () => {
  const one = fakePosting("22222222-2222-2222-2222-222222222222", "AML Specialist", "Berlin", "2026-02-01T00:00:00.000Z");
  const html = `self.__next_f.push([1,"${one}"])self.__next_f.push([1,"${one}"])`;
  assert.equal(extractPostings(html).length, 1);
});

test("extractPostings returns nothing for a page with no postings", () => {
  assert.deepEqual(extractPostings("<html><body>no jobs here</body></html>"), []);
});
