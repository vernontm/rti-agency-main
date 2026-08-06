# RTI Agency

Client project for RTI Agency (contact: Shreda Powell). This repo, rti-agency-main, is THE live RTI codebase, deployed at rti-agency-main.vercel.app. The sibling repos rti-latest and rti-agency are stale earlier iterations: never work in them, never take code from them without checking it against this repo first.

## Hard rules

1. No client credentials, customer data, or secrets in code, commits, or PR bodies.
2. No em dashes anywhere: code comments, commits, PR bodies, UI copy.
3. Client work ships via claude/* branch PRs for Ray's review unless Ray explicitly says push to main.

## How sessions must finish

Any session that changes code in this repo finishes the job itself before ending:
1. Commit all work on a claude/* branch.
2. Push the branch explicitly (git push -u origin claude/<slug>).
3. Create the PR yourself with gh pr create and put the PR URL in your final reply.

Never end by pointing at a GitHub compare page or telling Ray to click a Create PR button. If you made no changes, say "no changes, nothing to ship" explicitly instead of offering a PR.
