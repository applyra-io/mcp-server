# @applyra/mcp-server

[![npm](https://img.shields.io/npm/v/@applyra/mcp-server)](https://www.npmjs.com/package/@applyra/mcp-server)
[![CI](https://github.com/applyra-io/mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/applyra-io/mcp-server/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

MCP (Model Context Protocol) server for [Applyra](https://www.applyra.io). It connects your App Store and Google Play keyword data to AI assistants like Claude, Cursor, VS Code Copilot, and more.

20 tools covering keyword rank tracking, difficulty and traffic scoring, competitor visibility, autocomplete mining, niche clustering, and top charts, on the App Store and Google Play.

## Prerequisites

- Node.js 20 or later
- An Applyra account with the **Unlimited plan**
- An API key, generated at [applyra.io/dashboard/api](https://www.applyra.io/dashboard/api)

## Installation

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "applyra": {
      "command": "npx",
      "args": ["-y", "@applyra/mcp-server"],
      "env": {
        "APPLYRA_API_KEY": "your_api_key"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` or `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "applyra": {
      "command": "npx",
      "args": ["-y", "@applyra/mcp-server"],
      "env": {
        "APPLYRA_API_KEY": "your_api_key"
      }
    }
  }
}
```

### VS Code (GitHub Copilot)

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "applyra": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@applyra/mcp-server"],
      "env": {
        "APPLYRA_API_KEY": "your_api_key"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add applyra -e APPLYRA_API_KEY=your_api_key -- npx -y @applyra/mcp-server
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "applyra": {
      "command": "npx",
      "args": ["-y", "@applyra/mcp-server"],
      "env": {
        "APPLYRA_API_KEY": "your_api_key"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `list_applications` | List tracked apps with store metadata, ratings, and keyword count |
| `add_application` | Track a new application by its store bundle ID. Fetches store metadata and computes the initial visibility score |
| `list_keywords` | Tracked keywords with current rank, favorite flag, difficulty/traffic scores |
| `track_keywords` | Track up to 20 new keywords for an application in a single call |
| `untrack_keyword` | Stop tracking a keyword for an application (soft delete) |
| `set_keyword_favorite` | Mark or unmark a tracked keyword as favorite for a specific app |
| `inspect_keyword` | Deep-analyze any keyword: difficulty, traffic, KEI, top 20 apps, related keywords |
| `list_keyword_inspections` | Past keyword inspections with their scores |
| `run_autocomplete` | Fetch autocomplete suggestions from the App Store or Google Play |
| `list_autocomplete_history` | Past autocomplete queries |
| `run_niche_analysis` | Cluster a niche topic into sub-niches with opportunity scores |
| `list_niche_analyses` | Past niche analyses |
| `top_charts` | Top apps chart for a store/country/category/collection, with daily rank movement |
| `list_top_chart_categories` | Categories and collections supported by `top_charts`, per store |
| `get_keyword_rank_history` | Daily rank evolution over a date range |
| `get_app_score_history` | Daily visibility score history for an app |
| `list_competitors` | Competitor pairs with side-by-side visibility scores |
| `add_competitor` | Add a competitor app to one of your applications by its store bundle ID |
| `remove_competitor` | Remove a competitor relationship by its internal ID |
| `get_account_usage` | Current usage vs. plan limits |

## Learn more

- [Applyra](https://www.applyra.io): ASO for indie developers, with a permanent free plan
- [MCP setup guide](https://www.applyra.io/dashboard/mcp) (requires an account)
- [REST API documentation](https://www.applyra.io/dashboard/api) (requires an account)

## License

MIT. See [LICENSE](./LICENSE).
