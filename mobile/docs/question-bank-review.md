# Professional question bank

The twelve Arabic questions are stored in backend/prisma/data/mechanic-questions.v3.ar.json.
They are original MOTEXA scenarios based on the cited technical principles, not questions certified by the cited publishers. They remain drafts until human technical review.

From backend, run: node --import tsx scripts/seed-mechanic-question-drafts.ts
The importer uses stable unique codes and skips existing records; rerunning it never overwrites edits or approvals.

Mechanics administrators and super administrators can create/edit drafts, record a technical review, approve or disable a question. Approval requires an explanation, HTTPS source, section reference, reviewer name, notes and explicit confirmation. The logged-in administrator and review date are recorded; the reviewer name is a recorded attestation, not independently verified identity.

Every content edit resets approval. Only active APPROVED questions matching the mechanic's specialty (or SAFETY) can be assigned. Exactly two questions are sent. Existing tests preserve immutable question/answer snapshots. The mechanic never receives answer keys. Test results support the administrator's manual final decision.

The additive migration preserves prior tests and marks legacy bank questions as drafts pending review. No authentication, invitation, SMTP or password-reset settings are changed.
