import type { Fetcher } from "./types.ts";
import greenhouse from "./greenhouse.ts";
import lever from "./lever.ts";
import ashby from "./ashby.ts";
import workday from "./workday.ts";
import smartrecruiters from "./smartrecruiters.ts";
import recruitee from "./recruitee.ts";
import adzuna from "./adzuna.ts";
import arbeitnow from "./arbeitnow.ts";
import remotive from "./remotive.ts";
import themuse from "./themuse.ts";
import eures from "./eures.ts";
import remoteok from "./remoteok.ts";
import vanshb03 from "./vanshinternships.ts";
import cvrve from "./cvrvenewgrad.ts";
import usajobs from "./usajobs.ts";
import arbeitsamt from "./arbeitsamt.ts";
import freehire from "./freehire.ts";
import aidevjobs from "./aidevjobs.ts";
import aijobs from "./artificialintelligencejobs.ts";
import reed from "./reed.ts";
import findwork from "./findwork.ts";

// Add a new source: write one file implementing Fetcher, then add it here.
export const fetchers: Fetcher[] = [
  greenhouse,
  lever,
  ashby,
  workday,
  smartrecruiters,
  recruitee,
  adzuna,
  arbeitnow,
  remotive,
  themuse,
  eures,
  remoteok,
  vanshb03,
  cvrve,
  usajobs,
  arbeitsamt,
  freehire,
  aidevjobs,
  aijobs,
  reed,
  findwork,
];
