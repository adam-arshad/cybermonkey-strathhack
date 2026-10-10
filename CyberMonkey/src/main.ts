import "./style.css";
import scenarioJson from "./data/challenge.json";
import questionJson from "./data/questions.json";
import { Run, CONFIG, CATEGORIES, STARTER } from "./core/run";
import { PADS } from "./core/map";
import { waveSpec } from "./core/combat";
import type { Battle } from "./core/combat";
import type { Category, Scenario, Question, Control } from "./core/types";
import { startGame } from "./game/main";
import type { Bridge } from "./game/scenes/Game";

document.title = `${CONFIG.gameName} — Network Defence Lab`;
const data = scenarioJson as Scenario;
const questions = questionJson.questions as Question[];
const questionIds = ["Q01", "Q09", "Q12", "Q30"];
let run = new Run(data),
  filter = "All",
  selected: string | null = null,
  viewingLoadout = false,
  detailOpenId: string | null = null;
let renderer: ReturnType<typeof startGame> | null = null;
let questionKey = "",
  questionSeconds = 30,
  questionPaused = false,
  lastClock = performance.now();
let toastTimer: ReturnType<typeof setTimeout>;
const money = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const control = (id: string) => data.controls.find((c) => c.id === id)!;
const qNow = () => questions.find((q) => q.id === questionIds[run.phase])!;
const symbols: Record<Category, string> = {
  Prevent: "△",
  Detect: "◎",
  Respond: "✚",
};
const categoryClass = (c: Category) => c.toLowerCase();
const mark = (c: Category) =>
  `<span class="category-icon ${categoryClass(c)}" aria-hidden="true">${symbols[c]}</span>`;
const stars = (n: number) => "★".repeat(n);
let best = 0;
try {
  best = Number(localStorage.getItem("cybermonkey-best")) || 0;
} catch {
  /* Private browsing may disable storage. */
}
const bridge: Bridge = {
  run,
  selected,
  paused: false,
  speed: 1,
  onPad: placeSelected,
  onTick: updateBattle,
  onEnd: (b) => {
    run.finishBattle(b.health, b.kills, b.leaks);
    bridge.paused = false;
    render();
  },
};

