import type { Fetcher } from "./types.ts";
import greenhouse from "./greenhouse.ts";
import lever from "./lever.ts";
import ashby from "./ashby.ts";
import workday from "./workday.ts";
import adzuna from "./adzuna.ts";
import arbeitnow from "./arbeitnow.ts";
import remotive from "./remotive.ts";

// Add a new source: write one file implementing Fetcher, then add it here.
export const fetchers: Fetcher[] = [greenhouse, lever, ashby, workday, adzuna, arbeitnow, remotive];
