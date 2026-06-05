# L2 Domain Title Bug Diagnosis

## 1. Root Cause

The CMMC Level 2 domain navigation uses a synthetic internal route token such as `__L2__:AC` as the selected domain state value. That token is correct as an internal disambiguation key, but `App.tsx` renders the raw state value directly in the main page title and breadcrumb.

The intended display resolver already exists as `getDomainDisplayLabel(domainKey)`, but it is not used in the `pageTitle` domain branch or the domain breadcrumb branch.

There is also a related active-state mismatch: `activeViewInfo` returns `{ type: "domain", label: ... }`, while `Sidebar.isActive("domain", ...)` checks `(activeViewInfo as any).domainName`. That can prevent the active L2 sidebar item from being selected reliably.

## 2. Data Flow From Sidebar Click To Page Title

1. `components/Sidebar.tsx` loads `public/cmmc_l2_prepop.json` independently for the Level 2 sidebar menu.
2. The L2 menu normalizes each raw JSON domain into `{ id, name }`, where:
   - `id` is `domain_id`, for example `AC`.
   - `name` is the display label, for example `Access Control (AC)`.
3. When a Level 2 domain is clicked, `Sidebar.handleL2DomainClick(domainId)` creates:
   - `const token = \`__L2__:${domainId}\`;`
4. `Sidebar` calls `onNavClick(token)`.
5. `App.handleNavClick(domainName)` receives `__L2__:AC`.
6. `App.handleNavClick` detects `domainName.startsWith("__L2__:")`.
7. If Level 2 access is allowed, it stores the token directly:
   - `setView({ type: "domain", domainName })`
8. `App.pageTitle` renders domain views with:
   - `if (view.type === "domain") return view.domainName;`
9. The top-level heading renders `{pageTitle}`, so the heading becomes `__L2__:AC`.
10. `Breadcrumbs` renders domain views with:
    - `<span>{view.domainName}</span>`
11. The breadcrumb also becomes `__L2__:AC`.

## 3. Difference Between L1 And L2 Domain Identifiers

Level 1 navigation uses the domain display name as the navigation key:

- L1 JSON fields:
  - `domain_id`: `AC`
  - `domain_name`: `Access Control (AC)`
- `hooks/useCmmcData.ts` canonicalizes domain names into values such as `Access Control (AC)`.
- `Sidebar` renders L1 domains from `domains`.
- L1 click handler calls `onNavClick(d.name)`.
- `App` stores `view.domainName = "Access Control (AC)"`.
- Rendering `view.domainName` works because the stored value is already display-safe.

Level 2 navigation uses a synthetic internal token:

- L2 JSON fields:
  - `domain_id`: `AC`
  - `domain_name`: `Access Control (AC)`
- `Sidebar` creates a token from the id: `__L2__:AC`.
- `App` stores `view.domainName = "__L2__:AC"`.
- Rendering `view.domainName` leaks the internal token.

## 4. Where `__L2__:AC` Is Introduced

The prefix is introduced in `components/Sidebar.tsx`:

- `handleL2DomainClick(domainId)`
- `const token = \`__L2__:${domainId}\`;`
- `onNavClick(token)`

The same token is also used as the L2 sidebar item key and active-state comparison value:

- `const token = \`__L2__:${d.id}\`;`
- `className={navClass(isActive("domain", token))}`

This token is useful for distinguishing an L2 domain click from an L1 domain click, especially because L1 and L2 share domain ids and display names such as `Access Control (AC)`.

## 5. Where It Is Incorrectly Rendered

The raw token is rendered in `App.tsx`:

- Main page title:
  - `if (view.type === "domain") return view.domainName;`
  - `<h1 ...>{pageTitle}</h1>`
- Domain breadcrumb:
  - `<span>{view.domainName}</span>`

There is also a likely L2 practice breadcrumb issue:

- The practice breadcrumb resolves its back-link and label using `practiceMap`, which is the L1/static merged practice map, even when the selected practice is L2:
  - It correctly chooses `practice` from `l2PracticeMap` or `practiceMap`.
  - But the rendered breadcrumb label still calls `practiceMap.get(view.practiceId)?.domainName`.
  - For L2 practice ids, `practiceMap.get(view.practiceId)` may not return the intended L2 object, which can produce a missing or stale breadcrumb label.

## 6. Recommended Fix

Use display names for rendering while keeping the internal token for routing.

Recommended minimal changes:

1. Update `pageTitle` for domain views:
   - from `return view.domainName`
   - to `return getDomainDisplayLabel(view.domainName)`

2. Update the domain breadcrumb:
   - from `<span>{view.domainName}</span>`
   - to `<span>{getDomainDisplayLabel(view.domainName)}</span>`

3. Fix `activeViewInfo` for domain views so it includes both the internal key and display label:
   - `{ type: "domain", domainName: view.domainName, label: getDomainDisplayLabel(view.domainName) }`

4. Adjust the `ActiveViewInfo` type to allow `label` on domain views if needed.

5. For practice breadcrumbs, use the already-resolved `practice` variable for both navigation and label:
   - `if (practice) setView({ type: "domain", domainName: practice.domainName })`
   - Display `practice?.domainName`

6. If L2 practice `domainName` remains plain `Access Control (AC)`, confirm that returning to the domain page still opens the intended L2 view. If not, store an L2 domain token on L2 practice objects or derive it from `practice.domainId`.

## 7. Risk Assessment

Risk is low if the fix is limited to display-name resolution for `pageTitle`, breadcrumb text, and active-state metadata.

Primary risks:

- Returning from an L2 practice to a domain may fall back to the L1 domain if only the display name is stored.
- Changing the stored `view.domainName` shape could affect `DomainView` routing, L1 navigation, and sidebar active state.
- The app currently has two L2 data paths:
  - `hooks/useCmmcData.ts` merges L1 and L2 into canonical domain names.
  - `App.tsx` separately fetches `cmmc_l2_prepop.json` for L2-specific domain rendering.

Safest approach:

- Preserve the existing `__L2__:` token in state.
- Resolve display labels only at render boundaries.
- Update sidebar active-state metadata without changing click behavior.

## 8. Files That Need Changes

Required:

- `App.tsx`
  - `ActiveViewInfo` domain type.
  - `activeViewInfo` domain branch.
  - `pageTitle` domain branch.
  - `Breadcrumbs` domain branch.
  - Possibly practice breadcrumb rendering for L2 practice labels.

Likely test coverage:

- `tests/e2e/helpers/navigation.ts`
  - Add or adjust a helper for Level 2 domain navigation.
- New or existing Playwright spec:
  - Verify clicking CMMC Level 2 > Access Control renders `Access Control (AC)` in the main heading.
  - Verify breadcrumb renders `Access Control (AC)`.
  - Verify the raw `__L2__:AC` token is not visible in the page.

No changes are recommended in:

- `public/cmmc_l1_prepop.json`
- `public/cmmc_l2_prepop.json`
- Firestore rules
- Storage rules
- Assessment scoring logic
- Tier enforcement logic
