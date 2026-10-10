# Contract request: preserve resource script filenames

- **From:** sol
- **For task:** 3.9 follow-up
- **Status:** done (Opus). `createUpload` takes an optional `filename` for resources; the extension must match the type (scripts upload as `text/plain`). `createResource` keeps the name, scans attached text files and marks scripts as executable; downloads use the original name.

## What I need

Allow resource script uploads and preserve the original filename (validated, display-only) in the upload reservation and resource file metadata. Scan attached script content and use its original extension in `detectExecutable`.

## Why

The current upload handler accepts only application/zip, text/markdown and text/plain for resources. Keys normalize plain text to .txt, and createResource generates paths from key extensions. Uploading a .sh/.js/.py as text/plain would lose its script extension and fail to trigger the existing Runs code detection. The client cannot reliably restore it through the current fileKeys-only contract.

## Proposed shape

Optional validated filename on createUpload; keep fileKeys on createResource. The server reads the stored metadata, scans scripts, and marks executable attachments. Avoid trusting the client for executable classification.

## Workaround until then

The form accepts .zip, .md and .txt, matching existing upload support. Scripts must be packaged in ZIPs; ZIP paths already trigger the server's Runs code warning. No shared, Worker or Durable Object changes in this follow-up.
