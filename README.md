# Skilling

Minimal Godot 4 first-person prototype with a fishing-pole-in-hand start, set up for GitHub Pages deployment.

## What Is Set Up
- First-person movement + mouse look.
- Fishing pole visible in first person with sway + walk bob.
- Web-friendly defaults for responsive sizing.
- Stretch mode `canvas_items`.
- Stretch aspect `expand`.
- HiDPI disabled for lighter GPU load.
- Compatibility renderer as the default.
- `docs/` as deploy target for GitHub Pages.
- GitHub Actions workflow to publish `docs/` on every push to `main`.

## First-Time GitHub Pages Setup
1. Push this repo to GitHub.
2. In the repo, go to `Settings > Pages`.
3. Set `Build and deployment` source to `GitHub Actions`.
4. Push to `main` and the workflow in `.github/workflows/deploy-pages.yml` will publish `docs/`.

## Exporting Godot Web Build To `docs/`
Use one of:

```powershell
pwsh ./tools/export_web.ps1
```

```bash
bash ./tools/export_web.sh
```

Then commit/push updated `docs/` files.

## Open Locally
1. Open Godot 4 and import `project.godot`.
2. Run `scenes/main.tscn`.

## Controls
- `WASD`: Move
- `Space`: Jump
- `Mouse`: Look
- `Esc`: Toggle mouse capture
