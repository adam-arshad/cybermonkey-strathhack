# CyberMonkey

A local, single-player cyber-awareness tower defence game for the StrathHack ScottishPower challenge. Phaser renders the map and animation; TypeScript owns the game rules and accessible HTML presents cards, questions and results. No backend, account, external fonts, online AI calls or new package dependencies are required at runtime.

## Run

Use Node.js 22.18 or later (Node 24 is recommended for the TypeScript tests).

```sh
npm install
npm run dev
```

Open the address Vite prints, normally http://127.0.0.1:8080. If that port is occupied, Vite selects another. The existing project dependencies are reused; Phaser is already installed. If npm blocks lifecycle scripts, review the named package before approving it.

```sh
npm run build       # TypeScript check, then production bundle in dist/
npm run preview     # Serve that production bundle locally
npm test            # Core rules and complete simulated playthrough
```

## Play

1. Buy control cards using the £3m budget. Include Prevent, Detect and Respond. “Use a balanced starter loadout” supplies a valid demonstration selection.
2. Lock your choice. Read each of four attack phases and match owned cards in the three sets of three revealed cards. “Collect all matches” is available.
3. A matched control with 1, 2 or 3 phase points grants a new tower of that level. Zero points grants no tower. Claim each match once. Cards stay owned; the same control can earn a new tower in another phase.
4. Select a tower and click an empty numbered pad, use the keyboard pad selector, or auto-place all remaining towers. All earned towers must be placed before starting a wave.
5. Defend a gentle rehearsal wave. Pause and 2× speed are available. Rehearsal waves cannot end the run; integrity stays at least 1%.
6. Answer one supplied behaviour question in 30 seconds. Facilitators can pause the timer. Correct answers grant 3 behaviour points, repair 10 rehearsal integrity (up to 100), and add 5 starting survival integrity. Wrong or timed-out answers grant no bonus. Every answer and timeout reveals the original explanation; use Continue to move on.
7. After phase four, integrity resets to 100 plus earned bonuses. All towers remain. Launch increasingly hard survival waves until the network fails, or finish at an intermission to bank the run.
8. Review survival waves cleared, the unchanged control score, behaviour points and combined learning score. Restart to compare another loadout. Best survival score is stored only in this browser.

## Rules and source of truth

`src/data/challenge.json`, `src/data/questions.json`, and `src/core/controls.mjs` are copied from the current challenge pack. The scoring module is unchanged. The older tabletop slides contain different control IDs and prices; this build uses the current challenge data.

All bought controls score in all four phases, including controls that do not appear in the matching reveal. The official control score is independent of combat. Each phase reveals the three highest-scoring controls in each category (ties retain the source order), making the nine-card board deterministic. This is a game-design choice, not an original rule from the pack.

Combat is an illustrative metaphor:

- Prevent towers fire focused pulses.
- Detect towers slow enemies and mark them for 30% extra damage.
- Respond towers hit nearby groups.

Tower level scales damage and range. Real control names, descriptions, limitations and question explanations are preserved. No claim is made that these combat roles simulate the capabilities of real security systems. The setting is a fictional business network.

## Code organisation

- `src/core/run.ts`: authoritative run state, budget choices, matching rewards, placement, phases and quiz scoring. Game/business names are set in `CONFIG` here.
- `src/core/controls.mjs`: supplied official control scoring engine.
- `src/core/combat.ts`: frame-rate-independent combat simulation and wave progression.
- `src/core/map.ts`: route geometry and numbered build pads shared by simulation and drawing.
- `src/main.ts`: HTML UI, event handlers, question timer and transitions.
- `src/game/scenes/Game.ts`: Phaser map rendering, range previews, towers, enemies and shot effects. It reads the core simulation.
- `src/style.css`: responsive UI and visible focus states.
- `tests/rules.test.ts`: meaningful budget, reward, placement, timeout and complete four-phase/survival tests.

The separation allows scoring and combat to be exercised without launching Phaser. All random-looking reveals are deterministic. The combat simulation advances in bounded steps, so faster display frame rates do not make towers stronger. Hidden tabs suspend gameplay and question timing.

## MVP limits

One map, one screen/player, three combat roles, fixed reveals and four selected questions. No multiplayer, tower sales, mid-run purchasing, drag-and-drop, sound, cloud saves or resume after refresh. Only the best survival record persists. Small screens are supported, but desktop is the intended play surface. The visual map can be operated via the equivalent HTML pad controls; screen-reader play of live combat is limited. The survival waves continue until defeat, with a manual launch between waves.

## Credits

Cyber content, scenario, question bank and official score engine: supplied ScottishPower StrathHack challenge pack. Base project: Phaser Studio Vite TypeScript template (MIT). The app uses Phaser and Vite under their supplied licences. Map, towers and interface are drawn in code; no external asset downloads are required. AI assisted implementation; team members should review the rules and code before presenting.
