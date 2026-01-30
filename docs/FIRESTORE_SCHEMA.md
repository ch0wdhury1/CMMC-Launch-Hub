# Firestore Schema (MVP)

## users/{uid}
Required:
- uid: string
- email: string
- displayName?: string
- orgId: string
- roles:
  - superAdmin: boolean
  - orgRole?: "orgAdmin" | "member"
- status: "active" | "disabled"
- createdAt: timestamp
- updatedAt: timestamp

## orgs/{orgId}
Required:
- name: string
- tier: "SPONSORED" | "COMM_L1" | "COMM_L2"
- maxUsers: number (SPONSORED=1; paid tiers can be >1 or omit)
- ownerUid: string
- createdAt: timestamp
- updatedAt: timestamp
- billingCycle: string
- subscriptionStatus: string
- subscriptionStartDate: timestamp
- subscriptionEndDate: timestamp


## orgMembers/{orgId}/members/{uid}  (needed for multi-user tiers)
- uid: string
- role: "orgAdmin" | "member"
- status: "active" | "disabled"
- createdAt: timestamp

## system/activation
- defaultTier: "SPONSORED" | "COMM_L1" | "COMM_L2"
- flags: map<string, boolean> (optional)
Admin-only write.

## usageDaily/{orgId_YYYYMMDD}
- orgId: string
- date: "YYYY-MM-DD"
- counters: map<string, number>   # e.g. {"ai.guidance": 12, "pdf.readiness": 3}
- updatedAt: timestamp

## usageEvents/{eventId} (optional)
- orgId: string
- uid: string
- featureKey: string
- ts: timestamp
- meta?: map
