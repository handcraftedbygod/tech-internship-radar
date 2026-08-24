import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJobs } from "./glovo.ts";

const CARD = `
<div class="col-xl-3 col-lg-4 col-md-6 col-12 123" data-job-card="744000136217349" data-job-profile="Business Operations - IC3">
    <div class="career-card">
        <div class="career-img"><img src="https://careers.glovoapp.com/icon.png" alt=""></div>
        <div class="saved-job"><a href="javascript:void(0)" class="save-job-btn"></a></div>
        <h4 class="job-title">Intern Commercial Strategy Analyst</h4>
        <ul class="job-address">
            <li><img src="location.svg" alt=""><span>Madrid, Spain</span></li>
            <li><img src="department.svg" alt=""><span>Commercial</span></li>
        </ul>
        <div class="apply-job"><div class="apply-job-btn">
            <a href="https://careers.glovoapp.com/job/intern-commercial-strategy-analyst-in-madrid-spain-jid-744000136217349/">Apply</a>
        </div></div>
    </div>
</div>`;

test("extractJobs pulls id, title, first address line, and apply url from a job card", () => {
  assert.deepEqual(extractJobs(CARD), [
    {
      id: "744000136217349",
      title: "Intern Commercial Strategy Analyst",
      location: "Madrid, Spain",
      url: "https://careers.glovoapp.com/job/intern-commercial-strategy-analyst-in-madrid-spain-jid-744000136217349/",
    },
  ]);
});

test("extractJobs handles multiple cards in one fragment", () => {
  assert.equal(extractJobs(CARD + CARD).length, 2);
});

test("extractJobs returns an empty array when there are no cards", () => {
  assert.deepEqual(extractJobs("<div class=\"row job-list\"></div>"), []);
});
