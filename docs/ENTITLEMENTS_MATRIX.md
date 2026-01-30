# Entitlements Matrix (MVP)

Tiers:
- SPONSORED (single-user)
- COMM_L1 (multi-user)
- COMM_L2 (multi-user)

## Route/Page Gating
Allowed:
- Common: Dashboard, Profile, Org info, Upgrade page (read-only)
- L1: All L1 domains + assessment + evidence basics
- L2: L2 domains + assessment + evidence advanced (only COMM_L2)

## Sidebar Lock Rules (MVP)
- Show all sections
- Locked items show lock icon + tooltip “Upgrade required”
- Clicking locked item routes to /upgrade

## Feature Keys (suggested)
- nav.l1
- nav.l2
- feature.ai.basic
- feature.ai.advanced
- feature.export.readiness
- feature.export.ssp
- admin.panel

## Tier mapping
SPONSORED:
- nav.l1 ✅
- nav.l2 ❌
- feature.ai.basic ✅
- feature.export.readiness ✅
- admin.panel ❌
- maxUsers = 1

COMM_L1:
- nav.l1 ✅
- nav.l2 ❌
- feature.ai.basic ✅
- feature.export.readiness ✅
- feature.export.ssp ✅
- admin.panel ✅ (org admin only)
- maxUsers >1

COMM_L2:
- nav.l1 ✅
- nav.l2 ✅
- feature.ai.basic ✅
- feature.ai.advanced ✅ (optional MVP)
- feature.export.readiness ✅
- feature.export.ssp ✅
- admin.panel ✅ (org admin only)
- maxUsers >1

---------------------------

## Tier mapping (MODIFIED )
SPONSORED:
- nav.l1 ✅
- nav.l2 ❌
- feature.ai.basic ✅
- feature.export.readiness ✅
- admin.panel ❌
- maxUsers = 1
- Readiness Analyzer
- Starter Kits

COMM_L1:
- nav.l1 ✅
- nav.l2 ❌
- feature.ai.basic ✅
- feature.export.readiness ✅
- feature.export.ssp ✅
- admin.panel ✅ (org admin only)
- maxUsers >1

COMM_L2:
- nav.l1 ✅
- nav.l2 ✅
- feature.ai.basic ✅
- feature.ai.advanced ✅ (optional MVP)
- feature.export.readiness ✅
- feature.export.ssp ✅
- admin.panel ✅ (org admin only)
- maxUsers >1

---------------------------

----------------
SPONSORED:
----------------
- nav.l1 ✅
- nav.l2 ❌
Awareness & Training:
- Interactive Modules ✅
- Verified Updates ❌
System Tools:
- Readiness Analyzer ✅
- Shared Responsibility Matrix ❌ 
- Starter Kits ✅
- Template Assist (Smart Fill) ❌
Compliance Reporting
- Executive Narrative ❌
- Readiness Vault ❌
- SPRS Scorecard ✅
- System Security Plan (SSP) ❌
- POA&M ❌

----------------
COMM_L1:
----------------
- nav.l1 ✅
- nav.l2 ❌
Awareness & Training:
- Interactive Modules ✅
- Verified Updates ❌
System Tools:
- Readiness Analyzer ✅
- Shared Responsibility Matrix ❌ 
- Starter Kits ✅
- Template Assist (Smart Fill) ✅
Compliance Reporting
- Executive Narrative ❌
- Readiness Vault ❌
- SPRS Scorecard ✅
- System Security Plan (SSP) ✅
- POA&M ❌

----------------
COMM_L2:
----------------
- nav.l1 ✅
- nav.l2 ✅
Awareness & Training:
- Interactive Modules ✅
- Verified Updates ✅
System Tools:
- Readiness Analyzer ✅
- Shared Responsibility Matrix ✅ 
- Starter Kits ✅
- Template Assist (Smart Fill) ✅
Compliance Reporting
- Executive Narrative ✅
- Readiness Vault ✅
- SPRS Scorecard ✅
- System Security Plan (SSP) ✅
- POA&M ✅

