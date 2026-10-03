#!/usr/bin/env node
'use strict';

// WebPoint Extractors — internal MCP server (stdio).
//
// One validation surface for Claude (Twin 2), Cursor (Twin 1) and scripts. Uses the same
// county catalog, probe classifier and Postgres as the web app.
//
//   node mcp/extractors-server.js            (DATABASE_URL optional; without it proposals live in memory)
//
// Roles: WEBPOINT_MCP_ROLE=claude (default) can read, probe and PROPOSE locks.
//        Nobody approves a lock through MCP. Approval is a human action in /editor.html.
//
// stdout is the MCP channel. All logging goes to stderr.

require('dotenv').config({ quiet: true });
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

console.log = (...a) => console.error(...a); // keep stdout clean for JSON-RPC

const store = require('../src/db/store');
const validation = require('../src/services/extractorValidation');
const locks = require('../src/db/extractorLocks');

const ROLE = String(process.env.WEBPOINT_MCP_ROLE || 'claude').toLowerCase() === 'human' ? 'human' : 'claude';
const PROPOSER = process.env.WEBPOINT_MCP_NAME || (ROLE === 'claude' ? 'claude-mcp' : 'editor-mcp');

function reply(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data };
}

function fail(message) {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

function buildServer() {
  const server = new McpServer({ name: 'webpoint-extractors-mcp-server', version: '1.0.0' });

  server.registerTool(
    'extractor_stats',
    {
      title: 'Extractor coverage stats',
      description:
        'Counts for all 3,333 county extractors: how many have a verified collector search page, how many are dead, homepage-only, unprobed, editor-locked, and how many lock proposals wait for review.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async () => reply({ ...validation.stats(), lock_proposals: await locks.stats() })
  );

  server.registerTool(
    'extractor_lookup',
    {
      title: 'Look up one county extractor',
      description:
        'Return the extractor for one county: key, entity, current search URL, whether it is verified (catalog or editor-approved), last probe verdict, and any different candidate URL from the 2k extractor dump. Pass key like "WI-Chippewa", or county + state.',
      inputSchema: {
        key: z.string().optional().describe('County key, e.g. "WI-Chippewa" or "TX-Bell"'),
        county: z.string().optional().describe('County name if no key, e.g. "Chippewa"'),
        state: z.string().length(2).optional().describe('Two-letter state, e.g. "WI"')
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (args) => {
      const out = validation.lookup(args);
      return out.ok ? reply(out) : fail(out.error);
    }
  );

  server.registerTool(
    'extractor_list',
    {
      title: 'List county extractors',
      description:
        'Page through county extractors filtered by probe status, state, or verified. Use this to build a work list, e.g. all "unknown_live" in TX or all unverified in FL. Returns has_more and next_offset.',
      inputSchema: {
        status: z.enum(validation.STATUSES).optional().describe('Probe status filter'),
        state: z.string().length(2).optional().describe('Two-letter state'),
        verified: z.boolean().optional().describe('true = only verified, false = only unverified'),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(25)
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (args) => reply(validation.list(args))
  );

  server.registerTool(
    'extractor_validate',
    {
      title: 'Probe one county search page live',
      description:
        'Fetch the county search page (or a candidate url) and classify it with the WebPoint probe: collector_search, assessor_search, homepage, unknown_live, or dead. Also reports which DR Production Results columns the page shows, Cloudflare gating, and lock_eligible. Read-only; saves nothing.',
      inputSchema: {
        key: z.string().optional().describe('County key, e.g. "WI-Chippewa"'),
        url: z.string().url().optional().describe('Candidate URL to probe instead of the stored one')
      },
      annotations: { readOnlyHint: true, openWorldHint: true }
    },
    async (args) => {
      const out = await validation.validate(args);
      return out.ok ? reply(out) : fail(out.error);
    }
  );

  server.registerTool(
    'extractor_validate_batch',
    {
      title: 'Probe up to 25 counties',
      description:
        'Live-probe up to 25 county keys at once (4 at a time). Returns a verdict tally plus each result. Use extractor_list to pick the keys. Read-only; saves nothing.',
      inputSchema: {
        keys: z.array(z.string()).min(1).max(25).describe('County keys, e.g. ["TX-Bell","TX-Travis"]')
      },
      annotations: { readOnlyHint: true, openWorldHint: true }
    },
    async ({ keys }) => reply(await validation.validateMany({ keys }))
  );

  server.registerTool(
    'extractor_discover',
    {
      title: 'Find the collector search page for a county',
      description:
        'For a county whose stored URL is a homepage, assessor page or dead: open the stored page and the 2k-dump candidate, follow "pay taxes" / vendor links and treasurer or tax-collector pages (2 hops), and probe every link found. Returns best (lock-eligible first) and all collector candidates. Read-only; pass best.final_url to extractor_propose_lock.',
      inputSchema: {
        key: z.string().optional().describe('County key, e.g. "TX-Bell"'),
        url: z.string().url().optional().describe('Extra start page, e.g. the county homepage'),
        max_probes: z.number().int().min(1).max(20).default(10).describe('How many found links to probe')
      },
      annotations: { readOnlyHint: true, openWorldHint: true }
    },
    async ({ key, url, max_probes }) => {
      const out = await validation.discover({ key, url, maxProbes: max_probes });
      return out.ok ? reply(out) : fail(out.error);
    }
  );

  server.registerTool(
    'extractor_discover_batch',
    {
      title: 'Find collector pages for up to 10 counties',
      description: 'Run extractor_discover on up to 10 county keys, 3 at a time. Returns how many found a collector page and each result. Read-only.',
      inputSchema: { keys: z.array(z.string()).min(1).max(10) },
      annotations: { readOnlyHint: true, openWorldHint: true }
    },
    async ({ keys }) => reply(await validation.discoverMany({ keys }))
  );

  server.registerTool(
    'extractor_propose_lock',
    {
      title: 'Propose locking a collector search URL',
      description:
        'Put a collector search URL in the human review queue for one county. Runs a live probe first and refuses unless the verdict is collector_search (pass force_review=true to queue a borderline page with a note). Nothing changes for members until a human approves it in /editor.html.',
      inputSchema: {
        key: z.string().describe('County key, e.g. "TX-Bell"'),
        url: z.string().url().optional().describe('URL to lock; defaults to the stored URL'),
        note: z.string().max(1000).optional().describe('Why this is the right collector page'),
        force_review: z.boolean().default(false).describe('Queue even if the probe is not collector_search')
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ key, url, note, force_review }) => {
      const probe = await validation.validate({ key, url });
      if (!probe.ok) return fail(probe.error);
      if (!probe.lock_eligible && !force_review) {
        return fail(
          `Not proposed: probe says ${probe.verdict} (${probe.reason})${probe.cloudflare ? ', Cloudflare-gated' : ''}. ` +
            'Find the collector search page, or pass force_review=true with a note so a human can judge it.'
        );
      }
      const row = validation.findRow(key);
      const out = await locks.propose({
        jurisdictionKey: probe.key || key,
        state: row && row.state,
        county: row && row.county,
        url: probe.final_url || probe.url,
        verdict: probe.verdict,
        reason: probe.reason,
        drFields: probe.dr_fields,
        evidence: { title: probe.title, http_status: probe.http_status, search_fields: probe.search_fields, cloudflare: probe.cloudflare, note: note || null, forced: Boolean(force_review) },
        proposer: PROPOSER,
        role: ROLE
      });
      return out.ok ? reply({ ...out, probe }) : fail(out.error);
    }
  );

  server.registerTool(
    'extractor_lock_queue',
    {
      title: 'List lock proposals',
      description: 'Lock proposals by status (pending, approved, rejected, all), optionally for one county key.',
      inputSchema: {
        status: z.enum(['pending', 'approved', 'rejected', 'all']).default('pending'),
        key: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50)
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ status, key, limit }) => reply({ items: await locks.list({ status, key: key || null, limit }) })
  );

  return server;
}

async function main() {
  await store.init();
  const server = buildServer();
  await server.connect(new StdioServerTransport());
  console.error(`webpoint-extractors-mcp-server ready (role=${ROLE}, db=${store.usingPostgres() ? 'postgres' : 'memory'})`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('extractors mcp fatal', err);
    process.exit(1);
  });
}

module.exports = { buildServer };
