import { test } from "node:test";
import assert from "node:assert/strict";
import { siteUrl, parsePostedOn } from "./workday.ts";

test("siteUrl inserts the career-site name between origin and externalPath", () => {
  const url = siteUrl(
    "https://salesforce.wd12.myworkdayjobs.com/wday/cxs/salesforce/External_Career_Site/jobs",
    "/job/California---San-Francisco/Intern_JR348039-1",
  );
  assert.equal(
    url,
    "https://salesforce.wd12.myworkdayjobs.com/External_Career_Site/job/California---San-Francisco/Intern_JR348039-1",
  );
});

test("parsePostedOn converts 'Posted Today' to an ISO date close to now", () => {
  const result = parsePostedOn("Posted Today");
  assert.ok(result);
  assert.ok(Date.now() - new Date(result).getTime() < 5000);
});

test("parsePostedOn converts 'Posted N Days Ago' to N days before now", () => {
  const result = parsePostedOn("Posted 6 Days Ago");
  assert.ok(result);
  const ageDays = (Date.now() - new Date(result).getTime()) / (24 * 60 * 60 * 1000);
  assert.ok(Math.abs(ageDays - 6) < 0.01);
});

test("parsePostedOn handles the '30+ Days Ago' cap", () => {
  const result = parsePostedOn("Posted 30+ Days Ago");
  assert.ok(result);
  const ageDays = (Date.now() - new Date(result).getTime()) / (24 * 60 * 60 * 1000);
  assert.ok(Math.abs(ageDays - 30) < 0.01);
});

test("parsePostedOn returns null for missing or unrecognized text", () => {
  assert.equal(parsePostedOn(undefined), null);
  assert.equal(parsePostedOn("some unexpected format"), null);
});
