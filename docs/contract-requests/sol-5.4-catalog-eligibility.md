# Contract request: catalog eligibility for showcase owner action

- **From:** sol
- **For task:** 5.4
- **Status:** resolved in UI using existing previewSubmission route

## What I need

An eligibility field on ShowcaseDetail for listing a public licensed repository in the catalog. The current contract has hasPublicCode and repoUrl but no repository license or eligibility result.

## Why

The requested owner button is conditioned on a public licensed repo. The UI can establish public code and ownership, but cannot establish licensing before submitting.

## Proposed shape

An optional `catalogEligibility` containing `eligible: boolean` and a user-facing reason, populated by the existing repository validation logic.

## Workaround until then

The existing previewSubmission route supplies license, ownedByViewer and alreadyListed. Sol now uses it for the owner action: the button appears only after licensing and ownership verification succeeds. Missing licenses and preview errors have clear states. No new contract field is needed for correctness. listShowcaseInCatalog still revalidates at submission.
