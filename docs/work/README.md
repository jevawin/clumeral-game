# docs/work

One brief and one plan per feature, named for the feature and committed on its
branch:

- `YYYY-MM-DD-<slug>-brief.md`
- `YYYY-MM-DD-<slug>-plan.md`

They merge with the PR, so the PR carries intent next to implementation and a
reviewer can check the code against what was agreed rather than against a guess.

They exist because the bot clears its context between Brief, Plan and Build. After
a clear these files are all it has: they are the memory, not the chat. Anything
agreed in Telegram and not written here is lost.
