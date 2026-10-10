import { Game, AUTO, Scale } from "phaser";
import { DefenseScene, type Bridge } from "./scenes/Game";
export function startGame(bridge: Bridge) {
  const scene = new DefenseScene(bridge);
  const game = new Game({
    type: AUTO,
    parent: "game-container",
    width: 1000,
    height: 620,
    backgroundColor: "#173637",
    scale: { mode: Scale.FIT, autoCenter: Scale.CENTER_BOTH },
    render: { antialias: true },
    scene: [scene],
    audio: { noAudio: true },
    banner: false,
  });
  return { game, scene };
}
