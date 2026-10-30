# Repository working agreement

- Read README.md, CONTRIBUTING.md and docs/ROADMAP.md before substantial work.
- Keep completed changes in small, coherent commits; do not combine unrelated engine, UI, deployment and documentation work.
- When the user's commit/push authorization applies, push each completed, validated increment. Do not force-push or rewrite published history.
- Never commit future work as if it were implemented. Update the roadmap and distinguish passed checks from blocked or unrun checks.
- Preserve the user's running game and server. Use an isolated test process/port when needed.
- The CI file in docs/ci.yml.template is inactive because the current OAuth session lacks workflow scope. Do not claim CI passes or silently change credentials.
