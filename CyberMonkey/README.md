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
2. Lock your choice. Read the story popup before each of four attack phases. Drag cards from your purchased deck into the nine named boxes, or select a card and then its box using touch or the keyboard. Availability labels show which solutions you own. “View story” reopens the current briefing.
3. Columns award 3, 2 and 1 control points from left to right, plus a tower of the same level. Only correctly placed matches earn points. Incorrect placements return the card without penalty. Matched cards disappear until the next phase; all owned matches must be placed before continuing. A phase with no owned matches allows immediate continuation to questions.
4. After matching, a question popup presents five questions relevant to the current phase. Questions are selected from the supplied 40-question bank: four directly linked questions where available, then related general questions. The order and A–D answer positions change each run, and a question never repeats during one run. Each question has 30 seconds; the timer can be paused. After each answer or timeout, review the original explanation and choose “Next question”. Correct answers grant 50 points, repair 10 rehearsal integrity (up to 100), and add 5 starting survival integrity. Wrong or timed-out answers grant no bonus.
5. Once all five questions are complete, select a tower and click an empty numbered pad, use the keyboard pad selector, or auto-place all remaining towers. All earned towers must be placed before starting the wave. Towers start with 2 HP per match point: 2, 4 or 6 HP.
6. Defend a gentle rehearsal wave; pause and 2× speed are available. Enemies shoot at nearby towers, and tower damage carries forward. Destroyed towers stop attacking; their earned match points remain. Rehearsal waves cannot end the run; integrity stays at least 1%. Completing a wave opens the next phase’s story.
7. After phase four, integrity resets to 100 plus earned bonuses. Surviving towers remain, and increasingly hard survival waves start automatically until the network fails. Each cleared wave earns 100 points.
8. On defeat, review the final total: matched control points plus correct-answer points plus survival-wave points. Restart to compare another loadout. Best survival record is stored only in this browser.

## Rules and source of truth

`src/data/challenge.json` supplies the 22 purchasable controls, costs and descriptions. `src/data/questions.json` supplies behaviour questions. The unchanged `src/core/controls.mjs` validates purchases; its original score calculations are retained as reference data, not used for gameplay rewards.

`src/core/matching.ts` defines the active 3/2/1 boards. Phases 1–3 follow slides 5, 6 and 8 of `Defend Your Network - game and scenario.pptx`. Phase 4 is a custom board agreed for this game:

| Category | 3 points | 2 points | 1 point |
| --- | --- | --- | --- |
| Prevent | P9 EDR | P2 Network segmentation | P5 Secure by design |
| Detect | D6 EDR | D1 SIEM | D2 Intrusion detection and prevention |
| Respond | R4 Backup restores | R1 Incident response plan | R2 Response team 24/7 |

Match points are awarded only after a correct placement, once per card per phase. Other purchases score zero. This intentionally changes gameplay scoring from the original automatic purchase totals. Correct answers add 50 points each, and cleared survival waves add 100 points each. The combined total is shown only when the run ends. The story popups use the scenario deck’s four-phase attack narrative.

Combat is an illustrative metaphor:

- Prevent towers fire focused pulses.
- Detect towers slow enemies and mark them for 30% extra damage.
- Respond towers hit nearby groups.

Tower level scales damage, range and HP (2 per level). Enemies attack nearby towers for 1 HP per shot. Real control names, descriptions, limitations and question explanations are preserved. No claim is made that these combat roles simulate the capabilities of real security systems. The setting is a fictional business network.

## Code organisation

- `src/core/run.ts`: authoritative run state, budget choices, matching rewards, placement, phases and quiz scoring. Game/business names are set in `CONFIG` here.
- `src/core/controls.mjs`: supplied control scoring engine, used here for purchase validation.
- `src/core/matching.ts`: ranked boards, 3/2/1 matching rewards and phase stories.
- `src/core/questions.ts`: random question selection by supplied phase relevance and answer shuffling.
- `tests/questions.test.ts`: phase relevance, selection variety and all 24 answer permutations.
- `src/core/combat.ts`: frame-rate-independent combat simulation and wave progression.
- `src/core/map.ts`: route geometry and numbered build pads shared by simulation and drawing.
- `src/main.ts`: HTML UI, event handlers, question timer and transitions.
- `src/game/scenes/Game.ts`: Phaser map rendering, range previews, towers, enemies and shot effects. It reads the core simulation.
- `src/style.css`: responsive UI and visible focus states.
- `tests/rules.test.ts`: meaningful budget, reward, placement, timeout and complete four-phase/survival tests.

The separation allows scoring and combat to be exercised without launching Phaser. All random-looking reveals are deterministic. The combat simulation advances in bounded steps, so faster display frame rates do not make towers stronger. Hidden tabs suspend gameplay and question timing.

## MVP limits

One map, one screen/player, three combat roles, fixed reveals and four checkpoints of five questions, selected from the supplied bank without repeats. No multiplayer, tower sales, mid-run purchasing, sound, cloud saves or resume after refresh. Only the best survival record persists. Small screens use a deck above the board with tap-to-place controls; desktop supports dragging and keyboard selection. The visual map can be operated via the equivalent HTML pad controls; screen-reader play of live combat is limited. Survival waves continue automatically until defeat.

## Credits

Cyber content, scenario, question bank and official score engine: supplied ScottishPower StrathHack challenge pack. Base project: Phaser Studio Vite TypeScript template (MIT). The app uses Phaser and Vite under their supplied licences. Map, towers and interface are drawn in code; no external asset downloads are required. AI assisted implementation; team members should review the rules and code before presenting.
