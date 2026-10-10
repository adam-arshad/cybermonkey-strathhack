import { Scene, GameObjects, Math as PhaserMath } from "phaser";
import { Battle, towerRange } from "../../core/combat";
import { ROUTE, PADS, MAP } from "../../core/map";
import { CONFIG, type Run } from "../../core/run";
import type { Category } from "../../core/types";
export interface Bridge {
  run: Run;
  selected: string | null;
  paused: boolean;
  speed: number;
  onPad: (pad: number) => void;
  onTick: (battle: Battle) => void;
  onEnd: (battle: Battle) => void;
}
const colours: Record<Category, number> = {
  Prevent: 0x87efbd,
  Detect: 0x83bdff,
  Respond: 0xffc378,
};
export class DefenseScene extends Scene {
  bridge: Bridge;
  battle: Battle | null = null;
  dynamic!: GameObjects.Graphics;
  towersLayer!: GameObjects.Container;
  padLayer!: GameObjects.Container;
  hover = -1;
  towerKey = "";
  effects: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    colour: number;
    life: number;
  }[] = [];
  constructor(bridge: Bridge) {
    super("Defense");
    this.bridge = bridge;
  }
  create() {
    this.drawMap();
    this.padLayer = this.add.container(0, 0);
    PADS.forEach((p, i) => {
      const circle = this.add
        .circle(p.x, p.y, 22, 0x102d32, 0.85)
        .setStrokeStyle(1, 0x648c87, 0.65)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(p.x, p.y, String(i + 1).padStart(2, "0"), {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#a8c6b8",
        })
        .setOrigin(0.5);
      circle.on("pointerover", () => {
        this.hover = i;
      });
      circle.on("pointerout", () => {
        this.hover = -1;
      });
      circle.on("pointerdown", () => this.bridge.onPad(i));
      this.padLayer.add([circle, label]);
    });
    this.towersLayer = this.add.container(0, 0);
    this.dynamic = this.add.graphics();
    this.game.canvas.setAttribute(
      "aria-label",
      `${CONFIG.businessName} network map. Use the numbered pad selector next to the map to place towers with a keyboard.`,
    );
    this.game.canvas.setAttribute("role", "img");
  }
  drawMap() {
    const g = this.add.graphics();
    g.fillStyle(0x183e3d);
    g.fillRect(0, 0, MAP.width, MAP.height);
    g.fillStyle(0x204a43);
    g.fillPoints(
      [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 330, y: 210 },
        { x: 0, y: 320 },
      ].map((p) => new PhaserMath.Vector2(p.x, p.y)),
      true,
    );
    g.fillStyle(0x20463e);
    g.fillPoints(
      [
        { x: 390, y: 440 },
        { x: 620, y: 355 },
        { x: 860, y: 620 },
        { x: 315, y: 620 },
      ].map((p) => new PhaserMath.Vector2(p.x, p.y)),
      true,
    );
    g.fillStyle(0x1d4547);
    g.fillPoints(
      [
        { x: 800, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 350 },
        { x: 870, y: 270 },
      ].map((p) => new PhaserMath.Vector2(p.x, p.y)),
      true,
    );
    g.lineStyle(1, 0x6b9988, 0.075);
    for (let x = 0; x < 1000; x += 40) g.lineBetween(x, 0, x, 620);
    for (let y = 0; y < 620; y += 40) g.lineBetween(0, y, 1000, y);
    // The route is a network connection; enemies follow these same simulation coordinates.
    for (const [width, colour] of [
      [57, 0x0f3033],
      [45, 0x537b72],
      [32, 0x365e58],
    ] as const) {
      g.lineStyle(width, colour, 1);
      g.beginPath();
      g.moveTo(ROUTE[0].x, ROUTE[0].y);
      ROUTE.slice(1).forEach((p) => g.lineTo(p.x, p.y));
      g.strokePath();
      g.fillStyle(colour);
      ROUTE.slice(1, -1).forEach((p) => g.fillCircle(p.x, p.y, width / 2));
    }
    g.lineStyle(2, 0x91cdb1, 0.45);
    g.beginPath();
    g.moveTo(ROUTE[0].x, ROUTE[0].y);
    ROUTE.slice(1).forEach((p) => g.lineTo(p.x, p.y));
    g.strokePath();
    const tree = (x: number, y: number, s = 1) => {
      g.fillStyle(0x0e2c2a, 0.4);
      g.fillEllipse(x + 5, y + 12, 25 * s, 10 * s);
      g.fillStyle(0x122f2c);
      g.fillTriangle(
        x - 11 * s,
        y + 5 * s,
        x + 11 * s,
        y + 5 * s,
        x,
        y - 24 * s,
      );
      g.fillStyle(0x2f6350);
      g.fillTriangle(x - 8 * s, y - 3 * s, x + 8 * s, y - 3 * s, x, y - 26 * s);
    };
    [
      [16, 48],
      [31, 55],
      [333, 593],
      [358, 602],
      [681, 34],
      [710, 27],
      [820, 589],
      [840, 603],
      [907, 263],
      [929, 278],
      [950, 258],
      [580, 265],
      [605, 279],
    ].forEach(([x, y]) => tree(x, y));
    // Power buildings are decorative. Only the route and numbered pads affect combat.
    const building = (x: number, y: number, w: number, h: number) => {
      g.fillStyle(0x0b292b, 0.5);
      g.fillRoundedRect(x + 7, y + 7, w, h, 7);
      g.fillStyle(0x638c7d);
      g.fillRoundedRect(x, y, w, h, 5);
      g.fillStyle(0x8db19c);
      g.fillRect(x + 5, y + 4, w - 10, 10);
      g.fillStyle(0xd4e9be);
      for (let px = x + 9; px < x + w - 8; px += 14)
        g.fillRect(px, y + h - 15, 6, 6);
    };
    building(888, 394, 85, 78);
    building(894, 357, 31, 32);
    this.add
      .text(930, 487, `${CONFIG.businessName.toUpperCase()}\nOPERATIONS`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#def3d8",
        align: "center",
        lineSpacing: 5,
      })
      .setOrigin(0.5);
    this.add.text(26, 109, "THREAT ENTRY →", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffad96",
    });
    this.add.text(25, 587, "SECTOR 07  /  TRAINING NETWORK", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#91b6a5",
    });
    for (const [x, y] of [
      [867, 65],
      [928, 110],
      [860, 212],
    ]) {
      g.lineStyle(3, 0x91b4a4);
      g.lineBetween(x, y, x, y + 33);
      g.fillStyle(0xd8e8d8);
      g.fillCircle(x, y, 4);
      const blades = this.add.graphics({ x, y });
      blades.lineStyle(3, 0xc1d6bf);
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        blades.lineBetween(0, 0, Math.cos(a) * 24, Math.sin(a) * 24);
      }
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        this.tweens.add({
          targets: blades,
          rotation: Math.PI * 2,
          duration: 9000,
          repeat: -1,
        });
    }
  }
  refreshTowers() {
    this.towersLayer.removeAll(true);
    const run = this.bridge.run;
    PADS.forEach((_p, i) => {
      const occupied = run.towers.some((t) => t.pad === i);
      this.padLayer.list[i * 2].setActive(!occupied);
      (this.padLayer.list[i * 2] as GameObjects.Shape).setVisible(!occupied);
      (this.padLayer.list[i * 2 + 1] as GameObjects.Text).setVisible(
        !occupied && run.stage === "deploy",
      );
    });
    for (const t of run.towers) {
      if (t.pad === null) continue;
      const p = PADS[t.pad],
        colour = colours[t.category];
      const base = this.add.graphics();
      base.fillStyle(0x071e27, 0.6);
      base.fillEllipse(p.x + 3, p.y + 16, 48, 23);
      base.fillStyle(0x14343b);
      base.fillCircle(p.x, p.y, 23);
      base.lineStyle(3, colour);
      base.strokeCircle(p.x, p.y, 20);
      base.fillStyle(colour, 0.18);
      base.fillCircle(p.x, p.y, 17);
      base.lineStyle(3, colour);
      if (t.category === "Prevent") {
        base.fillStyle(colour);
        base.fillTriangle(p.x, p.y - 13, p.x - 10, p.y + 6, p.x + 10, p.y + 6);
        base.fillRect(p.x - 3, p.y + 6, 6, 7);
      }
      if (t.category === "Detect") {
        base.strokeCircle(p.x, p.y, 10);
        base.lineBetween(p.x, p.y, p.x + 13, p.y - 13);
        base.fillStyle(colour);
        base.fillCircle(p.x, p.y, 3);
      }
      if (t.category === "Respond") {
        base.fillStyle(colour);
        base.fillRoundedRect(p.x - 4, p.y - 13, 8, 26, 2);
        base.fillRoundedRect(p.x - 13, p.y - 4, 26, 8, 2);
      }
      const label = this.add
        .text(p.x, p.y + 29, `${t.controlId} · ${"★".repeat(t.level)}`, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#e4f4e9",
          backgroundColor: "#122d32",
          padding: { x: 4, y: 3 },
        })
        .setOrigin(0.5);
      this.towersLayer.add([base, label]);
    }
  }
  beginBattle() {
    this.battle = new Battle(
      this.bridge.run.towers,
      this.bridge.run.health,
      this.bridge.run.phase,
      this.bridge.run.survivalWave,
    );
    this.effects = [];
  }
  resetBattle() {
    this.battle = null;
    this.effects = [];
    this.towerKey = "";
  }
  update(_time: number, delta: number) {
    if (!this.dynamic) return;
    const run = this.bridge.run;
    const key =
      run.stage + run.towers.map((t) => `${t.uid}:${t.pad}`).join("|");
    if (key !== this.towerKey) {
      this.towerKey = key;
      this.scale.refresh();
      this.refreshTowers();
    }
    const g = this.dynamic;
    g.clear();
    if (run.stage === "deploy" && this.hover >= 0) {
      const t = run.towers.find(
          (t) => t.uid === this.bridge.selected && t.pad === null,
        ),
        p = PADS[this.hover];
      if (t && !run.towers.some((t) => t.pad === this.hover)) {
        g.fillStyle(colours[t.category], 0.1);
        g.fillCircle(p.x, p.y, towerRange(t));
        g.lineStyle(1, colours[t.category], 0.5);
        g.strokeCircle(p.x, p.y, towerRange(t));
      }
    }
    const b = this.battle;
    if (!b || run.stage !== "battle") return;
    if (!this.bridge.paused && !document.hidden) {
      let dt = Math.min(delta / 1000, 0.1) * this.bridge.speed;
      while (dt > 0 && !b.done) {
        const step = Math.min(dt, 1 / 60);
        b.step(step);
        dt -= step;
        this.effects.push(
          ...b.shots.map((s) => ({
            ...s,
            colour: colours[s.category],
            life: 0.15,
          })),
        );
      }
      this.bridge.onTick(b);
    }
    for (const e of b.enemies) {
      const size = e.kind === "armoured" ? 13 : e.kind === "runner" ? 8 : 10;
      g.fillStyle(0x081f27, 0.5);
      g.fillEllipse(e.x + 3, e.y + size + 2, size * 2.5, 8);
      g.fillStyle(
        e.kind === "armoured"
          ? 0xbb8cea
          : e.kind === "runner"
            ? 0xffc378
            : 0xff887e,
      );
      g.fillRoundedRect(e.x - size, e.y - size, size * 2, size * 2, 4);
      g.fillStyle(0x4d2637);
      g.fillRect(e.x - 5, e.y - 3, 3, 4);
      g.fillRect(e.x + 3, e.y - 3, 3, 4);
      if (e.marked > 0) {
        g.lineStyle(1, 0x83bdff);
        g.strokeCircle(e.x, e.y, size + 6);
      }
      g.fillStyle(0x12282e);
      g.fillRect(e.x - 13, e.y - size - 8, 26, 3);
      g.fillStyle(0x91efbd);
      g.fillRect(e.x - 13, e.y - size - 8, 26 * Math.max(0, e.hp / e.maxHp), 3);
    }
    this.effects = this.effects.filter((e) => {
      if (!this.bridge.paused) e.life -= delta / 1000;
      g.lineStyle(2, e.colour, Math.max(0, e.life / 0.15));
      g.lineBetween(e.from.x, e.from.y, e.to.x, e.to.y);
      g.fillStyle(e.colour, Math.max(0, e.life * 4));
      g.fillCircle(e.to.x, e.to.y, 7);
      return e.life > 0;
    });
    if (b.done) {
      this.battle = null;
      this.bridge.onEnd(b);
    }
  }
}
