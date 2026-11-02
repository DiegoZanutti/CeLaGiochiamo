# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Valid Document IDs**: All document IDs (`configId`, `playerId`, `uid`, `matchId`) must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.
2. **PII Protection (`/users/{uid}`)**: User documents store `email` (PII). Reading `/users/{uid}` is strictly restricted to the document owner (`request.auth.uid == uid`) or a verified Admin (`isAdmin()`).
3. **Self-Registration Integrity**: When a user creates their `/users/{uid}` profile, `incoming().uid == request.auth.uid`, and non-admin users cannot self-assign `is_admin == true` unless their verified email matches the bootstrapped admin (`diego.zanutti@gmail.com`).
4. **Strict Schema & Size Bounds**: Every collection enforces strict `hasAll` and `hasOnly` key checks on creation and bounded string/list lengths to prevent shadow fields and resource exhaustion.
5. **Verified Email Requirement**: Write operations require `request.auth != null && request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Payloads (Rejected with PERMISSION_DENIED)
1. **Unauthenticated Write to Config**: `auth: null`, writing to `/config/global_settings`.
2. **Shadow Field Injection on Player**: Adding `"isSuperAdmin": true` to `/players/player_marco`.
3. **ID Poisoning**: Creating `/players/invalid$id!with@spaces` or ID > 128 chars.
4. **PII Leak via User Get**: User `uid_bob` attempting `get(/users/uid_alice)` without admin privileges.
5. **Privilege Escalation on User Create**: User `uid_attacker` creating `/users/uid_attacker` with `is_admin: true` and `auth_status: "VALIDATED"`.
6. **Identity Spoofing on User Create**: User `uid_attacker` creating `/users/uid_victim` with `uid: "uid_victim"`.
7. **Unverified Email Write**: Authenticated user with `email_verified: false` attempting to update `/matches/match_1`.
8. **Oversized Name Payload**: Creating `/players/p1` with `name` of 5,000 characters.
9. **Oversized Convocati Array**: Updating `/matches/match_1` with `convocati_ids` containing 50 items (max allowed is 10).
10. **Invalid Match Status Enum**: Setting `status: "HACKED_STATE"` on `/matches/match_1`.
11. **Unauthorized Config Delete**: Non-admin attempting `delete(/config/global_settings)`.
12. **Terminal State Tampering**: Non-admin attempting to mutate an `ARCHIVED` match (`existing().status == 'ARCHIVED'`).
