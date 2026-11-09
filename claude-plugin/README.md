# Applyra for Claude

Applyra tracks your apps' keyword rankings on the App Store and Google Play every day. This plugin
gives Claude your Applyra data, and a skill that knows how to use it: find out why a keyword
dropped, pick keywords your app can win, compare yourself with competitors, and score a new title,
subtitle or keywords field before you ship it.

## What it installs

- **The Applyra connector.** Claude connects to `https://www.applyra.io/api/mcp`, Applyra's hosted
  MCP server, the same one listed in the Claude directory. The first time, Claude opens an Applyra
  page: you sign in to your Applyra account, see what Claude will be able to do, and allow it. There
  is no API key to copy, and you can disconnect it at any time from the MCP page of your Applyra
  dashboard.
- **The `aso-research` skill.** It tells Claude which of the 25 Applyra tools answer which question,
  and how to get the most from them: every number read from your account, lengths counted the way
  the stores count them, a keywords field spent on new words, keywords the app can actually win.

## What it sends, and where

Nothing runs on your computer. When Claude uses a tool, it sends that request (an app, a keyword, a
store and a country, or the listing text you asked it to check) to Applyra over HTTPS, and Applyra
answers with data from your account. The plugin sends nothing anywhere else. The tools can change
what your Applyra account tracks, such as adding a keyword or a competitor, and the skill has
Claude ask you first. They never publish anything to App Store Connect or Google Play.

## Requirements

An Applyra account on the paid plan.

## Links

- Documentation: https://www.applyra.io/docs/api/mcp-server
- Privacy policy: https://www.applyra.io/privacy
- Terms: https://www.applyra.io/terms
- Support: hello@applyra.io
