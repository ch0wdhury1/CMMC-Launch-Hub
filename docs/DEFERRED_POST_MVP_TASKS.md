# Deferred Post-MVP Tasks
CMMC Launch Hub

This document tracks intentionally deferred technical tasks that were
postponed to preserve momentum and stabilize the MVP.

These items MUST be revisited before public launch or scale-up.

---

## Deferred Task #1: Remove Temporary Debug Logging

### Status
⏸ Deferred (intentional)

### Description
During MVP stabilization, multiple temporary `console.log()` statements were
added across App.tsx, Sidebar.tsx, DomainView.tsx, and related components to
debug L1/L2 routing, entitlement resolution, and navigation state.

These logs are useful for development but should not ship long-term.

### Deferred Reason
- MVP stabilization was the priority
- Removing logs prematurely risks re-introducing navigation regressions
- Logs currently help validate production behavior

### Future Action
- Search for `console.log(` across repo
- Remove only temporary debug logs (retain intentional audit logs if any)
- Commit with message:


-------------------

Chore: remove temporary debug logging

- Redeploy Firebase Hosting

---

## Deferred Task #2: Add Environment-Controlled DEBUG Flag

### Status
⏸ Deferred (intentional)

### Description
Introduce an environment-based debug toggle so logging can be enabled or disabled
without modifying code.

### Planned Implementation
- Use Vite env flag:
```ts
const DEBUG = import.meta.env.VITE_DEBUG === "1";
if (DEBUG) console.log(...)

Add .env.local: VITE_DEBUG=1

VITE_DEBUG=1

--------------------


Deferred Reason:
Not required for MVP functionality
Logging currently acceptable during controlled rollout
Will be valuable during scale and support phase

Future Action:
Wrap existing debug logs with DEBUG guard
Remove raw console.log calls
Commit with message: Chore: add environment-controlled debug logging

Notes:
These tasks are intentionally deferred.
They are not forgotten.
They should be addressed before:
- public launch
- onboarding multiple customers
- adding audit / compliance reporting


--------------------





