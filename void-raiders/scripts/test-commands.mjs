// node scripts/test-commands.mjs — prueba matchLocalCommand sin API
import { matchLocalCommand, includesKeyword, normalize } from "../src/ai/commands.ts";

const weapons = [
  ["misiles", "missiles"],
  ["cohetes", "missiles"],
  ["láser", "laser"],
  ["plasma", "plasma"],
  ["rafaga", "burst"],
  ["railgun", "railgun"],
  ["cañon rail", "railgun"],
  ["flak", "flak"],
  ["antiaerea", "flak"],
];

const noWeapon = [
  ["canonical", null],
  ["ve mas rapido", null],
  ["estado tactico", "tactical_info"],
];

let fail = 0;
for (const [phrase, expect] of weapons) {
  const r = matchLocalCommand(phrase);
  const w = r?.params?.weapon;
  if (r?.action !== "change_weapon" || w !== expect) {
    console.log("FAIL", phrase, r);
    fail++;
  } else console.log("OK", phrase, "->", w);
}

for (const [phrase, expect] of noWeapon) {
  const r = matchLocalCommand(phrase);
  const action = expect === "tactical_info" ? "tactical_info" : "change_weapon";
  const bad = expect === null ? r?.action === "change_weapon" : r?.action !== expect;
  if (bad) {
    console.log("FAIL", phrase, r?.action, r?.params);
    fail++;
  } else console.log("OK no-weapon", phrase);
}

if (includesKeyword(normalize("canonical"), "canon")) {
  console.log("FAIL canon in canonical");
  fail++;
}

console.log(fail ? `\n${fail} failed` : "\nAll passed");
process.exit(fail ? 1 : 0);
