/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiQuotes from "../aiQuotes.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as quotes from "../quotes.js";
import type * as readingHistory from "../readingHistory.js";
import type * as search from "../search.js";
import type * as seedCategories from "../seedCategories.js";
import type * as seedQuotes from "../seedQuotes.js";
import type * as seedSynonyms from "../seedSynonyms.js";
import type * as stripe from "../stripe.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiQuotes: typeof aiQuotes;
  auth: typeof auth;
  http: typeof http;
  quotes: typeof quotes;
  readingHistory: typeof readingHistory;
  search: typeof search;
  seedCategories: typeof seedCategories;
  seedQuotes: typeof seedQuotes;
  seedSynonyms: typeof seedSynonyms;
  stripe: typeof stripe;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