$("app").innerHTML = `
<header class="topbar"><a class="brand" href="./" aria-label="${CONFIG.gameName} home"><span class="monkey" aria-hidden="true">◉</span><span>${CONFIG.gameName.toUpperCase()}<small>NETWORK DEFENCE LAB</small></span></a><div class="top-meta"><span class="online-dot"></span> LOCAL TRAINING SIMULATION <span class="separator">/</span> <button class="text-button" id="restart">New run ↗</button></div></header>
<main>
 <div class="mission-title"><div><p class="eyebrow" id="eyebrow">01 / BUILD YOUR LOADOUT</p><h1 id="heading" tabindex="-1">Good defence starts with a decision.</h1><p id="subtitle">Protect ${CONFIG.businessName}. Choose your controls, earn your towers, and outlast the attack.</p></div><div class="session-number"><span>SCENARIO</span><strong>04<span> phases</span></strong><small>ONE NETWORK. YOUR CALL.</small></div></div>
 <nav class="timeline" aria-label="Game progress" id="timeline"></nav>
 <section id="shop-view" class="shop-layout"><div><div class="section-header"><div><p class="eyebrow">CONTROL LIBRARY</p><h2>Your first line of defence</h2></div><span class="muted">${data.controls.length} controls available</span></div><div class="filters" role="group" aria-label="Filter controls" id="filters"></div><div class="catalog" id="catalog"></div></div><aside id="shop-sidebar" class="side-panel" aria-label="Your loadout"></aside></section>
 <section id="game-view" hidden><div class="game-layout"><div class="map-column"><div class="map-toolbar"><span class="map-label"><span class="online-dot"></span> ${CONFIG.businessName.toUpperCase()} / SECTOR 07</span><div class="map-controls"><button id="pause" class="mini-button">Pause</button><button id="speed" class="mini-button" aria-label="Change battle speed">1× speed</button></div></div><div class="map-frame"><div id="game-container"></div><div id="overlay"></div><div id="placement-hint" class="placement-hint" hidden>Select a tower, then click a numbered pad.</div></div><div class="map-footer"><span><i class="legend-dot prevent"></i> Prevent · direct</span><span><i class="legend-dot detect"></i> Detect · slow + mark</span><span><i class="legend-dot respond"></i> Respond · area</span><span class="map-note">Combat illustrates resilience; it is not a real security simulation.</span></div></div><aside class="side-panel game-sidebar" id="game-sidebar" aria-label="Mission controls"></aside></div></section>
 <footer class="page-footer"><span>${CONFIG.gameName} <span class="muted">/ StrathHack MVP</span></span><span>Built for better cyber decisions.</span><span>Best survival: <b id="best-wave">${best}</b> waves</span></footer>
</main><div class="toast" id="toast" role="status" hidden></div>
<dialog id="restart-dialog"><p class="eyebrow">START AGAIN</p><h2>Build a different defence?</h2><p>This run will be cleared. Your best survival record stays saved on this browser.</p><div class="button-row"><button class="secondary" id="cancel-restart">Keep playing</button><button class="primary" id="confirm-restart">Start new run</button></div></dialog>
<dialog id="tutorial-dialog" class="tutorial-dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-intro">
  <div class="tutorial-header"><div><p class="eyebrow">QUICK START / NETWORK DEFENCE LAB</p><h2 id="tutorial-title">Protect the network. Make the right calls.</h2><p id="tutorial-intro">Build a balanced defence for Northstar Energy, then adapt it as the attack unfolds.</p></div><button type="button" class="dialog-close" id="close-tutorial" aria-label="Close tutorial">×</button></div>
  <div class="tutorial-grid">
    <section class="tutorial-step"><span class="tutorial-number">01</span><div><h3>Build your loadout</h3><p>Buy control cards with your £3m budget. Include at least one <b class="tutorial-category prevent">Prevent</b>, <b class="tutorial-category detect">Detect</b> and <b class="tutorial-category respond">Respond</b> card.</p></div></section>
    <section class="tutorial-step"><span class="tutorial-number">02</span><div><h3>Match controls to threats</h3><p>Lock your loadout, review the three revealed cards in each of four attack phases, and collect your matching cards to earn towers.</p></div></section>
    <section class="tutorial-step"><span class="tutorial-number">03</span><div><h3>Place your towers</h3><p>Select each earned tower and place it on a numbered pad near the route. All towers must be placed before you start a wave.</p></div></section>
    <section class="tutorial-step"><span class="tutorial-number">04</span><div><h3>Defend the network</h3><p><b class="tutorial-category prevent">Prevent</b> deals direct damage, <b class="tutorial-category detect">Detect</b> slows and marks enemies, and <b class="tutorial-category respond">Respond</b> hits groups.</p></div></section>
    <section class="tutorial-step"><span class="tutorial-number">05</span><div><h3>Answer behaviour questions</h3><p>After each rehearsal wave, answer one question before the timer runs out. Correct answers improve your behaviour score and integrity.</p></div></section>
    <section class="tutorial-step"><span class="tutorial-number">06</span><div><h3>Survive the attack</h3><p>Use pause and speed controls when needed. Complete all four phases, then launch survival waves and keep network integrity above zero.</p></div></section>
  </div>
  <div class="tutorial-footer"><p class="fine-print">Your final score combines control decisions, behaviour points and survival waves cleared.</p><button type="button" class="primary" id="start-tutorial">Got it — start playing →</button></div>
</dialog>`;

