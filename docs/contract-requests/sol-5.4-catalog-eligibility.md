# Contract request: catalog eligibility for showcase owner action

- **From:** sol
- **For task:** 5.4
- **Status:** open

## What I need

An eligibility field on ShowcaseDetail for listing a public licensed repository in the catalog. The current contract has hasPublicCode and repoUrl but no repository license or eligibility result.

## Why

The requested owner button is conditioned on a public licensed repo. The UI can establish public code and ownership, but cannot establish licensing before submitting.

## Proposed shape

An optional `catalogEligibility` containing `eligible: boolean` and a user-facing reason, populated by the existing repository validation logic.

## Workaround until then

Show the action only to the maker of a published showcase with public code and a repo, explain the open-source-license requirement, and let listShowcaseInCatalog validate ownership and licensing. Surface server errors without changing the showcase. No local license inference or entity definitions.
