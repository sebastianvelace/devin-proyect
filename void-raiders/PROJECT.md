# VOID RAIDERS — Game Design Document

## Concepto

Space shooter top-down arcade con estética neon cyberpunk y un copiloto IA controlado por voz. El jugador pilota una nave, destruye oleadas de enemigos generadas dinámicamente, y puede cambiar de arma hablándole al copiloto IA **NOVA**. 3 niveles + boss final. Partida completa ~3 minutos.

Proyecto para la **Hackathon de Platzi + Devin by Cognition** (Junio 3, 2026, Bogotá).

---

## Stack técnico

| Capa | Tecnología |
|------|------------|
| Build | Vite + TypeScript vanilla (game loop puro, **no React**) |
| Render | HTML Canvas 2D para todo el render |
| Voz | Web Speech API (`SpeechRecognition`) para input de voz del jugador |
| IA | Anthropic Claude API (`claude-sonnet-4-20250514`) para interpretar comandos y generar tácticas |
| UI overlay | CSS para menús, HUD, copiloto |
| Tipografía | Google Fonts: **Orbitron** (títulos), **Exo 2** (cuerpo), **JetBrains Mono** (HUD/datos) |
| Deploy | Vercel |

### Estructura de código (scaffold)

```
src/
├── main.ts                 # Entry point, inicializa Game
├── types.ts                # Todos los tipos/interfaces del juego
├── game/
│   ├── Game.ts             # Game loop, delta time, scene manager
│   ├── scenes/             # Menu, Game, Transition, GameOver, Victory
│   ├── entities/           # Player, Enemy, Boss, Bullet, PowerUp, Particle
│   ├── systems/            # Particles, Collision, Waves, Input, Camera, Weapons
│   └── ui/                 # HUD, CopilotUI
├── ai/                     # CopilotBrain, VoiceListener, ClaudeService, commands
├── utils/                  # math, pool
└── styles.css              # Estilos globales y overlays
```

---

## Copiloto IA "NOVA" (FEATURE CORE)

Esta es la pieza diferenciadora del hackathon: el jugador habla con NOVA durante el combate y el juego responde siempre, con o sin API.

### Flujo de voz

1. **Web Speech API** escucha continuamente durante el gameplay (`lang: 'es-CO'`).
2. Cuando detecta una frase, la **transcribe** a texto.
3. El texto se envía a **Claude API** con el **game state compacto**.
4. Claude responde con JSON: `{ action, params, copilot_message }` (campo `message` en el prompt del sistema).
5. El juego **ejecuta la acción** y muestra el mensaje del copiloto en el HUD.

### System prompt de NOVA

```
Eres NOVA, la IA copiloto de una nave espacial de combate. El piloto te habla por voz durante el combate. Tu trabajo es interpretar sus comandos y responder con acciones. Responde SOLO en JSON: { action: string, params: object, message: string }.

Acciones disponibles:
- change_weapon: { weapon: 'laser'|'missiles'|'plasma'|'burst' } — cuando el piloto pide cambiar arma
- activate_shield: {} — cuando pide escudo o defensa
- deploy_bomb: {} — cuando pide bomba o limpiar pantalla
- tactical_info: {} — cuando pide info del estado de batalla
- none: {} — si no entiendes o no es un comando

El mensaje debe ser corto (máx 8 palabras), en español, con personalidad militar pero con humor sutil. Ejemplos: '¡Misiles cargados, a darles!', 'Escudo arriba, aguanta piloto', '¿Qué dijiste? Hay mucho ruido aquí'.

Si recibes game_state con datos tácticos, puedes generar advertencias proactivas: '¡Tanque por la izquierda!', 'Boss cambiando de fase, cuidado'.
```

### Comandos de voz reconocidos (fallback local sin API)

El archivo `src/ai/commands.ts` debe implementar un parser local que detecte keywords **sin necesidad de API**:

| Frases / keywords | Acción |
|-------------------|--------|
| "láser" / "laser" | `change_weapon: { weapon: 'laser' }` |
| "misil" / "misiles" / "cohetes" | `change_weapon: { weapon: 'missiles' }` |
| "plasma" | `change_weapon: { weapon: 'plasma' }` |
| "ráfaga" / "rafaga" / "rápido" | `change_weapon: { weapon: 'burst' }` |
| "escudo" / "defensa" / "protección" | `activate_shield` |
| "bomba" / "boom" / "explotar" / "limpiar" | `deploy_bomb` |
| "estado" / "reporte" / "cómo vamos" | `tactical_info` |

