# Admin Dashboard Spec (MVP)

## Access
- Only users with users/{uid}.roles.superAdmin == true

## Pages
### 1) Users List
Columns:
- email
- uid
- orgId (linked)
- org tier (derived from org)
- status
Actions:
- view/edit user

### 2) User Edit
Fields:
- orgId (dropdown)
- status (active/disabled)
- (No password field — use Firebase Auth password reset)

Buttons:
- Save

### 3) Org List
Columns:
- org name
- tier
- maxUsers
- member count
Actions:
- create org
- change tier
- view members

### 4) Org Edit
Fields:
- name
- tier
- maxUsers
- ownerUid
Buttons:
- Save

## Password reset
- Use Firebase Auth built-in reset email.
- Provide a “Send password reset email” action (admin can instruct user; optional admin trigger later).
