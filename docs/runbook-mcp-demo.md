# Recording the MCP demo (slide 16)

About a minute, sped up: Claude Code, connected to cedo's MCP server, reads a week of an athlete's
training and says what to change. Read-only tools only, on a local instance with an invented
athlete. Never the live one, which holds real training data.

## 1. A local cedo with a week of invented training: open

**Nothing in cedo makes this today.** `bun run gallery` builds exactly the athlete the demo needs, a
plan mid-block with weeks of sessions behind it, but it seeds the test database through the e2e
harness (`apps/app/e2e/gallery.ts`, `seed()`), photographs every screen, and stops. The development
database that `bun run dev` serves stays empty. And MCP's `session_log` cannot date a session, so a
week of history cannot be logged through the product either.

What's needed is a small cedo change: a command that runs the gallery's `seed()` against the
development database, and prints the athlete's username and password. To be filed as a cedo issue
before the recording.

## 2. Connect Claude Code, read-only

With cedo running locally (`bun run db:up`, then `bun run dev`: the API on `localhost:3000`), sign
in as the demo athlete, and under Settings → Access tokens create a token named `demo`. It is shown
once. In a scratch directory, not the cedo checkout, so the agent has no code to read:

```bash
claude mcp add --transport http cedo-demo http://localhost:3000/mcp \
  --header "Authorization: Bearer <the token>"
```

Behind Caddy the path is `/api/mcp` (`docs/07-mcp.md`); the API itself serves `/mcp`. Check the
connection with `/mcp` inside Claude Code before recording.

Allow only the read tools: `training_review`, `session_list`, `session_get`, `workout_get`,
`exercise_history`. Deny anything else it asks for, so nothing is written.

## 3. Record

1. A terminal at a large font, close to 16:10, dark theme.
2. Start the screen recording (⇧⌘5, "Record Selected Portion").
3. Ask, in one prompt: *"Review my last week of training in cedo, and tell me the one change you
   would make to next week's plan, and why."*
4. Stop once it has answered.

## 4. Into the deck

Trim to the question and the answer, speed the tool calls up to about a minute, no sound, then:

```bash
ffmpeg -i recording.mov -vf "scale=1600:-2" -c:v libx264 -crf 26 -an assets/mcp-demo.mp4
bun run build
```

The build inlines the video into `index.html`. Keep it under 15 MB.

## Before the talk

- Watch it once in the built deck, at the projector's resolution.
- The talk says "read-only tools only": check that no write tool shows in the recording.
- Nothing personal on screen: no real names, no live domain, no token.
