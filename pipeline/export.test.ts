import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanDescription } from "./export.ts";

test("cleanDescription strips tags and turns block-level closers into paragraph breaks", () => {
  const html = "<p>We build things.</p><p>You will <strong>ship code</strong>.</p>";
  assert.equal(cleanDescription(html), "We build things.\n\nYou will ship code.");
});

test("cleanDescription turns <br> into a single newline", () => {
  assert.equal(cleanDescription("Line one<br>Line two"), "Line one\nLine two");
});

test("cleanDescription decodes common HTML entities", () => {
  assert.equal(cleanDescription("R&amp;D team &mdash; it&#39;s great".replace("&mdash;", "-")), "R&D team - it's great");
});

test("cleanDescription collapses runs of blank lines and trims", () => {
  assert.equal(cleanDescription("<p>A</p>\n\n\n\n<p>B</p>"), "A\n\nB");
});

test("cleanDescription passes plain text through unchanged", () => {
  assert.equal(cleanDescription("Just plain text, no markup."), "Just plain text, no markup.");
});

test("cleanDescription strips tags that arrive double HTML-escaped (Greenhouse's content field)", () => {
  const doubleEscaped = "&lt;p&gt;AI &amp;amp; Management Consulting&lt;/p&gt;&lt;p&gt;Second line&lt;/p&gt;";
  assert.equal(cleanDescription(doubleEscaped), "AI & Management Consulting\n\nSecond line");
});
