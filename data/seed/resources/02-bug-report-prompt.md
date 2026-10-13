---
type: prompt_template
title: Bug report prompt that gets a real fix
summary: Fill-in-the-blanks prompt for handing a bug to an AI agent so it reproduces the problem first instead of guessing at a fix.
license: CC0-1.0
testedWith: [{"tool":"Claude Code","model":null,"version":null},{"tool":"ChatGPT","model":null,"version":null}]
---
Agents fix the bug you describe, so describe the right one. Copy this, fill in the brackets, and paste it in.

```text
There's a bug in [app / feature].

What I did:
1. [step]
2. [step]

What I expected: [expected result]
What happened instead: [actual result, exact error text if any]

Where I think it lives (a guess, may be wrong): [file or area]

Please:
1. Reproduce it first, or tell me why you can't.
2. Explain the cause in one or two sentences before changing code.
3. Make the smallest change that fixes it.
4. Tell me how to check the fix myself.
Don't refactor or rename anything that isn't part of the fix.
```

## Why each part is there

- **Exact steps and error text** stop the agent from fixing a different, imagined bug.
- **"Reproduce first"** catches the case where the bug isn't where you think it is.
- **"Explain the cause"** gives you a chance to say "no, that's not it" before code changes.
- **"Smallest change"** keeps unrelated edits out of the diff, so you can review it.
