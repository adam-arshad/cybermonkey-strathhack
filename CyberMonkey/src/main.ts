import "./style.css";
import scenarioJson from "./data/challenge.json";
import questionJson from "./data/questions.json";
import { Run, CONFIG, CATEGORIES, STARTER } from "./core/run";
import { PHASE_STORIES, matchPoints } from "./core/matching";
import { PADS } from "./core/map";
import { waveSpec } from "./core/combat";
import type { Battle } from "./core/combat";
import type { Category, Scenario, Question, Control } from "./core/types";
import { startGame } from "./game/main";
import type { Bridge } from "./game/scenes/Game";

document.title = CONFIG.gameName;
const data = scenarioJson as Scenario;
const questions = questionJson.questions as Question[];
let run = new Run(data, questions),
  filter = "All",
  selected: string | null = null,
  viewingLoadout = false,
  detailOpenId: string | null = null;
let matchingCard: string | null = null;
let draggingCard: string | null = null;
let matchFeedback = "";
let renderer: ReturnType<typeof startGame> | null = null;
let questionKey = "",
  questionSeconds = 30,
  questionPaused = false,
  lastClock = performance.now();
let toastTimer: ReturnType<typeof setTimeout>;
let lastLeakCount = 0;
let lastBattleHealth = 100;
let pausedBeforeLoadout = false;
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
const qNow = () => run.currentQuestion;
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
  previewPad: null,
  paused: false,
  speed: 1,
  onPad: placeSelected,
  onTick: updateBattle,
  onEnd: (b) => {
    run.finishBattle(b.health, b.kills, b.leaks);
    matchingCard = null;
    matchFeedback = "";
    bridge.paused = false;
    render();
    if (run.stage === "battle" && run.survivalWave > 0) {
      lastLeakCount = 0;
      lastBattleHealth = run.health;
      renderer?.scene.beginBattle();
      notify(run.cleared ? `Wave ${run.cleared} cleared. +100 points. Wave ${run.survivalWave} begins.` : "Survival begins. Wave 1 is starting.");
    }
  },
};