**Regla crítica:** el juego **SIEMPRE** debe responder al jugador, con o sin API. Si la API falla o tiene latencia, `commands.ts` actúa de inmediato; Claude enriquece cuando esté disponible.

### Advertencias tácticas proactivas

- Cada **10 segundos** durante gameplay, enviar game state compacto a Claude:
  ```json
  {
    "player_health": number,
    "player_position_quadrant": "TL|TR|BL|BR|C",
    "enemy_count": number,
    "enemy_types_on_screen": string[],
    "current_weapon": string,
    "boss_phase": number | null,
    "score": number
  }
  ```
- Claude puede responder con una **advertencia táctica** que aparece en el panel del copiloto.
- Si la API tiene latencia, **NO bloquear** el game loop — usar cola async y mostrar el mensaje cuando llegue.

### UI del copiloto

- Panel **semi-transparente** en esquina inferior izquierda.
- Icono de NOVA: rombo cyan con punto brillante (Canvas o CSS).
- Indicador de **"escuchando"** (onda pulsante cuando el mic está activo).
- Último mensaje de NOVA con **fade-out después de 4 segundos**.
- Indicador de **arma activa** con nombre e ícono simple.

---

## Armas

| Arma | Color | Comportamiento | Cadencia | Daño |
|------|-------|----------------|----------|------|
| Laser | Cyan `#00ffff` | Bala recta, rápida, precisa | 150ms | 1 |
| Missiles | Naranja `#ff8800` | 2 balas con leve homing hacia enemigo más cercano | 400ms | 2 |
| Plasma | Magenta `#ff00ff` | Bala grande y lenta que atraviesa enemigos | 500ms | 3 |
| Burst | Amarillo `#ffff00` | Ráfaga de 5 balas en abanico | 600ms | 1 c/u |

- El jugador **empieza con Laser**.
- Puede cambiar en cualquier momento hablándole a NOVA (voz) o vía fallback local.

---

## Controles

| Input | Acción |
|-------|--------|
| **WASD** | Movimiento libre en 8 direcciones (normalización diagonal) |
| **Mouse** | La nave rota para apuntar hacia el cursor |
| **Click izquierdo (hold)** | Disparo automático según cadencia del arma activa |
| **Espacio** | Deploy bomb (si tiene cargada) |
| **Voz** | Comandos a NOVA (ver sección copiloto) |

**Restricción:** la nave **NO sale del canvas**.

---

## Nave del jugador

- Triángulo/flecha **cyan** dibujado en Canvas, glow sutil.
- **Trail** de partículas al moverse (color del arma activa).
- **3 vidas**, hitbox circular **menor** que el visual.
- Al recibir daño: flash rojo + **1.5s invulnerabilidad** con parpadeo.
- Al morir: explosión de partículas cyan.

---

## Enemigos (formas geométricas neon)

| Tipo | Forma | Color | Velocidad | HP | Puntos | Comportamiento |
|------|-------|-------|-----------|-----|--------|----------------|
| basic | Rombo | `#ff0040` | Normal | 1 | 100 | Va hacia el jugador, dispara cada 2s |
| fast | Triángulo pequeño | `#ffff00` | 2× | 1 | 150 | Zigzag, no dispara |
| tank | Hexágono grande | `#ff00ff` | 0.5× | 3 | 300 | Lento, ráfaga de 3 balas |
| sniper | Línea delgada | `#00ff40` | 0 (estático) | 2 | 250 | Se posiciona lejos, dispara bala rápida cada 3s |
| bomber | Círculo | `#ff8800` | Normal | 2 | 200 | Se acerca y explota en AoE al morir o al llegar cerca |

Factory en `Enemy.ts`; comportamiento por tipo en update loop.

---

## Boss final (después de nivel 3)

- Pantalla de transición: **"WARNING: BOSS APPROACHING"** rojo parpadeante.
- **Octágono** grande rojo/magenta con piezas internas.
- **30 HP**, barra de vida visible arriba.
- Nombre: **"VOID SENTINEL"** (hardcodeado o generado).
- NOVA reacciona a cada fase del boss con comentarios (vía Claude o líneas fallback).