function notify(message: string) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 3500);
}
function attempt(action: () => void) {
  try {
    action();
    render();
  } catch (error) {
    notify(error instanceof Error ? error.message : "Something went wrong.");
  }
}
function ownedBadges() {
  return CATEGORIES.map(
    (c) =>
      `<span class="check-category ${run.chosen.some((id) => control(id).category === c) ? "satisfied" : ""}">${run.chosen.some((id) => control(id).category === c) ? "✓" : "○"} ${c}</span>`,
  ).join("");
}
function renderShop(readOnly = false) {
  $("filters").innerHTML = ["All", ...CATEGORIES]
    .map(
      (c) =>
        `<button id="filter-${c}" data-filter="${c}" class="filter ${filter === c ? "active" : ""}" aria-pressed="${filter === c}">${c === "All" ? "All controls" : c}</button>`,
    )
    .join("");
  $("catalog").innerHTML = data.controls
    .filter((c) => filter === "All" || c.category === filter)
    .map((c: Control) => {
      const owned = run.chosen.includes(c.id),
        over = !owned && c.cost > data.budget - run.spent,
        expanded = detailOpenId === c.id;
      return `<article class="control-card ${categoryClass(c.category)} ${owned ? "selected" : ""} ${expanded ? "expanded" : ""}"><div class="card-top">${mark(c.category)}<span class="card-code">${c.id}</span><button class="card-detail-toggle" data-detail="${c.id}" aria-label="${expanded ? "Hide" : "Show"} details for ${esc(c.name)}" aria-expanded="${expanded}">&#128065;</button><span class="owned-check">${owned ? "✓" : ""}</span></div><h3>${esc(c.name)}</h3><div class="card-popout" role="dialog" aria-live="polite"><p>${esc(c.description)}</p><div class="card-meta"><strong>Where it helps</strong><p>${esc(c.use_case)}</p></div><div class="card-meta limitation"><strong>Limitation</strong><p>${esc(c.limitation)}</p></div></div><div class="card-bottom"><strong>${money(c.cost)}</strong><button id="buy-${c.id}" data-buy="${c.id}" class="card-buy ${owned ? "remove" : ""}" aria-label="${owned ? "Remove" : "Buy"} ${esc(c.name)}" ${readOnly || over ? "disabled" : ""}>${owned ? "Selected ✓" : over ? "Over budget" : "+ Add"}</button></div></article>`;
    })
    .join("");
  const missing = CATEGORIES.filter(
    (c) => !run.chosen.some((id) => control(id).category === c),
  );
  $("shop-sidebar").innerHTML =
    `${readOnly ? '<button id="return-mission" class="secondary full">Return to mission</button><p class="eyebrow">LOCKED LOADOUT</p>' : '<p class="eyebrow">YOUR SECURITY BUDGET</p>'}<div class="budget">${money(data.budget - run.spent)}</div><p class="muted small">remaining of ${money(data.budget)}</p><div class="budget-track"><div style="width:${(run.spent / data.budget) * 100}%"></div></div><div class="mini-stat"><span>Committed</span><strong>${money(run.spent)}</strong></div><hr><div class="category-checks">${ownedBadges()}</div><div class="loadout"><div class="mini-stat"><span>YOUR CARDS</span><span>${run.chosen.length} selected</span></div>${run.chosen.length ? run.chosen.map((id) => `<div class="loadout-row">${mark(control(id).category)}<span>${esc(control(id).name)}</span>${readOnly ? "" : `<button class="text-button" data-buy="${id}" aria-label="Remove ${esc(control(id).name)}">×</button>`}</div>`).join("") : '<p class="muted small empty-loadout">Your defence starts here. Add cards from the library.</p>'}</div>${readOnly ? "" : `<button id="lock" class="primary full" ${missing.length ? "disabled" : ""}>Lock loadout & start →</button><p class="help-text">${missing.length ? "Still needed: " + missing.join(", ") : "Ready. Cards cannot be changed after confirmation."}</p><button id="starter" class="secondary full">Use a balanced starter loadout</button>`}<details class="baseline"><summary>Already protecting your business</summary>${data.already_in_place.map((c) => `<p><b>${esc(c.name)}</b><br>${esc(c.why_no_score)}</p>`).join("")}<p>These are not purchasable and do not earn points or count towards category coverage.</p></details>`;
}
function phaseHeading() {
  if (run.stage === "shop")
    return [
      "01 / BUILD YOUR LOADOUT",
      "Good defence starts with a decision.",
      `Protect ${CONFIG.businessName}. Choose your controls, earn your towers, and outlast the attack.`,
    ];
  if (run.stage === "gameover")
    return [
      "RUN COMPLETE / DEBRIEF",
      "Every decision leaves a trace.",
      "Review what worked, then try a different defence.",
    ];
  if (run.survivalWave > 0 || run.stage === "intermission")
    return [
      "05 / SURVIVAL MODE",
      "How long can your network hold?",
      "Your loadout is complete. The attackers get stronger with every wave.",
    ];
  const p = data.phases[run.phase];
  return [
    `PHASE ${run.phase + 1} / ${p.local_time.toUpperCase()}`,
    p.title,
    p.story,
  ];
}
function renderTimeline() {
  $("timeline").innerHTML = [
    "Loadout",
    "Delivery",
    "Discovery",
    "Command & control",
    "Encryption & ransom",
    "Survival",
  ]
    .map((name, i) => {
      const current =
        run.stage === "shop"
          ? 0
          : run.stage === "intermission" || run.survivalWave > 0
            ? 5
            : run.phase + 1;
      return `<div class="timeline-step ${i === current ? "current" : i < current ? "complete" : ""}" ${i === current ? 'aria-current="step"' : ""}><span>${i < current ? "✓" : String(i).padStart(2, "0")}</span><b>${name}</b></div>`;
    })
    .join("");
}
function matchesOverlay() {
  return `<section class="match-screen" aria-label="Phase card matching"><div class="section-header"><div><p class="eyebrow">PHASE ${run.phase + 1} / CARD REVEAL</p><h2>Find your matches.</h2></div><span class="match-count">${run.claimed.length}<small> / ${run.eligible.length} matched</small></span></div><p class="muted small">Nine cards. Click every card you own to collect its tower. This phase’s points become its level.</p><div class="reveal-groups">${CATEGORIES.map(
    (category, i) =>
      `<div><p class="reveal-label ${categoryClass(category)}">SET 0${i + 1} <span>${category}</span></p><div class="reveal-row">${run.offers
        .slice(i * 3, i * 3 + 3)
        .map((id) => {
          const c = control(id),
            level = data.phases[run.phase].scores[id],
            owned = run.chosen.includes(id),
            claimed = run.claimed.includes(id),
            eligible = owned && level > 0;
          return `<button id="match-${id}" data-claim="${id}" class="reveal-card ${categoryClass(category)} ${eligible ? "matchable" : ""} ${claimed ? "claimed" : ""}" ${!eligible || claimed ? "disabled" : ""}><span class="reveal-top"><b>${id}</b><span>${level} PTS</span></span><strong>${esc(c.name)}</strong><span class="reveal-status">${claimed ? "✓ Tower collected" : eligible ? "↗ Collect level " + level + " tower" : owned ? "No points this phase" : "Not in your loadout"}</span></button>`;
        })
        .join("")}</div></div>`,
  ).join(
    "",
  )}</div><div class="button-row"><button class="secondary" id="claim-all" ${run.claimed.length === run.eligible.length ? "disabled" : ""}>Collect all matches</button><button class="primary" id="finish-matching" ${run.claimed.length !== run.eligible.length ? "disabled" : ""}>Place towers →</button></div><p class="fine-print">All your purchased controls earn their official phase points, including cards outside this reveal.</p></section>`;
}
function commonSidebar() {
  return `<div class="phase-stamp">${run.survivalWave ? "SURVIVAL / " + String(run.survivalWave).padStart(2, "0") : run.stage === "intermission" ? "SURVIVAL / READY" : "ATTACK PHASE / 0" + (run.phase + 1)}</div>`;
}
function renderSidebar() {
  let html = commonSidebar();
  if (run.stage === "match")
    html += `<h2>Turn knowledge into defence.</h2><p class="muted">Your purchased cards stay in your hand throughout the run. Match their IDs with the phase reveal to collect towers.</p><div class="rule-block"><span>1 POINT</span><b>★ Basic tower</b><span>2 POINTS</span><b>★★ Upgraded</b><span>3 POINTS</span><b>★★★ Elite</b></div><p class="small muted">Zero-point cards grant no tower in this phase. Each match can be collected once. The same control can earn another tower in a later phase.</p><hr><p class="eyebrow">YOUR HAND</p><div class="hand-chips">${run.chosen.map((id) => `<span class="hand-chip ${categoryClass(control(id).category)}">${id}</span>`).join("")}</div><p class="fine-print">Reveals are fixed, so you can compare loadouts fairly on your next run.</p>`;
  if (run.stage === "deploy") {
    if (!run.pending.some((t) => t.uid === selected))
      selected = run.pending[0]?.uid ?? null;
    bridge.selected = selected;
    const free = PADS.map((_, i) => i).filter(
      (i) => !run.towers.some((t) => t.pad === i),
    );
    html += `<h2>Build your line.</h2><p class="muted small">Select a tower and a numbered pad. Towers persist through all four phases and survival.</p><div class="mini-stat"><span>Ready to place</span><strong>${run.pending.length}</strong></div><div class="tower-inventory">${run.pending.length ? run.pending.map((t) => `<button id="tower-${t.uid}" data-tower="${t.uid}" class="tower-option ${selected === t.uid ? "active" : ""}" aria-pressed="${selected === t.uid}">${mark(t.category)}<span><b>${esc(control(t.controlId).name)}</b><small>${t.controlId} · ${stars(t.level)} · ${t.category}</small></span></button>`).join("") : '<div class="success-note">✓ All earned towers are deployed.</div>'}</div>${run.pending.length ? `<label class="field-label" for="pad-select">Place using keyboard</label><div class="pad-entry"><select id="pad-select" aria-label="Choose an empty tower pad">${free.map((i) => `<option value="${i}">Pad ${String(i + 1).padStart(2, "0")}</option>`).join("")}</select><button class="secondary" id="place-pad">Place</button></div><button class="secondary full" id="auto-place">Auto-place remaining towers</button>` : ""}<button class="primary full" id="start-wave" ${run.pending.length ? "disabled" : ""}>Start rehearsal wave →</button><p class="help-text">Rehearsal ${run.phase + 1} · ${waveSpec(run.phase, 0).count} enemies · gentle difficulty</p><hr><p class="eyebrow">POSITION MATTERS</p><p class="small muted">Bends keep threats in range for longer. Place Detect towers near other towers: marked enemies take 30% more damage.</p>`;
  }
  if (run.stage === "battle")
    html += `<h2>${run.survivalWave ? "Hold the line." : "Defence in action."}</h2><p class="muted small">${run.survivalWave ? "Incoming waves grow in health, speed and numbers. Runners join at wave 2; armoured threats at wave 3." : "Watch how your towers work together. A behaviour checkpoint follows this wave."}</p><div class="battle-number"><span id="kill-counter">0</span><small>THREATS STOPPED</small></div><div class="mini-stat"><span>Active threats</span><strong id="enemies-live">0</strong></div><div class="budget-track"><div id="wave-progress" style="width:0%"></div></div><p class="small muted" id="wave-spawned">Preparing wave…</p><hr><p class="eyebrow">COMBAT ROLES</p><div class="role-note">${mark("Prevent")}<span><b>Prevent</b>Fast, focused damage.</span></div><div class="role-note">${mark("Detect")}<span><b>Detect</b>Slows and marks threats.</span></div><div class="role-note">${mark("Respond")}<span><b>Respond</b>Hits nearby groups.</span></div><p class="fine-print">These effects are a game metaphor. See the control cards for the real capabilities and limitations.</p>`;
  if (run.stage === "question")
    html += `<h2>The human layer.</h2><p class="muted">A good defence also depends on what people do next.</p><div class="quiz-benefit"><strong>+3</strong><span>behaviour points for a secure answer</span></div><div class="quiz-benefit"><strong>+5</strong><span>starting integrity in survival mode</span></div><p class="small muted">A correct answer also repairs 10 integrity now. Wrong or unanswered questions earn no bonus.</p><hr><p class="eyebrow">LAST WAVE</p><div class="mini-stat"><span>Stopped</span><strong>${run.lastWaveKills}</strong></div><div class="mini-stat"><span>Reached operations</span><strong>${run.lastWaveLeaks}</strong></div><p class="fine-print">Facilitators can pause the question timer while discussing or reading aloud.</p>`;
  if (run.stage === "intermission")
    html += `<h2>${run.survivalWave ? "Wave secured." : "The rehearsal is over."}</h2><p class="muted">${run.survivalWave ? "Your towers held. Take a breath, then send the next wave." : "All four phases are complete. Your network restores to full integrity, plus the bonuses you earned. Now find its limit."}</p><div class="battle-number"><span>${run.survivalWave ? run.cleared : run.towers.length}</span><small>${run.survivalWave ? "WAVES SURVIVED" : "TOWERS DEPLOYED"}</small></div>${!run.survivalWave ? `<div class="success-note">Starting integrity: ${100 + run.correctAnswers * 5}%</div>` : `<div class="mini-stat"><span>Next wave</span><strong>${waveSpec(3, run.survivalWave + 1).count} enemies</strong></div>`}<button class="primary full" id="start-wave">${run.survivalWave ? "Launch wave " + (run.survivalWave + 1) : "Begin survival"} →</button>${run.survivalWave ? '<button class="secondary full" id="bank-run">Finish run & debrief</button>' : ""}<hr><p class="small muted">No more cards or towers. Use your existing defence. Survival progress is recorded separately from the cyber learning score.</p>`;
  if (run.stage === "gameover")
    html += `<h2>What would you change?</h2><p class="muted">Review your defence, then try a different approach.</p><div class="rule-block"><span>PREVENT TOWERS</span><b>${run.towers.filter((t) => t.category === "Prevent").length}</b><span>DETECT TOWERS</span><b>${run.towers.filter((t) => t.category === "Detect").length}</b><span>RESPOND TOWERS</span><b>${run.towers.filter((t) => t.category === "Respond").length}</b></div><p class="small muted">${run.chosen.includes("R2") ? "Your 24/7 response team was available during the overnight attack." : "Much of the story happens overnight. Compare office-hours response with a 24/7 team."}</p><p class="small muted">${run.chosen.includes("R4") ? "Backup restores helped in the encryption phase. Recovery matters even when the attacker gets in." : "Consider backup restores: the final phase is about recovering after files are encrypted."}</p><button class="primary full" id="play-again">Try another loadout ↗</button>`;
  html += `<button class="secondary full" id="view-loadout">View loadout</button>`;
  $("game-sidebar").innerHTML = html;
  $("game-sidebar").setAttribute("data-stage", run.stage);
}
function quizOverlay() {
  const q = qNow();
  if (questionKey !== q.id) {
    questionKey = q.id;
    questionSeconds = 30;
    questionPaused = false;
    lastClock = performance.now();
  }
  const answer = run.answers.find((a) => a.id === q.id);
  return `<section class="quiz-screen" aria-label="Behaviour checkpoint"><div class="section-header"><p class="eyebrow">CHECKPOINT 0${run.phase + 1} / ${esc(q.category.toUpperCase())}</p><div class="quiz-clock"><span id="question-clock" role="timer" aria-label="Time remaining">${Math.ceil(questionSeconds)}s</span>${!answer ? `<button id="pause-question" class="mini-button">${questionPaused ? "Resume" : "Pause"}</button>` : ""}</div></div><h2>${esc(q.question)}</h2><div class="answers">${Object.entries(
    q.options,
  )
    .map(
      ([key, text]) =>
        `<button id="answer-${key}" data-answer="${key}" class="answer ${answer && key === q.correct ? "correct" : ""} ${answer?.answer === key && !answer.correct ? "incorrect" : ""}" ${answer ? "disabled" : ""}><b>${key}</b><span>${esc(text)}</span>${answer && key === q.correct ? "<span>✓</span>" : ""}</button>`,
    )
    .join(
      "",
    )}</div>${answer ? `<div class="answer-explanation ${answer.correct ? "secure" : ""}" role="status"><b>${answer.correct ? "Secure response. +3 points and +5 survival integrity." : answer.answer === null ? "Time is up. Correct answer: " + q.correct + "." : "Correct answer: " + q.correct + ". No bonus this time."}</b><p>${esc(q.explanation)}</p></div><button class="primary full" id="next-phase">${run.phase < 3 ? "Continue to phase " + (run.phase + 2) : "Prepare for survival"} →</button>` : '<p class="fine-print">One answer. 30 seconds. Pause the timer to read or discuss as a group.</p>'}</section>`;
}
function resultsOverlay() {
  if (run.cleared > best) {
    best = run.cleared;
    try {
      localStorage.setItem("cybermonkey-best", String(best));
    } catch {
      /* Storage is optional. */
    }
    $("best-wave").textContent = String(best);
  }
  return `<section class="results-screen"><p class="eyebrow">${run.health <= 0 ? "NETWORK OVERWHELMED" : "RUN COMPLETE"}</p><div class="result-emblem">${run.cleared}</div><h2>Survival waves cleared</h2><p class="muted">${run.health <= 0 ? "Your defence fell during wave " + run.survivalWave + "." : "You banked your run with " + Math.round(run.health) + "% integrity remaining."} Every run is a chance to learn.</p><p class="small muted">${run.correctAnswers}/4 secure answers · ${run.towers.length} towers · ${money(run.spent)} invested</p><button class="primary" id="result-restart">Build your next defence →</button></section>`;
}
let previousStage = "";
function render() {
  const focusId = (document.activeElement as HTMLElement)?.id;
  const shop = run.stage === "shop";
  const showLoadout = shop || viewingLoadout;
  $("shop-view").hidden = !showLoadout;
  $("game-view").hidden = showLoadout;
  const [eyebrow, heading, subtitle] = phaseHeading();
  $("eyebrow").textContent = eyebrow;
  $("heading").textContent = heading;
  $("subtitle").textContent = subtitle;
  renderTimeline();
  bridge.run = run;
  if (showLoadout) renderShop(!shop);
  else {
    renderSidebar();
    $("overlay").innerHTML =
      run.stage === "match"
        ? matchesOverlay()
        : run.stage === "question"
          ? quizOverlay()
          : run.stage === "gameover"
            ? resultsOverlay()
            : "";
    $("overlay").hidden = !["match", "question", "gameover"].includes(
      run.stage,
    );
    $("placement-hint").hidden = run.stage !== "deploy";
    $("pause").hidden = run.stage !== "battle";
    $("speed").hidden = run.stage !== "battle";
    if (!renderer) renderer = startGame(bridge);
  }
  if (
    focusId &&
    document.getElementById(focusId) &&
    !(document.getElementById(focusId) as HTMLButtonElement).disabled
  )
    $(focusId).focus({ preventScroll: true });
  else if (previousStage !== run.stage)
    $("heading").focus({ preventScroll: true });
  if (
    previousStage !== run.stage &&
    ["match", "question", "gameover"].includes(run.stage)
  )
    document
      .querySelector(".map-toolbar")
      ?.scrollIntoView({ block: "start", behavior: "instant" });
  previousStage = run.stage;
}
function placeSelected(pad: number) {
  if (selected && run.place(selected, pad)) {
    selected = run.pending[0]?.uid ?? null;
    render();
  } else if (run.stage === "deploy" && run.pending.length)
    notify("Choose an empty numbered pad for the selected tower.");
}
function startWave() {
  attempt(() => {
    if (run.startBattle()) {
      bridge.paused = false;
      renderer?.scene.beginBattle();
      $("pause").textContent = "Pause";
    }
  });
}
function updateBattle(b: Battle) {
  if ($("kill-counter")) {
    $("kill-counter").textContent = String(b.kills);
    $("enemies-live").textContent = String(b.enemies.length);
    $("wave-progress").style.width =
      `${((b.kills + b.leaks) / b.spec.count) * 100}%`;
    $("wave-spawned").textContent =
      `${b.spawned} / ${b.spec.count} spawned · ${b.leaks} reached operations`;
  }
}
function restart() {
  run = new Run(data);
  bridge.run = run;
  bridge.paused = false;
  selected = null;
  bridge.selected = null;
  questionKey = "";
  filter = "All";
  detailOpenId = null;
  renderer?.scene.resetBattle();
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
$("app").addEventListener("click", (event) => {
  const b = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (!b || b.disabled) return;
  if (b.dataset.detail) {
    detailOpenId = detailOpenId === b.dataset.detail ? null : b.dataset.detail;
    render();
    return;
  }
  if (b.dataset.buy) {
    attempt(() => run.toggle(b.dataset.buy!));
    return;
  }
  if (b.dataset.filter) {
    filter = b.dataset.filter;
    render();
    return;
  }
  if (b.dataset.claim) {
    attempt(() => {
      run.claim(b.dataset.claim!);
    });
    return;
  }
  if (b.dataset.tower) {
    selected = b.dataset.tower;
    render();
    return;
  }
  if (b.dataset.answer) {
    attempt(() => {
      run.answer(qNow(), b.dataset.answer!);
    });
    return;
  }
  switch (b.id) {
    case "starter":
      run.chosen = [...STARTER];
      render();
      break;
    case "lock":
      attempt(() => run.lock());
      window.scrollTo({ top: 0, behavior: "instant" });
      break;
    case "claim-all":
      attempt(() => run.eligible.forEach((id) => run.claim(id)));
      break;
    case "finish-matching":
      attempt(() => run.finishMatching());
      break;
    case "place-pad":
      placeSelected(Number($<HTMLSelectElement>("pad-select").value));
      break;
    case "auto-place":
      attempt(() => run.autoPlace());
      break;
    case "start-wave":
      startWave();
      break;
    case "pause":
      bridge.paused = !bridge.paused;
      b.textContent = bridge.paused ? "Resume" : "Pause";
      b.setAttribute("aria-pressed", String(bridge.paused));
      break;
    case "speed":
      bridge.speed = bridge.speed === 1 ? 2 : 1;
      b.textContent = `${bridge.speed}× speed`;
      break;
    case "pause-question":
      questionPaused = !questionPaused;
      b.textContent = questionPaused ? "Resume" : "Pause";
      break;
    case "next-phase":
      attempt(() => run.nextPhase());
      break;
    case "bank-run":
      run.stage = "gameover";
      render();
      break;
    case "play-again":
    case "result-restart":
      restart();
      break;
    case "restart":
      $<HTMLDialogElement>("restart-dialog").showModal();
      break;
    case "cancel-restart":
      $<HTMLDialogElement>("restart-dialog").close();
      break;
    case "confirm-restart":
      $<HTMLDialogElement>("restart-dialog").close();
      restart();
      break;
    case "close-tutorial":
    case "start-tutorial":
      $<HTMLDialogElement>("tutorial-dialog").close();
      break;
  }
});
setInterval(() => {
  const now = performance.now(),
    dt = Math.min((now - lastClock) / 1000, 0.5);
  lastClock = now;
  if (
    run.stage !== "question" ||
    questionPaused ||
    document.hidden ||
    run.answers.some((a) => a.id === qNow().id)
  )
    return;
  questionSeconds = Math.max(0, questionSeconds - dt);
  const clock = $("question-clock");
  if (clock) {
    clock.textContent = `${Math.ceil(questionSeconds)}s`;
    clock.classList.toggle("urgent", questionSeconds <= 10);
  }
  if (questionSeconds <= 0) {
    run.answer(qNow(), null);
    render();
  }
}, 100);
render();
$<HTMLDialogElement>("tutorial-dialog").showModal();
