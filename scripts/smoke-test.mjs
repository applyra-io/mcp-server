/**
 * Starts the built server over stdio with a placeholder key and checks that it
 * speaks MCP and exposes the full tool surface. No network call is made: the
 * key is only read at tool-call time, never at startup.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const EXPECTED_TOOL_COUNT = 25;

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['dist/index.js'],
  env: { ...process.env, APPLYRA_API_KEY: 'ci_placeholder_key' },
});

const client = new Client({ name: 'applyra-ci', version: '1.0.0' });
await client.connect(transport);

const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();

const undescribed = tools.filter((t) => !t.description || t.description.length < 40);
const unschemad = tools.filter((t) => !t.inputSchema);
// The ChatGPT plugin directory rejects a tool that leaves any of these three
// hints implicit, and the Claude connector directory one without a title.
const HINTS = ['readOnlyHint', 'destructiveHint', 'openWorldHint'];
const unannotated = tools.filter((t) => HINTS.some((hint) => typeof t.annotations?.[hint] !== 'boolean'));
const untitled = tools.filter((t) => !t.title);

await client.close();

console.log(`${tools.length} tools: ${names.join(', ')}`);

let failed = false;
if (tools.length !== EXPECTED_TOOL_COUNT) {
  console.error(`FAIL expected ${EXPECTED_TOOL_COUNT} tools, got ${tools.length}`);
  failed = true;
}
if (undescribed.length) {
  console.error(`FAIL tools with a missing or too short description: ${undescribed.map((t) => t.name).join(', ')}`);
  failed = true;
}
if (unschemad.length) {
  console.error(`FAIL tools without an input schema: ${unschemad.map((t) => t.name).join(', ')}`);
  failed = true;
}
if (unannotated.length) {
  console.error(`FAIL tools without explicit ${HINTS.join(', ')}: ${unannotated.map((t) => t.name).join(', ')}`);
  failed = true;
}
if (untitled.length) {
  console.error(`FAIL tools without a title: ${untitled.map((t) => t.name).join(', ')}`);
  failed = true;
}

if (failed) process.exit(1);
console.log('smoke test passed');