### Fases

| Fase | HP | Comportamiento |
|------|-----|----------------|
| **1** | 30–20 | Abanico cada 2s + spawna 2 basic cada 5s |
| **2** | 20–10 | Color amarillo, más rápido, abanico + circular |
| **3** | 10–0 | Color blanco, persigue jugador, todos los ataques |

- Al morir: explosión masiva multicolor + **slow motion 0.5s**.

---

## Power-ups (15% drop rate)

Cuadrado girando con glow del color indicado:

| Power-up | Color | Efecto |
|----------|-------|--------|
| Multi-shot | Azul | 3 balas en abanico, 8s |
| Shield | Cyan | Absorbe 1 golpe, visible como anillo |
| Speed | Amarillo | Velocidad 1.5×, 6s |
| Damage | Rojo | 2× daño, 8s |
| Bomb | Blanco | Se almacena; activa con **Espacio** o voz |

---

## Sistema de puntaje

- Puntos por kill según tipo de enemigo (tabla arriba).
- **Combo:** kills en <2s incrementan multiplicador (×2 → ×3 → ×4 → ×5 máx).
- Texto **"x3 COMBO!"** en centro con fade.
- Bonus nivel **sin daño:** +1000.
- Bonus nivel **rápido** (<30s): +500.

---

## Estructura de niveles

Cada nivel tiene **N oleadas** definidas. La IA puede generar la config en el futuro; hay **fallback hardcodeado** en `WaveManager.ts`.

### Nivel 1 — "First Contact"

| Oleada | Composición | Formación |
|--------|-------------|-----------|
| 1 | 4 basic | line |
| 2 | 3 basic + 2 fast | random |
| 3 | 5 basic + 2 fast | v_formation |

### Nivel 2 — "Nebula of the Forgotten"

| Oleada | Composición | Formación |
|--------|-------------|-----------|
| 1 | 3 basic + 2 fast + 1 tank | random |
| 2 | 4 fast + 2 sniper | circle |
| 3 | 3 tank + 3 basic + 2 bomber | random |

### Nivel 3 — "Edge of the Void"

| Oleada | Composición | Formación |
|--------|-------------|-----------|
| 1 | 4 sniper + 3 fast | random |
| 2 | 2 tank + 4 bomber + 3 basic | spiral |
| 3 | 5 fast + 3 tank + 2 sniper + 2 bomber | random |

### Boss — "The Void Sentinel"

Solo el boss + spawns periódicos según fase.

**Formaciones:** `line`, `random`, `v_formation`, `circle`, `spiral` — posiciones relativas al borde superior del canvas.

---

## Pantallas del juego

### 1. MenuScene — Inicio

- Fondo negro con **starfield parallax** (3 capas).
- Título **"VOID RAIDERS"** en Orbitron, cyan, letter-spacing amplio.
- Subtítulo: *"AI-Powered Space Shooter"*.
- Nave flotando con animación idle.
- Botón **`[ LAUNCH MISSION ]`** neon cyan.
- Hint: *"WASD move · Mouse aim · Click shoot · Talk to NOVA"*.
- Botón **`[ ENABLE MIC ]`** para pedir permiso de micrófono antes de jugar.

### 2. GameScene — Gameplay

- Canvas con starfield parallax.
- HUD overlay (score, level, vidas, combo, arma activa, power-up timer).
- Panel de NOVA (esquina inferior izquierda).
- Barra de progreso del nivel (top).

### 3. TransitionScene — Entre niveles

- **"WARPING TO [NOMBRE NIVEL]..."**
- Efecto **star-warp** (estrellas se estiran hacia el centro).
- Stats del nivel completado (kills, accuracy, bonus).
- NOVA dice algo motivacional.
- **3 segundos**, auto-avanza.

### 4. GameOverScene — Muerte

- **"MISSION FAILED"** rojo con glow.
- NOVA: *"Volveremos más fuertes, piloto"* (o variante Claude).
- Score final + stats (kills, nivel, combo máx, tiempo).
- **`[ RETRY ]`** y **`[ MAIN MENU ]`**.

