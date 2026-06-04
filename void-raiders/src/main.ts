// Entry point: inicializa Game

import "./styles.css";
import { soundManager } from "./audio/SoundManager";
import { Game } from "./game/Game";
import { MenuScene } from "./game/scenes/MenuScene";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("No se encontró el contenedor #app");

soundManager.init();

const game = new Game(app);
game.changeScene(new MenuScene(game));
game.start();
