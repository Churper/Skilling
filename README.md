# Skilling

Three.js web prototype deployed via GitHub Pages.

## Current Stack
- Three.js (module import map from jsDelivr)
- OrbitControls with isometric-style camera freedom
- Click/tap-to-move + camera-relative WASD
- Stylized water shader and low-poly environment
- `docs/` as static Pages target

## Controls
- Left click/tap terrain: Move
- `WASD` / arrow keys: Move (camera-relative)
- Middle mouse hold: Pan camera
- Right mouse hold: Rotate camera
- Mouse wheel: Zoom
- Mobile: One-finger pan, two-finger rotate/zoom

## GitHub Pages
1. Keep source in `docs/`.
2. Push to `main`.
3. Workflow at `.github/workflows/deploy-pages.yml` publishes the site.

## Local Dev
Serve `docs/` with any static server.

Example:
```powershell
cd docs
python -m http.server 8080
```
Then open `http://localhost:8080`.