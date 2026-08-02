# VibeCollab

VibeCollab is a standalone team Vibe Coding collaboration control plane. It coordinates humans and any AI coding tool through repository-backed task contracts, deterministic context, modification intent, work sessions, Git isolation and evidence-based acceptance.

It does not live inside the products it observes. Each product repository keeps only portable `.project-to-act` facts; this service reads those repositories through an allowlisted registry.

## Run locally

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://127.0.0.1:3210`. Local development may run without an admin token. Production fails closed unless `VIBECOLLAB_ADMIN_TOKEN` is set.

Copy `vibecollab.config.json` to the ignored `vibecollab.config.local.json` and register one or more repositories:

```json
{
  "schemaVersion": 1,
  "projects": [{ "id": "my-app", "name": "My App", "root": "D:/code/my-app" }]
}
```

## Install the protocol into a repository

From this project:

```powershell
node skills/project-to-act-collaboration/scripts/pta.mjs init --project-root D:\code\my-app --github
```

The target receives the portable Skill, zero-dependency CLI, Task Contract templates and GitHub checks. It does not receive this dashboard application.

AI tools then receive the same short instruction:

> Read `AGENTS.md` and `.project-to-act/tasks/<ID>/`; validate context and intent; implement only the declared scope; run required checks; report evidence, risks and specification deviations.

## Repository layout

- `src/`: independent web control plane.
- `skills/project-to-act-collaboration/`: canonical, vendor-neutral Skill and installer.
- `plugins/project-to-act-collaboration/`: optional Codex adapter.
- `.project-to-act/`: VibeCollab's own development facts, not observed project data.
