---
type: starter_repo
title: Anthropic's example Agent Skills
summary: Anthropic's public repo of example skills and a skill template: folders of instructions and scripts an agent loads when a task calls for them.
license: See source
testedWith: [{"tool":"Claude Code","model":null,"version":null}]
---
[anthropics/skills](https://github.com/anthropics/skills) is Anthropic's collection of example Agent Skills. A skill is a folder with a `SKILL.md` file (instructions plus a short description) and any scripts or files it needs; the agent loads it only when a task matches the description.

## What's in it

- Example skills across creative, technical and business work.
- A `template` folder to start your own skill.
- The Agent Skills specification.

## Licensing

Most skills in the repo are open source under Apache 2.0. The document skills (docx, pdf, pptx, xlsx) are source-available for reference only, so check each skill's own license before copying it into something you publish.

## Starting your own

Copy the template, write a description that says exactly when the skill should be used, and keep the instructions to what a capable colleague would need on their first day.
