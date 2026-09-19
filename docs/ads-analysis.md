# 당근 광고 분석 (/ads)

This feature is read-only. It does not create, modify, pause or fund ads.

## Connection boundary

The official Daangn Ads MCP is documented for expert-mode accounts connected to AI clients. The site builds a read-only lookup prompt and opens ChatGPT via the existing handoff. The user must connect and authorize the official MCP in ChatGPT. This web app does NOT have an OAuth session for Daangn, does NOT verify that connection, does NOT call undocumented ad APIs, and does NOT automatically synchronize results. Import the returned JSON or a CSV/TSV report to calculate the dashboard. Never mark copying the MCP URL as a successful connection.

Official endpoint: https://ads-mcp.kr.karrotmarket.com/mcp
Official guide: https://business.daangn.com/insights/b4ff5ccf-ed98-4784-a88d-686b9b358aae/당근-광고-MCP-소개
ChatGPT guide: https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt
Checked 2026-09-19. Client-plan and workspace restrictions can change; link to official guidance rather than promising universal availability.

## Data contract

JSON schema: goldcheju.ads.v1. Top-level rows must be daily, creative-level records with date, account/accountId, campaign/campaignId, creative/creativeId, spend, impressions, clicks, conversions, revenue. Dates are Asia/Seoul calendar dates and amounts are KRW. conversions/revenue are null when unavailable, not zero. Optional top-level taxBasis is included/excluded/unknown; attribution describes conversion measurement; complete=false marks partial extraction. Korean CSV aliases and UTF-8/EUC-KR are supported. Excel workbook files must be exported as CSV first.

Validation limits: 2 MB, 5,000 rows, real dates, nonnegative finite numbers, integer exposure/click counts. Reject mixed currencies/time zones, conflicting duplicate keys, malformed CSV and campaign-only aggregates. Identical duplicate rows count once. Recognized total rows are excluded. Empty date ranges stay empty.

Metrics use sums, NOT averages of rates: CTR=clicks/impressions*100; CPC=spend/clicks; CPA=spend/conversions; ROAS=revenue/spend*100. Missing/zero denominators yield null. Missing optional data suppresses the corresponding aggregate. Previous-period comparison requires date rows for both complete windows and is disabled for explicitly partial reports; completeness of every creative is not independently verified. Observations are deterministic, not AI-generated causal claims. Sample-selection thresholds are explicitly internal, not industry benchmarks.

## Privacy and storage

Report calculation is entirely client-side. No report file, credentials, tokens, or existing performance rows are sent to a server. Only the user-chosen account hint/date query is passed to ChatGPT when clicked. Persistence is explicit localStorage, scoped by activeBranchId. No autosave or automatic restore; saved reports are reviewed before applying. Report exports are JSON to avoid spreadsheet formula injection in untrusted names. Demo data is opt-in, conspicuously labeled and cannot be browser-saved. Deleting local reports never changes Daangn.

## Validation

Run: node --test tests/ads-analysis.test.cjs
53 parser/metric/privacy-contract regression tests. Strict TypeScript check of the pure helper passed locally. TSX and CSS parsed. Twenty local mocked-data layout fixtures checked empty/demo/paste/review at 320, 375, 390, 768 and 1440 px, without document overflow. Full Next.js typecheck/build must pass preview before production promotion. Real authenticated ad-account querying was not run; that requires user authorization.
