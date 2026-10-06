#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createApplyraServer } from './server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const API_KEY = process.env.APPLYRA_API_KEY;
const BASE_URL = process.env.APPLYRA_BASE_URL || 'https://www.applyra.io';

if (!API_KEY) {
  console.error('Error: APPLYRA_API_KEY environment variable is required.');
  console.error('Get your API key at https://www.applyra.io/dashboard/api');
  process.exit(1);
}

const server = createApplyraServer({
  baseUrl: BASE_URL,
  headers: { 'X-API-Key': API_KEY },
  version: pkg.version,
});

await server.connect(new StdioServerTransport());
