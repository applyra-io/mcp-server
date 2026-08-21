#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const API_KEY = process.env.APPLYRA_API_KEY;
const BASE_URL = process.env.APPLYRA_BASE_URL || 'https://www.applyra.io';

if (!API_KEY) {
  console.error('Error: APPLYRA_API_KEY environment variable is required.');
  console.error('Get your API key at https://www.applyra.io/dashboard/api');
  process.exit(1);
}

type CallApiOptions = {
  params?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
};

async function callApi(path: string, options: CallApiOptions = {}): Promise<unknown> {
  const { params, method = 'GET', body } = options;
  const url = new URL(`/api/v1${path}`, BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value);
      }
    }
  }

  const headers: Record<string, string> = { 'X-API-Key': API_KEY! };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const responseBody = await response.json();

  if (!response.ok) {
    const errorMsg = (responseBody as { error?: string }).error || response.statusText;
    throw new Error(`Applyra API error (${response.status}): ${errorMsg}`);
  }

  return responseBody;
}

function buildParams(
  entries: Record<string, string | undefined>
): Record<string, string> | undefined {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value) params[key] = value;
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

function jsonResponse(result: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  };
}

// Reusable input schemas — keep parameter naming and descriptions consistent across tools.
const STORE_SCHEMA = z
  .enum(['GPLAY', 'ITUNES'])
  .describe('App store: GPLAY (Google Play) or ITUNES (App Store)');
const COUNTRY_SCHEMA = z.string().describe('ISO country code (e.g., US, FR, DE)');
const LANG_SCHEMA = z
  .string()
  .describe('BCP-47 language-region code (e.g., en-US, fr-FR, de-DE)');
const PAGE_SCHEMA = z.string().optional().describe('Page number (starts at 1)');
const PER_PAGE_HISTORY_SCHEMA = z
  .string()
  .optional()
  .describe('Results per page (max 200, default 50)');

const server = new McpServer({
  name: 'applyra',
  version: pkg.version,
});