### 5. VictoryScene — Victoria

- **"VOID CLEARED"** dorado con brillo.
- NOVA: *"Misión cumplida. Fue un honor, piloto."*
- Score + ranking:
  - **S** > 15000
  - **A** > 10000
  - **B** > 5000
  - **C** resto
- Stats completas.
- Partículas doradas.
- **`[ PLAY AGAIN ]`** y **`[ MAIN MENU ]`**.

---

## Estética visual

- Fondo: `#0a0a0f` con gradiente radial azul oscuro sutil.
- Todo **neon sobre negro**: cyan jugador, rojo/magenta/amarillo enemigos.
- **Glow** vía múltiples `canvas` shadows o post-processing simple.
- **Partículas** en todo: trails, explosiones, ambient dust.
- **Screen shake** en explosiones (2–4px, 200ms) — `Camera.ts`.
- **Slow motion** en momentos clave (muerte del boss, game over).
- **Vignette** oscuro en bordes del canvas.
- Target **60fps** con delta time.
- **Object pooling** para balas y partículas.

---

## Requisitos de rendimiento

- `requestAnimationFrame` con **delta time** (cap opcional para evitar saltos tras tab inactivo).
- **Object pool** para `Bullet` y `Particle` (no crear/destruir cada frame).
- Canvas resolution con **`devicePixelRatio`**.
- Web Speech API: `continuous=true`, `interimResults=true`.
- Claude API calls **async**, nunca bloquean el game loop.
- **Fallback local** de comandos para latencia ~0 en acciones críticas.

---

## API Integration (Claude)

| Parámetro | Valor |
|-----------|-------|
| Endpoint | `POST https://api.anthropic.com/v1/messages` |
| Model | `claude-sonnet-4-20250514` |
| API key | `VITE_ANTHROPIC_API_KEY` (ver `.env.example`) |
| Max tokens | 150 (respuestas cortas del copiloto) |

### Tipos de llamada

1. **Comando de voz:** transcripción + game state → acción + mensaje.
2. **Táctica proactiva:** game state periódico (cada 10s) → advertencia opcional.

**SIEMPRE** tener fallback si la API falla (`commands.ts` + mensajes locales en `CopilotBrain.ts`).

### Respuesta esperada (ejemplo)

```json
{
  "action": "change_weapon",
  "params": { "weapon": "missiles" },
  "message": "¡Misiles cargados, a darles!"
}
```

---

## Configuración y deploy

| Archivo | Propósito |
|---------|-----------|
| `vercel.json` | `buildCommand: npm run build`, `outputDirectory: dist` |
| `.env.example` | Plantilla para `VITE_ANTHROPIC_API_KEY` |
| `.gitignore` | `node_modules`, `dist`, `.env` |
| `tsconfig.json` | Config Vite (no modificar salvo necesidad) |

### Variables de entorno

```bash
# .env (local, no commitear)
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

---

## Roadmap de implementación (sugerido)

1. **Game loop + scenes** — `Game.ts`, cambio de escenas, canvas setup.
2. **Player + Input + Weapons** — movimiento, rotación, disparo, límites canvas.
3. **Enemies + Waves + Collision** — factory, oleadas nivel 1, colisión circular.
4. **Particles + Camera** — pool, explosiones, screen shake.
5. **HUD + niveles 2–3 + Boss** — progresión completa.
6. **Power-ups + scoring + combo** — economía de partida.
7. **NOVA fallback** — `commands.ts`, `VoiceListener.ts`, UI copiloto.
8. **Claude integration** — `ClaudeService.ts`, `CopilotBrain.ts`, cola async.
9. **Pulido** — transiciones, victory/game over, ranking, deploy Vercel.

---

## Criterios de éxito (hackathon demo)

- [ ] Partida jugable de principio a fin (~3 min).
- [ ] Cambio de arma por **voz** perceptible en demo (<500ms con fallback).
- [ ] NOVA visible y “reactiva” (mensajes + escucha).
- [ ] Al menos una llamada Claude exitosa en demo (comando o táctica).
- [ ] Estética neon coherente a 60fps en laptop estándar.
- [ ] Deploy Vercel con README mínimo de setup.

---

*VOID RAIDERS — Platzi × Devin Hackathon 2026*
