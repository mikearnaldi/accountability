# Ralph Loop Infrastructure

Ralph is a long-running AI coding agent orchestrator based on the "Ralph Wiggum" approach. It runs Claude Code in a loop to work through a PRD of user stories autonomously.

## Quick Start

```bash
# Run the automated loop (runs up to 10 iterations)
./ralph.sh

# Run with custom max iterations
./ralph.sh 20

# Run overnight with high iteration count
nohup ./ralph.sh 100 > ralph-output.log 2>&1 &
```

## Files

| File | Purpose |
|------|---------|
| `ralph.sh` | Main autonomous loop script |
| `prd.json` | JSON-based PRD with user stories and status |
| `progress.txt` | Progress log appended by each agent run |
| `RALPH_PROMPT.md` | Prompt template sent to the agent |
| `specs/ACCOUNTING_RESEARCH.md` | Detailed project specifications |

## Helper Scripts

| Script | Purpose |
|--------|---------|
| `scripts/prd-status.sh` | Show current PRD status and progress |
| `scripts/prd-update.sh` | Manually update a story's status |
| `scripts/ci-check.sh` | Run all CI checks (types, tests, lint) |

## How It Works

1. **Loop Start**: Script reads the PRD and selects highest priority story
2. **Status Update**: Script marks story as `in_progress`
3. **Prompt Building**: Injects current state into prompt template
4. **Agent Run**: Claude Code implements the story and signals `STORY_COMPLETE`
5. **CI Validation**: Script runs `pnpm typecheck` and `pnpm test`
6. **Atomic Commit**: Script commits all changes with deterministic message
7. **Progress Update**: Script updates PRD status and progress.txt
8. **Repeat**: Next iteration begins with fresh context

**Key Feature**: Each story = one atomic commit, making rollback trivial:
```bash
git revert <commit-hash>  # Rollback a single story
```

## PRD Structure

The PRD (`prd.json`) contains user stories with:

```json
{
  "id": "1.1.1",
  "phase": "Foundation",
  "epic": "Project Setup",
  "title": "Story title",
  "description": "What needs to be done",
  "acceptance_criteria": ["Criterion 1", "Criterion 2"],
  "priority": 1,
  "status": "pending",
  "estimated_complexity": "small"
}
```

**Status values:**
- `pending` - Not started
- `in_progress` - Currently being worked on
- `complete` - Done and verified
- `blocked` - Cannot proceed (document reason in progress.txt)

## Progress Log Format

The script automatically appends to `progress.txt` after each successful commit:

```
## Iteration N - YYYY-MM-DD HH:MM
**Story**: [Story ID] - [Story Title]
**Status**: complete
**Commit**: abc1234
---
```

Each entry includes the git commit hash for easy reference and rollback.

## Key Principles

1. **One Story = One Commit**: Each story produces exactly one atomic commit for easy rollback
2. **Script Controls Git**: Agent writes code, script handles all git operations
3. **CI Before Commit**: Script runs type checks and tests before every commit
4. **Deterministic Commits**: Commit messages follow a fixed format with story ID
5. **Fresh Context**: Each iteration starts clean to avoid context rot
6. **Easy Rollback**: `git revert <hash>` cleanly undoes any story

## Running Long Sessions

Ralph is designed for autonomous, long-running sessions:

```bash
# Run in background with logging
nohup ./ralph.sh 100 > ralph-output.log 2>&1 &

# Check if still running
ps aux | grep ralph

# Monitor progress
tail -f progress.txt
./scripts/prd-status.sh
```

## Customization

### Changing Max Iterations

```bash
./ralph.sh 50  # Run up to 50 iterations
```

### Modifying the Prompt

Edit `RALPH_PROMPT.md` to adjust agent instructions. Available placeholders:
- `{{ITERATION}}` - Current iteration number
- `{{MAX_ITERATIONS}}` - Maximum iterations
- `{{PRD_CONTENT}}` - Full PRD JSON
- `{{PROGRESS_CONTENT}}` - Progress log contents

### Adding Stories

Edit `prd.json` directly or use jq:

```bash
jq '.stories += [{"id": "X.Y.Z", "title": "New Story", ...}]' prd.json > tmp.json && mv tmp.json prd.json
```

## Monitoring Progress

```bash
# Show current status
./scripts/prd-status.sh

# Watch progress in real-time
tail -f progress.txt

# View iteration logs
ls -la .ralph/
cat .ralph/iteration_1_output.txt
```

## Rollback

Each story is a single atomic commit, making rollback simple:

```bash
# View Ralph commits
git log --oneline --grep="Ralph-Iteration"

# Rollback the last story
git revert HEAD

# Rollback a specific story by commit hash
git revert abc1234

# Rollback a specific story by story ID
git log --oneline --grep="Story: 1.2.3" | head -1 | cut -d' ' -f1 | xargs git revert

# Reset PRD status after rollback
./scripts/prd-update.sh 1.2.3 pending
```

## Troubleshooting

### Agent Gets Stuck

1. Check `.ralph/iteration_N_output.txt` for errors
2. Update the stuck story to `blocked` status with `./scripts/prd-update.sh <id> blocked`
3. Document the issue in progress.txt
4. Restart the loop

### Tests Failing

1. Run `./scripts/ci-check.sh` to see failures
2. The agent should have fixed issues before committing
3. If not, manually fix and commit, then restart

### Context Window Issues

The PRD-based approach scopes work to single stories. If still hitting limits:
1. Break large stories into smaller ones
2. Increase story priority for blocking items

## Output Directory

The `.ralph/` directory contains:
- `ralph.log` - Main loop log
- `iteration_N_prompt.md` - Prompt sent to agent
- `iteration_N_output.txt` - Agent's response

This directory is gitignored and can be safely deleted.