$("app").innerHTML = `
<header class="topbar"><a class="brand" href="./" aria-label="${CONFIG.gameName} home"><span class="monkey" aria-hidden="true">◉</span><span>${CONFIG.gameName.toUpperCase()}</span></a><button class="text-button" id="restart">New run</button></header>
<main>
 <div class="mission-title"><p class="eyebrow" id="eyebrow">LOADOUT</p><h1 id="heading" tabindex="-1">Choose your defences</h1><div class="scenario-summary" id="scenario-summary"><p class="scenario-label" id="scenario-label" hidden>Scenario</p><p id="subtitle">Buy controls for ${CONFIG.businessName} before the attack begins.</p></div></div>
 <nav class="timeline" aria-label="Game progress" id="timeline"></nav>
 <section id="shop-view" class="shop-layout"><div><div class="section-header"><div><p class="eyebrow">CONTROL LIBRARY</p><h2>Your first line of defence</h2></div><span class="muted">${data.controls.length} controls available</span></div><div class="filters" role="group" aria-label="Filter controls" id="filters"></div><div class="catalog" id="catalog"></div></div><aside id="shop-sidebar" class="side-panel" aria-label="Your loadout"></aside></section>
 <section id="game-view" hidden><div id="score-strip" class="score-strip" aria-label="Your score"></div><div id="matching-view" hidden></div><div class="game-layout" id="battle-layout"><div class="map-column"><div class="map-toolbar"><span class="map-label">${CONFIG.businessName}</span><div class="map-controls"><button id="pause" class="mini-button">Pause</button><button id="speed" class="mini-button" aria-label="Change battle speed">1× speed</button></div></div><div class="map-frame"><div id="game-container"></div><div id="overlay"></div><div id="placement-hint" class="placement-hint" hidden>Every pad reaches the route. Hover over a pad to see where your tower can fire.</div></div><div class="map-footer"><span><i class="legend-dot prevent"></i> Prevent · direct</span><span><i class="legend-dot detect"></i> Detect · slow + mark</span><span><i class="legend-dot respond"></i> Respond · area</span></div></div><aside class="side-panel game-sidebar" id="game-sidebar" aria-label="Mission controls"></aside></div></section>
 <footer class="page-footer"><span>${CONFIG.gameName}</span><span>Best survival: <b id="best-wave">${best}</b> waves</span></footer>
</main><div class="toast" id="toast" role="status" hidden></div>
<dialog id="story-dialog" class="story-dialog" aria-labelledby="story-title" aria-describedby="story-content"></dialog>
<dialog id="restart-dialog"><p class="eyebrow">START AGAIN</p><h2>Build a different defence?</h2><p>This run will be cleared. Your best survival record stays saved on this browser.</p><div class="button-row"><button class="secondary" id="cancel-restart">Keep playing</button><button class="primary" id="confirm-restart">Start new run</button></div></dialog>
<dialog id="tutorial-dialog" class="tutorial-dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-intro">
  <div class="tutorial-header"><div><p class="eyebrow">QUICK START</p><h2 id="tutorial-title">Protect the network. Make the right calls.</h2><p id="tutorial-intro">Build a balanced defence for Northstar Energy, then adapt it as the attack unfolds.</p></div><button type="button" class="dialog-close" id="close-tutorial" aria-label="Close tutorial">×</button></div>
  <div class="tutorial-grid">
    <section class="tutorial-step"><span class="tutorial-number">01</span><div><h3>Build your loadout</h3><p>Buy control cards with your £3m budget. Include at least one <b class="tutorial-category prevent">Prevent</b>, <b class="tutorial-category detect">Detect</b> and <b class="tutorial-category respond">Respond</b> card.</p></div></section>
    <section class="tutorial-step"><span class="tutorial-number">02</span><div><h3>Match controls to threats</h3><p>Read each phase’s story, then drag your purchased cards onto the nine named boxes. You can also select a card, then select its box. Match every card you own to earn 3, 2 or 1 points and a tower of that level.</p></div></section>
    <section class="tutorial-step"><span class="tutorial-number">03</span><div><h3>Answer behaviour questions</h3><p>After matching your cards, answer five questions in a row, grouped by relevance to the phase. Answer choices change position each run. Correct answers improve your behaviour score and integrity.</p></div></section>
    <section class="tutorial-step"><span class="tutorial-number">04</span><div><h3>Place your towers</h3><p>Select each earned tower and place it on a numbered pad near the route. All towers must be placed before you start a wave.</p></div></section>
    <section class="tutorial-step"><span class="tutorial-number">05</span><div><h3>Defend the network</h3><p><b class="tutorial-category prevent">Prevent</b> deals direct damage, <b class="tutorial-category detect">Detect</b> slows and marks enemies, and <b class="tutorial-category respond">Respond</b> hits groups.</p></div></section>
    <section class="tutorial-step"><span class="tutorial-number">06</span><div><h3>Survive the attack</h3><p>After all four phases, survival waves start automatically. Enemies can damage towers; each tower has 2 HP per match point. Keep network integrity above zero.</p></div></section>
  </div>
  <div class="tutorial-footer"><p class="fine-print">Correct quiz answers earn 50 points. Each survival wave cleared earns 100 points. Your total appears when the run ends.</p><button type="button" class="primary" id="start-tutorial">Got it — start playing →</button></div>
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
      "LOADOUT",
      "Choose your defences",
      `Buy controls for ${CONFIG.businessName} before the attack begins.`,
    ];
  if (run.stage === "gameover")
    return [
      "RESULTS",
      "Run complete",
      "Review your results or start a new run.",
    ];
  if (run.survivalWave > 0)
    return [
      "AFTER PHASE 4",
      "Survival mode",
      "The attackers get stronger with every wave.",
    ];
  const p = data.phases[run.phase];
  return [
    `PHASE ${run.phase + 1} / ${p.local_time.toUpperCase()}`,
    PHASE_STORIES[run.phase].title,
    PHASE_STORIES[run.phase].paragraphs.join(" "),
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
          : run.survivalWave > 0
            ? 5
            : run.phase + 1;
      return `<div class="timeline-step ${i === current ? "current" : i < current ? "complete" : ""}" ${i === current ? 'aria-current="step"' : ""}><span>${i < current ? "✓" : String(i).padStart(2, "0")}</span><b>${name}</b></div>`;
    })
    .join("");
}
function matchesOverlay() {
  const complete = run.claimed.length === run.eligible.length;
  return `<section class="match-screen" aria-labelledby="match-title">
    <div class="section-header"><div><p class="eyebrow">PHASE ${run.phase + 1} / CONTROL MATCHING</p><h2 id="match-title" tabindex="-1">Find your matches.</h2></div><button class="secondary" id="view-story">View story</button></div>
    <p class="muted match-instructions">Drag a purchased card onto its named box, or select a card and then its box. Match every card you own to continue.</p>
    <div class="matching-layout">
      <aside class="match-deck" aria-label="Purchased cards"><div class="deck-heading"><h3>Your deck</h3><span>${run.deck.length} left</span></div><p class="small muted">Matched cards return next phase.</p>
        <div class="deck-cards">${run.deck.map((id) => {
          const c = control(id);
          return `<button id="deck-${id}" class="deck-card ${categoryClass(c.category)} ${matchingCard === id ? "selected" : ""}" data-deck="${id}" draggable="true" aria-pressed="${matchingCard === id}" aria-label="Select ${id}, ${esc(c.name)}"><span class="deck-card-top">${mark(c.category)}<b>${id}</b><span>${c.category}</span></span><strong>${esc(c.name)}</strong><small>${matchingCard === id ? "Selected · choose a box" : "Drag or select to place"}</small></button>`;
        }).join("") || '<p class="success-note">All cards placed. Your deck returns next phase.</p>'}</div>
      </aside>
      <div class="matching-board"><div class="rank-headings" aria-hidden="true"><span><b>3 points</b>Most effective</span><span><b>2 points</b>Second choice</span><span><b>1 point</b>Third choice</span></div>
        ${CATEGORIES.map((category, row) => `<section class="match-row" aria-label="${category} solutions"><h3 class="${categoryClass(category)}">${symbols[category]} ${category}</h3><div class="match-tiles">${run.offers.slice(row * 3, row * 3 + 3).map((id) => {
          const c = control(id), points = matchPoints(run.phase, id), owned = run.chosen.includes(id), claimed = run.claimed.includes(id);
          return `<button id="match-${id}" data-target="${id}" class="match-tile ${categoryClass(category)} ${owned ? "available" : "unavailable"} ${claimed ? "matched" : ""}" aria-disabled="${claimed || !owned}"><span class="tile-top"><b>${id}</b><b>${points} ${points === 1 ? "PT" : "PTS"}</b></span><strong>${esc(c.name)}</strong><span class="tile-status">${claimed ? `✓ Matched · level ${points} tower` : owned ? "● Card available in your deck" : "Not purchased"}</span><span class="tile-action">${claimed ? `+${points} points earned` : owned ? "Drop matching card here" : "No card to place"}</span></button>`;
        }).join("")}</div></section>`).join("")}
      </div>
    </div>
    <div class="matching-footer"><div><p class="match-progress"><b>${run.claimed.length} / ${run.eligible.length}</b> matches placed <span>· ${run.phaseScore} points this phase</span></p><p id="match-feedback" role="status" aria-live="polite">${esc(matchFeedback || (complete ? run.eligible.length ? "All your matches are placed. Your towers are ready." : "You own no matching cards this phase. You can continue." : "Only matching cards earn points. Unmatched cards stay in your deck."))}</p></div><button class="primary" id="finish-matching" ${complete ? "" : "disabled"}>Answer questions →</button></div>
  </section>`;
}
function showStory() {
  const story = PHASE_STORIES[run.phase];
  const dialog = $<HTMLDialogElement>("story-dialog");
  dialog.innerHTML = `<p class="eyebrow">ATTACK PHASE ${run.phase + 1} OF 4</p><div class="story-number" aria-hidden="true">0${run.phase + 1}</div><h2 id="story-title">${esc(story.title)}</h2><div id="story-content">${story.paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}</div><p class="story-prompt">Your defences are about to be tested. Find the purchased controls that can help in this phase.</p><button class="primary full" id="begin-matching" autofocus>Find your matches →</button>`;
  if (!dialog.open) dialog.showModal();
}
function submitMatch(id: string, targetId: string) {
  const points = matchPoints(run.phase, id);
  if (run.claim(id, targetId)) {
    matchingCard = null;
    matchFeedback = `${control(id).name} matched! +${points} points and a level ${points} tower.`;
    render();
    const next = run.deck.find((card) => run.eligible.includes(card));
    $(next ? `deck-${next}` : "finish-matching").focus({ preventScroll: true });
  } else {
    matchingCard = null;
    matchFeedback = "That card does not match this box. It has returned to your deck. Match the card name and ID; no points were lost.";
    render();
    $(`deck-${id}`)?.focus({ preventScroll: true });
  }
}
function commonSidebar() {
  return `<div class="phase-stamp">${run.survivalWave ? "SURVIVAL / WAVE " + String(run.survivalWave).padStart(2, "0") : "ATTACK PHASE / 0" + (run.phase + 1)}</div>`;
}
function renderSidebar() {
  let html = commonSidebar();
  if (run.stage === "deploy") {
    if (!run.pending.some((t) => t.uid === selected))
      selected = run.pending[0]?.uid ?? null;
    bridge.selected = selected;
    const free = PADS.map((_, i) => i).filter(
      (i) => !run.towers.some((t) => t.pad === i && t.hp > 0),
    );
    if (!run.pending.length || !free.includes(bridge.previewPad ?? -1)) bridge.previewPad = null;
    html += `<h2>Build your line.</h2><p class="muted small">Every numbered pad can reach the route. Select a tower, then hover over a pad or use the selector to preview its coverage.</p><div class="mini-stat"><span>Ready to place</span><strong>${run.pending.length}</strong></div><div class="tower-inventory">${run.pending.length ? run.pending.map((t) => `<button id="tower-${t.uid}" data-tower="${t.uid}" class="tower-option ${selected === t.uid ? "active" : ""}" aria-pressed="${selected === t.uid}">${mark(t.category)}<span><b>${esc(control(t.controlId).name)}</b><small>${t.controlId} · ${stars(t.level)} · ${t.hp} HP · ${t.category}</small></span></button>`).join("") : '<div class="success-note">✓ All earned towers are deployed.</div>'}</div>${run.pending.length ? `<label class="field-label" for="pad-select">Place using keyboard</label><div class="pad-entry"><select id="pad-select" aria-label="Choose an empty tower pad">${free.map((i) => `<option value="${i}" ${bridge.previewPad === i ? "selected" : ""}>Pad ${String(i + 1).padStart(2, "0")}</option>`).join("")}</select><button class="secondary" id="place-pad">Place</button></div><button class="secondary full" id="auto-place">Auto-place remaining towers</button>` : ""}<button class="primary full" id="start-wave" ${run.pending.length ? "disabled" : ""}>Start rehearsal wave →</button><p class="help-text">Rehearsal ${run.phase + 1} · ${waveSpec(run.phase, 0).count} enemies · gentle difficulty</p><hr><p class="eyebrow">POSITION MATTERS</p><p class="small muted">The highlighted path shows where this tower can fire. Bends keep threats in range longer. Enemies can shoot back; tower HP carries into later waves.</p>`;
  }
  if (run.stage === "battle")
    html += `<h2>${run.survivalWave ? `Wave ${run.survivalWave}` : "Defence in action."}</h2><p class="muted small">${run.survivalWave ? "Waves begin automatically. Each one you clear earns 100 points; threats grow stronger as you continue." : "Enemies can shoot back. Towers keep any damage they take when the next phase begins."}</p>${run.survivalWave ? `<div class="mini-stat"><span>Waves cleared</span><strong>${run.cleared}</strong></div><div class="mini-stat"><span>Wave points</span><strong>${run.waveScore}</strong></div>` : ""}<div class="battle-number"><span id="kill-counter">0</span><small>THREATS STOPPED</small></div><div class="mini-stat"><span>Active threats</span><strong id="enemies-live">0</strong></div><div class="mini-stat"><span>Towers standing</span><strong id="towers-live">${run.towers.filter((t) => t.pad !== null && t.hp > 0).length}</strong></div><div class="budget-track"><div id="wave-progress" style="width:0%"></div></div><p class="small muted" id="wave-spawned">Preparing wave…</p><hr><p class="eyebrow">COMBAT ROLES</p><div class="role-note">${mark("Prevent")}<span><b>Prevent</b>Fast, focused damage.</span></div><div class="role-note">${mark("Detect")}<span><b>Detect</b>Slows and marks threats.</span></div><div class="role-note">${mark("Respond")}<span><b>Respond</b>Hits nearby groups.</span></div><p class="fine-print">These effects are a game metaphor. See the control cards for the real capabilities and limitations.</p>`;
  if (run.stage === "question")
    html += `<h2>The human layer.</h2><p class="muted">Answer five questions after matching, then place your earned towers. Each answer is followed by feedback.</p><div class="quiz-benefit"><strong>+50</strong><span>points for each correct answer</span></div><div class="quiz-benefit"><strong>+5</strong><span>starting integrity in survival mode</span></div><p class="small muted">A correct answer also repairs 10 integrity now. Wrong or unanswered questions earn no bonus.</p><hr><p class="eyebrow">YOUR MATCHES</p><div class="mini-stat"><span>Towers earned</span><strong>${run.pending.length}</strong></div><div class="mini-stat"><span>Network integrity</span><strong>${Math.round(run.health)}%</strong></div><p class="fine-print">Facilitators can pause the question timer while discussing or reading aloud.</p>`;
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
  return `<section class="quiz-screen" aria-label="Behaviour checkpoint"><div class="section-header"><p class="eyebrow">CHECKPOINT 0${run.phase + 1} / ${esc(q.category.toUpperCase())}</p><div class="quiz-clock"><span id="question-clock" role="timer" aria-label="Time remaining">${Math.ceil(questionSeconds)}s</span>${!answer ? `<button id="pause-question" class="mini-button">${questionPaused ? "Resume" : "Pause"}</button>` : ""}</div></div><p class="quiz-progress" role="status">Question ${run.questionIndex + 1} of ${run.checkpointQuestions.length}</p><progress class="quiz-progress-bar" max="${run.checkpointQuestions.length}" value="${run.questionIndex + (answer ? 1 : 0)}" aria-label="Questions completed"></progress><h2 id="quiz-title" tabindex="-1">${esc(q.question)}</h2><div class="answers">${Object.entries(
    q.options,
  )
    .map(
      ([key, text]) =>
        `<button id="answer-${key}" data-answer="${key}" class="answer ${answer && key === q.correct ? "correct" : ""} ${answer?.answer === key && !answer.correct ? "incorrect" : ""}" ${answer ? "disabled" : ""}><b>${key}</b><span>${esc(text)}</span>${answer && key === q.correct ? "<span>✓</span>" : ""}</button>`,
    )
    .join(
      "",
    )}</div>${answer ? `<div class="answer-explanation ${answer.correct ? "secure" : ""}" role="status"><b>${answer.correct ? "Secure response. +50 points and +5 survival integrity." : answer.answer === null ? "Time is up. Correct answer: " + q.correct + "." : "Correct answer: " + q.correct + ". No bonus this time."}</b><p>${esc(q.explanation)}</p></div><button class="primary full" id="${run.checkpointComplete ? "finish-questions" : "next-question"}">${run.checkpointComplete ? "Questions complete · place towers" : "Next question"} →</button>` : '<p class="fine-print">30 seconds per question. Complete all five before tower placement. Pause to read or discuss as a group.</p>'}</section>`;
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
  return `<section class="results-screen"><p class="eyebrow">NETWORK OVERWHELMED</p><h2>Final score</h2><strong class="final-score">${run.finalScore}</strong><div class="score-breakdown"><span>Card matches <b>${run.controlScore}</b></span><span>Correct answers <b>${run.behaviour}</b></span><span>${run.cleared} waves cleared <b>${run.waveScore}</b></span></div><p class="muted">Your defence fell during wave ${run.survivalWave}.</p><p class="small muted">${run.correctAnswers}/${run.phaseQuestions.flat().length} correct answers · ${run.towers.length} towers earned · ${money(run.spent)} invested</p><button class="primary" id="result-restart">Build your next defence →</button></section>`;
}
let previousStage = "";
function render() {
  const focusId = (document.activeElement as HTMLElement)?.id;
  const deckScroll = previousStage === run.stage ? document.querySelector(".deck-cards")?.scrollTop ?? 0 : 0;
  const shop = run.stage === "shop";
  if (run.stage !== "deploy") bridge.previewPad = null;
  const showLoadout = shop || viewingLoadout;
  $("shop-view").hidden = !showLoadout;
  $("game-view").hidden = showLoadout;
  const [eyebrow, heading, subtitle] = phaseHeading();
  $("eyebrow").textContent = eyebrow;
  $("heading").textContent = heading;
  $("subtitle").textContent = subtitle;
  const hasScenario = !shop && run.stage !== "gameover" && run.survivalWave === 0;
  $("scenario-label").hidden = !hasScenario;
  $("scenario-summary").classList.toggle("has-scenario", hasScenario);
  renderTimeline();
  const matching = run.stage === "match" || run.stage === "story";
  $("matching-view").hidden = !matching;
  $("battle-layout").hidden = matching;
  $("score-strip").innerHTML = `<span>Card matches <b>${run.controlScore}</b></span><span>Quiz points <b>${run.behaviour}</b></span>${run.survivalWave ? `<span>Waves cleared <b>${run.cleared}</b></span>` : ""}`;
  bridge.run = run;
  if (showLoadout) renderShop(!shop);
  else if (matching) {
    $("matching-view").innerHTML = matchesOverlay();
    document.querySelector(".deck-cards")!.scrollTop = deckScroll;
  } else {
    renderSidebar();
    $("overlay").innerHTML =
      run.stage === "question"
          ? quizOverlay()
          : run.stage === "gameover"
            ? resultsOverlay()
            : "";
    $("overlay").hidden = !["question", "gameover"].includes(
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
  if (matching && previousStage !== run.stage)
    $("matching-view").scrollIntoView({ block: "start", behavior: "instant" });
  previousStage = run.stage;
  if (run.stage === "story" && !showLoadout) showStory();
}
function placeSelected(pad: number) {
  if (selected && run.place(selected, pad)) {
    selected = run.pending[0]?.uid ?? null;
    bridge.previewPad = null;
    render();
  } else if (run.stage === "deploy" && run.pending.length)
    notify("Choose an empty numbered pad for the selected tower.");
}
function startWave() {
  attempt(() => {
    if (run.startBattle()) {
      bridge.paused = false;
      lastLeakCount = 0;
      lastBattleHealth = run.health;
      renderer?.scene.beginBattle();
      $("pause").textContent = "Pause";
    }
  });
}
function updateBattle(b: Battle) {
  if (b.leaks > lastLeakCount) {
    const leaked = b.leaks - lastLeakCount;
    const integrityLost = Math.max(0, lastBattleHealth - b.health);
    notify(
      b.health <= 0
        ? "Network overwhelmed. You lost this run."
        : `${leaked} threat${leaked === 1 ? "" : "s"} got through. Network integrity -${integrityLost}.`,
    );
  }
  lastLeakCount = b.leaks;
  lastBattleHealth = b.health;
  if ($("kill-counter")) {
    $("kill-counter").textContent = String(b.kills);
    $("enemies-live").textContent = String(b.enemies.length);
    $("towers-live").textContent = String(run.towers.filter((t) => t.pad !== null && t.hp > 0).length);
    $("wave-progress").style.width =
      `${((b.kills + b.leaks) / b.spec.count) * 100}%`;
    $("wave-spawned").textContent =
      `${b.spawned} / ${b.spec.count} spawned · ${b.leaks} reached operations`;
  }
}
function restart() {
  run = new Run(data, questions);
  bridge.run = run;
  bridge.paused = false;
  lastLeakCount = 0;
  lastBattleHealth = 100;
  selected = null;
  matchingCard = null;
  draggingCard = null;
  matchFeedback = "";
  viewingLoadout = false;
  pausedBeforeLoadout = false;
  $<HTMLDialogElement>("story-dialog").close();
  bridge.selected = null;
  bridge.previewPad = null;
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
  if (b.dataset.deck) {
    matchingCard = matchingCard === b.dataset.deck ? null : b.dataset.deck;
    matchFeedback = matchingCard ? `${control(matchingCard).name} selected. Choose its matching box.` : "Selection cleared.";
    render();
    return;
  }
  if (b.dataset.target) {
    if (matchingCard) submitMatch(matchingCard, b.dataset.target);
    else notify("Select a card from your deck first, then choose its matching box.");
    return;
  }
  if (b.dataset.tower) {
    selected = b.dataset.tower;
    render();
    return;
  }
  if (b.dataset.answer) {
    attempt(() => {
      run.answer(b.dataset.answer!);
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
    case "view-story":
      showStory();
      break;
    case "begin-matching":
      run.beginMatching();
      $<HTMLDialogElement>("story-dialog").close();
      render();
      $("match-title").focus({ preventScroll: true });
      break;
    case "view-loadout":
      viewingLoadout = true;
      if (run.stage === "battle") {
        pausedBeforeLoadout = bridge.paused;
        bridge.paused = true;
      }
      render();
      break;
    case "return-mission":
      viewingLoadout = false;
      if (run.stage === "battle") bridge.paused = pausedBeforeLoadout;
      render();
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
    case "next-question":
      if (run.nextQuestion()) {
        render();
        $("overlay").scrollTop = 0;
        $("quiz-title").focus({ preventScroll: true });
      }
      break;
    case "finish-questions":
      attempt(() => { run.finishQuestions(); });
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
function previewSelectedPad(event: Event) {
  const target = event.target;
  if (target instanceof HTMLSelectElement && target.id === "pad-select")
    bridge.previewPad = Number(target.value);
}
$("app").addEventListener("focusin", previewSelectedPad);
$("app").addEventListener("change", previewSelectedPad);
// Native dragging on desktop; card-then-tile selection also supports touch and keyboard.
$("matching-view").addEventListener("dragstart", (event) => {
  const card = (event.target as HTMLElement).closest<HTMLElement>("[data-deck]");
  if (!card || run.stage !== "match" || !event.dataTransfer) return;
  draggingCard = card.dataset.deck!;
  event.dataTransfer.setData("text/plain", draggingCard);
  event.dataTransfer.effectAllowed = "move";
  card.classList.add("dragging");
});
$("matching-view").addEventListener("dragover", (event) => {
  const tile = (event.target as HTMLElement).closest<HTMLElement>("[data-target]");
  if (!tile || !draggingCard) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  tile.classList.add("drag-over");
});
$("matching-view").addEventListener("dragleave", (event) => {
  const tile = (event.target as HTMLElement).closest<HTMLElement>("[data-target]");
  if (tile && !tile.contains(event.relatedTarget as Node | null)) tile.classList.remove("drag-over");
});
$("matching-view").addEventListener("drop", (event) => {
  const tile = (event.target as HTMLElement).closest<HTMLElement>("[data-target]");
  if (!tile || !draggingCard) return;
  event.preventDefault();
  const id = draggingCard;
  draggingCard = null;
  submitMatch(id, tile.dataset.target!);
});
$("matching-view").addEventListener("dragend", () => {
  const returnedCard = draggingCard;
  draggingCard = null;
  if (returnedCard) {
    matchingCard = null;
    matchFeedback = "Card returned to your deck. Drop it onto its named box; no points were lost.";
    render();
    $(`deck-${returnedCard}`)?.focus({ preventScroll: true });
  }
  document.querySelectorAll(".dragging, .drag-over").forEach((el) => el.classList.remove("dragging", "drag-over"));
});
$("matching-view").addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !matchingCard) return;
  matchingCard = null;
  matchFeedback = "Selection cleared. Your card is still in your deck.";
  render();
});
$("story-dialog").addEventListener("cancel", (event) => {
  if (run.stage === "story") event.preventDefault();
});
setInterval(() => {
  const now = performance.now(),
    dt = Math.min((now - lastClock) / 1000, 0.5);
  lastClock = now;
  if (
    run.stage !== "question" ||
    questionPaused ||
    viewingLoadout ||
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
    run.answer(null);
    render();
  }
}, 100);
render();
$<HTMLDialogElement>("tutorial-dialog").showModal();
