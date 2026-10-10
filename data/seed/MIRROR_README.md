# ForkLift Open Catalog Data Mirror

This repository is the public, open-source data mirror for **[ForkLift](https://forkvlift.com)** (`forkvlift.com`), the free social catalog of vibe-coded projects.

## What is in this repository?

- `projects/<slug>.json`: One JSON file per public project listed on ForkLift.
- `categories.json`: Complete category and subcategory taxonomy.
- `project.schema.json`: JSON schema definition for project records.

The catalog database on ForkLift exports nightly to this repository so anyone can inspect, fork, backup, or build third-party tools against the complete dataset.

## How to Submit a Project by Pull Request

You can list your project directly on ForkLift via GitHub Pull Request:

1. **Fork this repository** to your personal GitHub account.
2. **Create a new branch**:
   ```bash
   git checkout -b submit/my-project
   ```
3. **Add your project file** under `projects/<your-slug>.json`:
   - Use your project slug as the filename (e.g. `projects/linkhub.json`).
   - Check [`PROJECT_SCHEMA.md`](./PROJECT_SCHEMA.md) for required fields and formatting.
4. **Validate your submission locally**:
   ```bash
   node scripts/seed/validate-pr.mjs projects/my-project.json
   ```
5. **Open a Pull Request** against `main`:
   - CI will validate your JSON structure, scan your repository for safety (malware and secret leaks), and ingest it into the review queue.
   - Once reviewed, your card will go live on the ForkLift catalog and receive its live README badge!

## License

The metadata and curated project index in this repository are available under the [CC0 1.0 Universal Public Domain Dedication](https://creativecommons.org/publicdomain/zero/1.0/). Individual project repositories maintain their respective licenses as specified in their `licenseSpdx` fields.
