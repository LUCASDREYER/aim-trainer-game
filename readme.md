# 🎯 Aim Trainer

A browser-based FPS aim training game built with vanilla HTML, CSS, and JavaScript. No dependencies, no build step — just open and play.

## Demo

> Live: https://lucasdreyer.github.io/aim-trainer-game

## Features

- Randomly spawning targets with shrinking timer arcs
- Three difficulty modes: Easy, Medium, Hard
- Live HUD: Score, Accuracy, Streak, Avg Reaction Time
- End-of-round results screen
- Custom crosshair cursor
- Combo streak feedback
- Zero dependencies

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
├── index.html       # Game markup and canvas
├── style.css        # All styles
├── game.js          # Game logic (targets, scoring, input, rendering)
└── README.md
```

## Scoring

| Factor | Effect |
|---|---|
| Reaction time | Faster clicks = more points |
| Target size | Smaller targets give a multiplier |
| Difficulty | Hard mode gives 2x size bonus |

## Contributing

Pull requests are welcome! Some ideas for contributions:

- [ ] Sound effects on hit/miss
- [ ] Flick shot mode (targets move)
- [ ] Score leaderboard (localStorage)
- [ ] More target shapes
- [ ] Mobile touch support

## License

MIT