server.registerTool(
  'list_applications',
  {
    description:
      'List all tracked mobile applications. Returns each app with its store metadata: title, description, app_id (bundle ID), store (ITUNES or GPLAY), country, lang (BCP-47), icon URL, screenshots, developer name, genre, version, rating score, number of ratings, and the count of tracked keywords. Usually the first call of a workflow: the numeric internal ID it returns is what track_keywords, add_competitor, get_app_score_history and the other app-scoped tools expect, whereas add_application takes the store bundle ID instead. Read-only, consumes no quota.',
    inputSchema: {
      app_id: z
        .string()
        .optional()
        .describe('Filter by application internal ID (numeric, e.g. "344")'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ app_id }) =>
    jsonResponse(await callApi('/applications', { params: buildParams({ app_id }) }))
);

server.registerTool(
  'add_application',
  {
    description:
      'Track a new mobile application by its store bundle ID. The app metadata is fetched from the store, an initial visibility score is computed, and the app is linked to the user workspace. Counts against the plan app cap.',
    inputSchema: {
      app_id: z
        .string()
        .describe(
          'Store bundle ID (e.g. "com.spotify.music" for GPLAY, "284882215" or a bundle ID like "com.facebook.Facebook" for ITUNES)'
        ),
      store: STORE_SCHEMA,
      country: COUNTRY_SCHEMA,
      lang: LANG_SCHEMA,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async ({ app_id, store, country, lang }) =>
    jsonResponse(
      await callApi('/applications', {
        method: 'POST',
        body: { app_id, store, country, lang },
      })
    )
);

server.registerTool(
  'list_keywords',
  {
    description:
      'List tracked keywords with ASO metrics. Returns each keyword with: keyword text, store, country, lang, difficulty_score (0-100), traffic_score (0-100), current_rank, ahead/behind (the apps ranked immediately above and below yours), the top 5 apps ranking for this keyword (in ranking order, rank 1 to 5), is_favorite flag, and the tracking start date. current_rank comes from the latest daily ranking snapshot and is null when the app is not in the top 100 for that keyword, in which case ahead and behind are null too. A null rank always means "not ranked", never "unknown": the tool errors out rather than returning partial rank data. Paginated.',
    inputSchema: {
      app_id: z
        .string()
        .optional()
        .describe('Filter keywords by application internal ID (numeric, e.g. "344")'),
      favorites: z
        .string()
        .optional()
        .describe('Set to "true" to return only keywords marked as favorite.'),
      page: PAGE_SCHEMA,
      per_page: z
        .string()
        .optional()
        .describe('Results per page (max 1000, default 200)'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ app_id, favorites, page, per_page }) =>
    jsonResponse(
      await callApi('/keywords', {
        params: buildParams({ app_id, favorites, page, per_page }),
      })
    )
);

server.registerTool(
  'inspect_keyword',
  {
    description:
      'Deep-analyze any keyword (even ones you don\'t track). Returns difficulty_score (0-100), traffic_score (0-100), KEI with score and level (e.g. "good"), the top 20 apps currently ranking for it (with rank, app_id, title, icon, genre, rating), related keyword suggestions from search and keyword sources, and whether you already track this keyword. Inspecting a keyword you already track does not consume the inspection quota.',
    inputSchema: {
      keyword: z.string().describe('The keyword to analyze'),
      store: STORE_SCHEMA,
      country: COUNTRY_SCHEMA,
      lang: LANG_SCHEMA,
    },
    // Mutation: consumes the keyword inspections quota when the keyword is not
    // already tracked, and always writes a row to the inspection history.
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async ({ keyword, store, country, lang }) =>
    jsonResponse(
      await callApi('/keywords/inspect', { params: { keyword, store, country, lang } })
    )
);

server.registerTool(
  'list_keyword_inspections',
  {
    description:
      'List the keywords you have previously inspected, with their last inspection date and current difficulty/traffic scores. Useful to revisit past keyword research without consuming the inspection quota again.',
    inputSchema: {
      page: PAGE_SCHEMA,
      per_page: PER_PAGE_HISTORY_SCHEMA,
    },
    annotations: { readOnlyHint: true },
  },
  async ({ page, per_page }) =>
    jsonResponse(
      await callApi('/keywords/inspect/history', { params: buildParams({ page, per_page }) })
    )
);

server.registerTool(
  'get_keyword_rank_history',
  {
    description:
      'Get the daily rank history of one tracked keyword, with one series per app that tracks it. Returns keyword, store, country, lang, the resolved from/to dates, and apps[] entries holding app_id, app_title and history[] of { date (YYYY-MM-DD), rank }, where rank is null on days the app did not rank. Defaults to the last 30 days. The window is capped at 400 days and at the plan history depth: a start date beyond it returns a PLAN_LIMIT error. Reversed dates are swapped and future dates are clamped to today. Pass keyword_id from list_keywords, and app_id to narrow the output to one app. For the visibility of a whole app rather than one keyword, use get_app_score_history.',
    inputSchema: {
      keyword_id: z
        .string()
        .describe('The keyword internal ID (numeric, from list_keywords results)'),
      from: z
        .string()
        .optional()
        .describe('Start date in YYYY-MM-DD format. Defaults to 30 days ago.'),
      to: z
        .string()
        .optional()
        .describe('End date in YYYY-MM-DD format. Defaults to today.'),
      app_id: z.string().optional().describe('Filter by specific app ID'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ keyword_id, from, to, app_id }) =>
    jsonResponse(
      await callApi(`/keywords/${keyword_id}/ranks/history`, {
        params: buildParams({ from, to, app_id }),
      })
    )
);

server.registerTool(
  'set_keyword_favorite',
  {
    description:
      'Mark or unmark a tracked keyword as favorite for a specific app. Favorites are stored per tracking row (profile + app + keyword), so a keyword tracked across multiple apps has independent favorite states. Both keyword_id and app_id come from list_keywords results.',
    inputSchema: {
      keyword_id: z
        .string()
        .describe('The keyword internal ID (numeric, from list_keywords results)'),
      app_id: z
        .string()
        .describe('The application internal ID (numeric, from list_keywords results)'),
      is_favorite: z.boolean().describe('true to mark as favorite, false to unmark'),
    },
    // Mutation: overwrites the is_favorite flag on the tracking row. Idempotent
    // (calling twice with the same value yields the same final state).
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ keyword_id, app_id, is_favorite }) =>
    jsonResponse(
      await callApi(`/keywords/${keyword_id}/apps/${app_id}/favorite`, {
        method: 'PATCH',
        body: { is_favorite },
      })
    )
);

server.registerTool(
  'track_keywords',
  {
    description:
      'Track up to 20 new keywords for one of your applications in a single call. Each keyword triggers an immediate ranking fetch. Already-tracked keywords return a per-keyword error in `results`; previously removed keywords are reactivated automatically. Use app_id from list_applications results.',
    inputSchema: {
      keywords: z
        .array(z.string().min(2).max(100))
        .min(1)
        .max(20)
        .describe('Array of 1-20 keyword strings (each 2-100 chars)'),
      app_id: z
        .number()
        .int()
        .positive()
        .describe('The application internal ID (numeric, from list_applications results)'),
      store: STORE_SCHEMA,
      country: COUNTRY_SCHEMA,
      lang: LANG_SCHEMA,
    },
    // Mutation: each keyword consumes a proxy hit, persists tracking + competitor backfill.
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async ({ keywords, app_id, store, country, lang }) =>
    jsonResponse(
      await callApi('/keywords', {
        method: 'POST',
        body: { keywords, app_id, store, country, lang },
      })
    )
);

server.registerTool(
  'untrack_keyword',
  {
    description:
      'Stop tracking a keyword for the specified app (soft delete). The historical ranking data is preserved; re-adding the same keyword reactivates the row. Idempotent: calling on an already-removed row returns success.',
    inputSchema: {
      keyword_id: z
        .string()
        .describe('The keyword internal ID (numeric, from list_keywords results)'),
      app_id: z
        .string()
        .describe('The application internal ID (numeric, from list_keywords results)'),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ keyword_id, app_id }) =>
    jsonResponse(
      await callApi(`/keywords/${keyword_id}/apps/${app_id}`, { method: 'DELETE' })
    )
);

server.registerTool(
  'get_app_score_history',
  {
    description:
      'Get the daily visibility score history of one application. The visibility score (0-100) summarises how discoverable the app is across its tracked keywords. Returns app_id, app_title, the resolved from/to dates, and history[] of { date (YYYY-MM-DD), score }, where score is null on days with no snapshot. Defaults to the last 30 days. The window is capped at 400 days and at the plan history depth: a start date beyond it returns a PLAN_LIMIT error. Reversed dates are swapped and future dates are clamped to today. Pass the numeric internal ID from list_applications, not the store bundle ID. For one keyword rank over time, use get_keyword_rank_history.',
    inputSchema: {
      app_id: z
        .string()
        .describe('The application internal ID (numeric, e.g. "344" from list_applications results)'),
      from: z
        .string()
        .optional()
        .describe('Start date in YYYY-MM-DD format. Defaults to 30 days ago.'),
      to: z
        .string()
        .optional()
        .describe('End date in YYYY-MM-DD format. Defaults to today.'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ app_id, from, to }) =>
    jsonResponse(
      await callApi(`/applications/${app_id}/scores/history`, {
        params: buildParams({ from, to }),
      })
    )
);

server.registerTool(
  'list_competitors',
  {
    description:
      'List competitor tracking pairs. Each pair holds your app (id, app_id, title, icon, store only) and the competitor app with its full store metadata (title, description, url, icon, screenshots, developer_name, genre, version, score, ratings), plus both apps\' visibility scores (app_score vs competitor_score, 0-100) for direct ASO comparison. Use list_applications to get the full metadata of your own app.',
    inputSchema: {
      app_id: z
        .string()
        .optional()
        .describe('Filter competitors by application internal ID (numeric, e.g. "344")'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ app_id }) =>
    jsonResponse(await callApi('/competitors', { params: buildParams({ app_id }) }))
);

server.registerTool(
  'add_competitor',
  {
    description:
      'Add a competitor app to one of your applications, identified by the competitor\'s store bundle ID. The competitor metadata is fetched from the store and ranking entries are backfilled for every keyword tracked on the main app.',
    inputSchema: {
      app_id: z
        .number()
        .int()
        .positive()
        .describe('The main application internal ID (from list_applications results)'),
      competitor_app_id: z
        .string()
        .describe(
          'Store bundle ID of the competitor (e.g. "com.spotify.music" for GPLAY, "284882215" or a bundle ID for ITUNES)'
        ),
      store: STORE_SCHEMA,
      country: COUNTRY_SCHEMA,
      lang: LANG_SCHEMA,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async ({ app_id, competitor_app_id, store, country, lang }) =>
    jsonResponse(
      await callApi('/competitors', {
        method: 'POST',
        body: { app_id, competitor_app_id, store, country, lang },
      })
    )
);

server.registerTool(
  'remove_competitor',
  {
    description:
      'Remove a competitor relationship by its internal relation ID (the `id` field returned by list_competitors or add_competitor — note that this is the relation row id, not the competitor app id).',
    inputSchema: {
      relation_id: z
        .string()
        .describe('Competitor relation internal ID (the `id` field at the top level of list_competitors / add_competitor responses)'),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ relation_id }) =>
    jsonResponse(await callApi(`/competitors/${relation_id}`, { method: 'DELETE' }))
);

server.registerTool(
  'run_autocomplete',
  {
    description:
      'Fetch autocomplete suggestions from the App Store or Google Play for a given prefix (1-60 characters). Useful to discover what users are searching for that starts with a given seed. Consumes one autocomplete query and one API request.',
    inputSchema: {
      store: STORE_SCHEMA,
      country: COUNTRY_SCHEMA,
      lang: LANG_SCHEMA,
      prefix: z
        .string()
        .describe('Search prefix to autocomplete (1-60 chars, e.g. "fitness")'),
    },
    // Mutation: consumes one autocomplete query and one API request, and
    // upserts a row in the autocomplete history.
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async ({ store, country, lang, prefix }) =>
    jsonResponse(
      await callApi('/autocomplete', { params: { store, country, lang, prefix } })
    )
);

server.registerTool(
  'list_autocomplete_history',
  {
    description:
      'List the autocomplete queries you have previously run, with the prefix, store, country, lang, suggestion count and last query date.',
    inputSchema: {
      page: PAGE_SCHEMA,
      per_page: PER_PAGE_HISTORY_SCHEMA,
    },
    annotations: { readOnlyHint: true },
  },
  async ({ page, per_page }) =>
    jsonResponse(
      await callApi('/autocomplete/history', { params: buildParams({ page, per_page }) })
    )
);

server.registerTool(
  'run_niche_analysis',
  {
    description:
      'Run a niche analysis on a topic: discovers relevant keywords, clusters them into sub-niches, and scores each cluster\'s opportunity. Returns clusters with their keywords, opportunity scores, intent type, and an app concept suggestion. Cache hits (recent identical analyses, less than 7 days old) are returned instantly without consuming the niche analysis quota. Fresh analyses can take a few minutes.',
    inputSchema: {
      topic: z
        .string()
        .describe('Niche topic to analyze (2-100 characters, e.g. "meditation")'),
      store: STORE_SCHEMA,
      country: COUNTRY_SCHEMA,
      lang: LANG_SCHEMA,
    },
    // Mutation: fresh analyses consume the niche analysis quota and write the
    // result to the shared cache + user history. Cache hits still link the
    // user to the cache entry. Always consumes one API request.
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async ({ topic, store, country, lang }) =>
    jsonResponse(await callApi('/niches', { params: { topic, store, country, lang } }))
);

server.registerTool(
  'list_niche_analyses',
  {
    description:
      'List the niche analyses previously run, with topic, store, country, lang, cluster count, keyword count, top opportunity score and creation date. Paginated through page and per_page. Read-only and free: it consumes no niche-analysis quota, so call it before run_niche_analysis to check whether a topic was already covered. It returns summary rows only, not the clusters and keywords themselves.',
    inputSchema: {
      page: PAGE_SCHEMA,
      per_page: PER_PAGE_HISTORY_SCHEMA,
    },
    annotations: { readOnlyHint: true },
  },
  async ({ page, per_page }) =>
    jsonResponse(
      await callApi('/niches/history', { params: buildParams({ page, per_page }) })
    )
);

server.registerTool(
  'top_charts',
  {
    description:
      'Get a store top-chart ranking (App Store or Google Play) for a country, category and collection, with daily rank movement. Returns the snapshot date and ranked apps (rank, app_id, apple_id, title, developer, icon, rating, price, currency, delta vs. yesterday, is_new). Category: pass "OVERALL" (default) for the overall chart, or a store category value (iTunes genre id e.g. "6014" for Games, or a Google Play category e.g. "GAME"). Collection: free (default), paid, or grossing.',
    inputSchema: {
      store: STORE_SCHEMA,
      country: COUNTRY_SCHEMA,
      category: z
        .string()
        .optional()
        .describe(
          'Category key: "OVERALL" (default) or a store category value (iTunes genre id e.g. "6014", Google Play category e.g. "GAME")'
        ),
      collection: z
        .enum(['free', 'paid', 'grossing'])
        .optional()
        .describe('Chart type: free (default), paid, or grossing'),
      limit: z.string().optional().describe('Max rows to return (max 200, default 100)'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ store, country, category, collection, limit }) =>
    jsonResponse(
      await callApi('/top-charts', {
        params: buildParams({ store, country, category, collection, limit }),
      })
    )
);

server.registerTool(
  'list_top_chart_categories',
  {
    description:
      'List the categories and collections supported by the top_charts tool, per store. Use a returned category "key" (e.g. "OVERALL" for the overall chart, or a store value like "6014" / "GAME") and a collection (free, paid, grossing) as inputs to top_charts.',
    inputSchema: {
      store: z
        .enum(['GPLAY', 'ITUNES'])
        .optional()
        .describe('Filter to one store; omit to get both'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ store }) =>
    jsonResponse(await callApi('/top-charts/categories', { params: buildParams({ store }) }))
);

server.registerTool(
  'get_account_usage',
  {
    description:
      'Get current account usage and plan limits: number of applications, keywords, competitors, keyword inspections, niche analyses and autocomplete queries used vs. allowed, plus API request count for the current billing period.',
    annotations: { readOnlyHint: true },
  },
  async () => jsonResponse(await callApi('/account/usage'))
);

const transport = new StdioServerTransport();
await server.connect(transport);
