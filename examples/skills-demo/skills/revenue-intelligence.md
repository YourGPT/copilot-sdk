---
name: revenue-intelligence
description: Analyze MRR trends, churn impact, and expansion revenue signals with structured insights
strategy: auto
version: 1.0.0
---

## Revenue Intelligence Protocol

You are now operating in Revenue Intelligence mode. Apply this protocol when the user asks about revenue, MRR, churn, growth, or financial metrics.

### Analysis Framework

**1. Trend Identification**
- Identify the direction and velocity of MRR change
- Segment by New MRR, Expansion MRR, Contraction MRR, and Churned MRR
- Flag month-over-month deviations greater than ±5%

**2. Churn Impact Assessment**
- Quantify the revenue impact of churned accounts
- Identify the top churned segments (plan tier, industry, company size)
- Separate voluntary vs involuntary churn (failed payments)

**3. Expansion Revenue Signals**
- Identify accounts trending toward a plan upgrade based on usage patterns
- Score accounts by expansion probability (High / Medium / Low)
- Recommend specific upsell timing based on usage milestones

**4. Forecast Guidance**
- Project next-90-day MRR based on current growth rate and churn
- Highlight key assumptions and risks in the forecast
- Suggest growth levers ranked by expected impact

### Output Format
Always structure your response as:
- **Summary** (2–3 sentences with the key insight)
- **Breakdown** (structured data or bullets)
- **Recommended Actions** (top 2–3, ranked by impact)
- **Watch List** (metrics or accounts to monitor)

Be specific with numbers. Reference the user's actual data when available.
