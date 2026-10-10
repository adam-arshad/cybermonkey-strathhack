import type { Tower, Point, Category } from "./types.ts";
import { PADS, ROUTE_LENGTH, pointOnRoute, distance } from "./map.ts";
export interface Enemy extends Point {
  id: number;
  progress: number;
  hp: number;
  maxHp: number;
  speed: number;
  slow: number;
  marked: number;
  fireCooldown: number;
  kind: "packet" | "runner" | "armoured";
}
export interface Shot {
  from: Point;
  to: Point;
  category: Category;
}
export interface EnemyShot {
  from: Point;
  to: Point;
}
export function waveSpec(phase: number, survival: number) {
  if (survival === 0)
    return {
      count: 5 + phase,
      hp: 7 + phase * 3,
      speed: 100,
      interval: 0.85,
      leak: 2,
    };
  return {
    count: 10 + survival * 3,
    hp: 22 * Math.pow(1.3, survival - 1),
    speed: 105 + Math.min(100, survival * 6),
    interval: Math.max(0.25, 0.8 - survival * 0.04),
    leak: 7 + Math.floor(survival / 3),
  };
}
export const towerRange = (t: Tower) =>
  t.category === "Detect" ? 150 + t.level * 12 : 115 + t.level * 13;
export class Battle {
  towers: Tower[];
  enemies: Enemy[] = [];
  health: number;
  kills = 0;
  leaks = 0;
  spawned = 0;
  elapsed = 0;
  done = false;
  shots: Shot[] = [];
  enemyShots: EnemyShot[] = [];
  cooldowns = new Map<string, number>();
  spec: ReturnType<typeof waveSpec>;
  survival: number;
  constructor(
    towers: Tower[],
    health: number,
    phase: number,
    survival: number,
  ) {
    // Towers retain damage across phases and survival waves.
    this.towers = towers.filter((t) => t.pad !== null && t.hp > 0);
    this.health = health;
    this.survival = survival;
    this.spec = waveSpec(phase, survival);
  }
  step(dt: number) {
    this.shots = [];
    this.enemyShots = [];
    if (this.done) return;
    const step = Math.min(Math.max(dt, 0), 0.05);
    this.elapsed += step;
    if (
      this.spawned < this.spec.count &&
      this.elapsed >= this.spawned * this.spec.interval
    ) {
      const kind =
        this.survival >= 3 && this.spawned % 6 === 0
          ? "armoured"
          : this.survival >= 2 && this.spawned % 4 === 0
            ? "runner"
            : "packet";
      const hp =
        this.spec.hp *
        (kind === "armoured" ? 2.2 : kind === "runner" ? 0.7 : 1);
      this.enemies.push({
        id: this.spawned,
        progress: 0,
        hp,
        maxHp: hp,
        speed:
          this.spec.speed *
          (kind === "runner" ? 1.6 : kind === "armoured" ? 0.7 : 1),
        slow: 0,
        marked: 0,
        fireCooldown: 0,
        kind,
        ...pointOnRoute(0),
      });
      this.spawned++;
    }
    for (const e of this.enemies) {
      e.progress += e.speed * (e.slow > 0 ? 0.65 : 1) * step;
      e.slow = Math.max(0, e.slow - step);
      e.marked = Math.max(0, e.marked - step);
      Object.assign(e, pointOnRoute(e.progress));
    }
    for (const t of this.towers) {
      if (t.hp <= 0) continue;
      const cd = (this.cooldowns.get(t.uid) ?? 0) - step;
      this.cooldowns.set(t.uid, cd);
      if (cd > 0) continue;
      const p = PADS[t.pad!];
      const targets = this.enemies
        .filter((e) => e.hp > 0 && distance(p, e) <= towerRange(t))
        .sort((a, b) => b.progress - a.progress);
      const target = targets[0];
      if (!target) continue;
      this.cooldowns.set(
        t.uid,
        t.category === "Detect" ? 0.8 : t.category === "Respond" ? 1.1 : 0.55,
      );
      this.shots.push({
        from: p,
        to: { x: target.x, y: target.y },
        category: t.category,
      });
      if (t.category === "Detect") {
        target.slow = 1.5;
        target.marked = 2;
        target.hp -= t.level * 1.5;
      } else if (t.category === "Respond") {
        for (const e of this.enemies)
          if (distance(e, target) < 65)
            e.hp -= t.level * 3 * (e.marked > 0 ? 1.3 : 1);
      } else target.hp -= t.level * 3.5 * (target.marked > 0 ? 1.3 : 1);
    }
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.progress >= ROUTE_LENGTH) continue;
      e.fireCooldown -= step;
      if (e.fireCooldown > 0) continue;
      const target = this.towers
        .filter((t) => t.hp > 0 && distance(e, PADS[t.pad!]) <= 105)
        .sort((a, b) => distance(e, PADS[a.pad!]) - distance(e, PADS[b.pad!]))[0];
      if (!target) continue;
      target.hp = Math.max(0, target.hp - 1);
      e.fireCooldown = 1.8;
      this.enemyShots.push({
        from: { x: e.x, y: e.y },
        to: PADS[target.pad!],
      });
    }
    this.enemies = this.enemies.filter((e) => {
      if (e.hp <= 0) {
        this.kills++;
        return false;
      }
      if (e.progress >= ROUTE_LENGTH) {
        this.leaks++;
        this.health = Math.max(
          this.survival ? 0 : 1,
          this.health - this.spec.leak,
        );
        return false;
      }
      return true;
    });
    if (
      this.health <= 0 ||
      (this.spawned === this.spec.count && this.enemies.length === 0)
    )
      this.done = true;
  }
}
