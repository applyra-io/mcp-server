---
name: aso-research
description: Research and improve an app's App Store or Google Play visibility with the Applyra tools. Use when the user asks about keyword rankings, keyword ideas, competitors, app metadata (title, subtitle, description) or ASO in general.
---

# ASO research with Applyra

## When to use

- The user wants to know how their app ranks, or why it dropped
- The user is looking for keywords to target
- The user is rewriting a title, subtitle, short description or keywords field
- The user wants to compare their app with competitors

## Instructions

1. Start with `list_applications` to find the app and its store, country and language. Never guess an app ID.
2. For rankings, use `list_keywords`, then `get_keyword_rank_history` on the keywords that moved.
3. For keyword ideas, combine `run_autocomplete`, `inspect_keyword` and `run_niche_analysis`. Prefer keywords with real traffic and a difficulty the app can win, and check `get_account_usage` before running many inspections.
4. For competitors, use `list_competitors`, then `add_competitor` if the user names a new one.
5. For metadata changes, run `check_metadata` on the draft, then `simulate_metadata` to estimate the effect before the user ships it. `get_aso_health` gives the overall score to compare against.
6. Ask before calling a tool that changes the account (`track_keywords`, `untrack_keyword`, `add_application`, `add_competitor`, `remove_competitor`).
7. Report numbers with their store and country, since rankings differ per market.
