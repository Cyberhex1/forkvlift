---
type: workflow
title: Plan, build, verify loop for AI coding sessions
summary: A five-step loop that keeps an AI coding agent on track: write the plan down, build one slice, run it, check the diff, then commit before the next slice.
license: CC0-1.0
testedWith: [{"tool":"Claude Code","model":null,"version":null},{"tool":"Cursor","model":null,"version":null}]
---
Most vibe-coding sessions go wrong the same way: the agent changes too much at once, nobody runs the result, and three prompts later nothing works and nobody knows why. This loop keeps each step small enough to undo.

## The loop

1. **Plan in writing.** Ask the agent for a short plan before it touches code: which files change, what you will see when it works. Fix the plan, not the code, if it's wrong.
2. **Build one slice.** "Do step 1 only." One screen, one endpoint, one fix.
3. **Run it yourself.** Open the page, click the button, run the tests. Don't take "done" on faith.
4. **Read the diff.** Skim what changed. Anything you didn't ask for is a question for the agent, not a bonus.
5. **Commit.** A commit per working slice means a bad next step costs you one `git restore`, not an afternoon.

Then go back to step 2 with the next slice.

## Prompts that help

- "Before writing code, list the files you'll change and how I'll know it works."
- "Only do step 2. Stop and tell me how to check it."
- "Explain every change in this diff I didn't ask for."

## When to break the loop

If the same slice fails twice, stop prompting. Start a fresh session with the error, the file, and what you expected, so the agent isn't anchored on its own earlier guesses.
