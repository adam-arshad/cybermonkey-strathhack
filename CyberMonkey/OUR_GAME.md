# Our game — draft hand-in note

## Team
- Team name: Team 18 (confirm before submission)
- Team members: **To fill in**
- Game: CyberMonkey
- Fictional business: Northstar Energy
- Both names: `CONFIG` in `src/core/run.ts`

## What we built
- Level: Extend — Foundation learning/scoring wrapped in a tower defence theme.
- Theme: Original cyber tower defence. **Discuss the theme with the organisers as requested in the brief.**
- Stretch capability: None claimed.

## How to run
Node.js 22.18+; `npm install`, then `npm run dev`. Open the localhost address printed in the terminal. `npm run build` checks TypeScript and produces the production bundle. `npm test` runs the rule tests.

## Working walkthrough
Use the balanced starter loadout, lock it, collect all matching cards, auto-place towers, and start the rehearsal wave. Answer the checkpoint and continue. Repeat for all four phases. Start survival, launch the next waves, then finish the run or allow the network to fall. Review the scores and restart with a different loadout.

## Design
`Run` keeps purchases, phases, towers and answers. The unchanged official scorer computes cyber control points. `Battle` simulates enemies and towers independently of Phaser. Phaser draws that state; HTML handles readable cards and keyboard controls. This makes the learning score independent of frame rate and wave balancing.

Card reveals are fixed per phase for comparable runs. Matches convert phase points into tower levels. A control that does not appear still earns its official score. Combat roles are a metaphor rather than a claim about real cyber defence.

## Questions
One original phase-related question per phase, a pausable 30-second timer, original answer and explanation. Correct answers add 3 behaviour points, repair 10 rehearsal integrity, and grant 5 starting survival integrity. Wrong and unanswered questions add nothing. The final learning total is official control points plus behaviour points; waves survived is shown separately.

## Tests
`npm test` covers budget/category/duplicate checks, unique reveals, rewards claimed once, invalid/occupied pads, complete four-phase progression, one-time question bonuses, timeouts, and survival escalation/defeat. The full-run test checks the official control total is preserved while the game advances into survival.

## Limits
See README. One map, local single-player, no runtime AI, no multiplayer or run persistence. Keyboard tower placement is included; live combat screen-reader narration is limited.

## AI use and credits
AI assisted code, UI, rules tests and this draft. **Team: record what you reviewed and changed yourselves before submitting.** Cyber content and scorer are from the supplied ScottishPower pack. Phaser/Vite template and libraries retain their original licences. Visuals are drawn in code.
