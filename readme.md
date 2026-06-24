# 🎯 FPS Aim Trainer

A browser-based **first-person** aim training game. Unlike a flat "click the
circle" trainer, the mouse drives a pointer-locked first-person camera and every
shot is a ray cast from the center crosshair into a 3D room — the same input
model as real FPS games (CS, Valorant, Apex, Aim Lab / Kovaak's).

Built with HTML, CSS, and JavaScript on top of [Three.js](https://threejs.org/)
(loaded from a CDN — no build step).

## Demo

> Live: https://lucasdreyer.github.io/aim-trainer-game

## How it plays

- Click **Play** — the browser asks for pointer lock, then your mouse controls
  the camera (look around) instead of an OS cursor.
- The crosshair is fixed at screen center; **left-click to shoot** a ray.
- Press **Esc** to release the mouse; click again to resume.

## Features

- True first-person 3D scene with a room for depth/orientation cues
- Pointer-lock mouse look with **adjustable sensitivity**
- Raycast hit detection from the center crosshair
- Three scenarios: **Gridshot**, **Flick**, and **Tracking** (moving targets)
- Three difficulty modes: Easy, Medium, Hard
- Live HUD: Score, Accuracy, Streak, Avg Reaction Time
- FPS-style hitmarker, miss flash, and combo streak feedback
- End-of-round results screen

## Getting Started

### Play locally

```bash
git clone https://github.com/LUCASDREYER/aim-trainer-game.git
cd aim-trainer-game
# Open index.html in your browser
open index.html
```

Or just drag `index.html` into any browser — no server needed.

### Deploy to GitHub Pages

1. Push the repo to GitHub
2. Go to **Settings → Pages**
3. Set source to `main` branch, `/ (root)`
4. Your game will be live at `https://lucasdreyer.github.io/aim-trainer-game`

## Project Structure

```
aim-trainer/
├── index.html       # Markup, crosshair/HUD, Three.js CDN include
├── style.css        # All styles
├── game.js          # 3D scene, pointer-lock look, raycast shooting, scoring
└── README.md
```

## Scoring

| Factor | Effect |
|---|---|
| Reaction time | Faster hits = more points |
| Difficulty | Medium = 1.5×, Hard = 2× multiplier |

## Contributing

Pull requests are welcome! Some ideas for contributions:

- [ ] Sound effects on hit/miss
- [ ] Recoil / spread patterns
- [ ] Score leaderboard (localStorage)
- [ ] WASD strafe movement
- [ ] Per-scenario stat tracking

## License

MIT
