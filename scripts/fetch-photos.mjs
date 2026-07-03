// Auto-resolve player headshot URLs from TheSportsDB and write to
// lib/data/playerPhotos.generated.json.
//
// Validation triple: strSport=="Soccer" + nationality matches team country +
// (if our name has a "X." initial) resolved first name starts with that letter.
// Only all-three-pass results are accepted; everything else → graceful fallback.
//
// Usage:  node scripts/fetch-photos.mjs
// Rate:  ~1 req / 450ms → ~200 players ≈ ~90s.  TheSportsDB free key "3".

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dir, "..");

// ── teamId → nationality aliases (case-insensitive substring match) ───────────
const NATIONALITY = {
  arg: ["argentina"],
  fra: ["france"],
  esp: ["spain"],
  eng: ["england"],
  bra: ["brazil"],
  por: ["portugal"],
  ned: ["netherlands", "dutch", "holland"],
  ger: ["germany"],
  bel: ["belgium"],
  tur: ["turkey", "türkiye"],
  cro: ["croatia"],
  uru: ["uruguay"],
  col: ["colombia"],
  mar: ["morocco"],
  jpn: ["japan"],
  usa: ["usa", "united states", "american"],
  mex: ["mexico"],
  sen: ["senegal"],
  can: ["canada"],
  kor: ["south korea", "korea republic", "korean"],
  sui: ["switzerland"],
  den: ["denmark"],
  nor: ["norway"],
  aut: ["austria"],
  ukr: ["ukraine"],
  civ: ["côte d'ivoire", "ivory coast"],
  ecu: ["ecuador"],
  gha: ["ghana"],
  pan: ["panama"],
  alg: ["algeria"],
  crc: ["costa rica"],
  nga: ["nigeria"],
  jam: ["jamaica"],
  mli: ["mali"],
  irn: ["iran"],
  par: ["paraguay"],
  tun: ["tunisia"],
  irq: ["iraq"],
  nzl: ["new zealand"],
  jor: ["jordan"],
  uzb: ["uzbekistan"],
  ksa: ["saudi arabia"],
  egy: ["egypt"],
  cmr: ["cameroon"],
  aus: ["australia"],
  cpv: ["cape verde", "cabo verde"],
  qat: ["qatar"],
};

function nationalityMatch(resolved, teamId) {
  if (!resolved || !teamId) return false;
  const aliases = NATIONALITY[teamId] || [];
  const r = resolved.toLowerCase();
  return aliases.some((a) => r.includes(a));
}

// Extract the "X." initial from an abbreviated name ("L. Messi" → "L").
function getInitial(name) {
  const m = name.match(/^([A-ZÀ-Ö])\./);
  return m ? m[1].toUpperCase() : null;
}

// Build the search query: strip "X." initial, use remaining full form.
function buildQuery(name) {
  // "L. Messi" → "Messi"
  // "Son Heung-min" → "Son Heung-min"
  // "Lamine Yamal" → "Lamine Yamal"
  return name.replace(/^[A-Za-zÀ-ÿ]\.\s*/, "").trim();
}

// Parse players.ts and extract [{name, teamId}].
function parsePlayers() {
  const src = fs.readFileSync(path.join(ROOT, "lib/data/players.ts"), "utf8");
  const re = /p\("([^"]+)",\s*"([^"]+)"/g;
  const result = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    result.push({ teamId: m[1], name: m[2] });
  }
  return result;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch JSON with retry — the free key rate-limits and returns empty bodies.
async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (text && text.trim().startsWith("{")) return JSON.parse(text);
    } catch {
      /* retry */
    }
    await sleep(3000 + i * 2000); // back off on empty/rate-limit
  }
  return null;
}

async function fetchPhoto(name, teamId) {
  const query = buildQuery(name);
  const initial = getInitial(name);
  const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(query)}`;
  const data = await getJson(url);
  if (!data) return null;

  const players = data?.player;
  if (!Array.isArray(players) || players.length === 0) return null;

  for (const p of players) {
    if (p.strSport !== "Soccer") continue;
    if (!nationalityMatch(p.strNationality, teamId)) continue;
    // Initial check: if we have "X." prefix, ensure first name starts with X.
    if (initial) {
      const firstName = (p.strPlayer || "").split(" ")[0].toUpperCase();
      if (firstName[0] !== initial) continue;
    }
    const photo = p.strCutout || p.strThumb;
    if (photo && photo.startsWith("http")) return photo;
  }
  return null;
}

async function main() {
  const players = parsePlayers();
  const outPathEarly = path.join(ROOT, "lib/data/playerPhotos.generated.json");
  // Incremental: keep already-resolved entries, only fetch the missing ones.
  let out = {};
  try {
    out = JSON.parse(fs.readFileSync(outPathEarly, "utf8"));
  } catch {
    out = {};
  }
  const todo = players.filter((p) => !out[p.name]);
  console.log(`📋 ${players.length} players; ${Object.keys(out).length} already resolved; fetching ${todo.length} missing...`);

  let resolved = 0;
  let skipped = 0;

  for (let i = 0; i < todo.length; i++) {
    const { name, teamId } = todo[i];
    const photo = await fetchPhoto(name, teamId);
    if (photo) {
      out[name] = photo;
      resolved++;
      process.stdout.write(`✓ ${name} (${teamId})\n`);
      // Persist after each hit so progress survives a mid-run rate-limit.
      fs.writeFileSync(outPathEarly, JSON.stringify(out, null, 2), "utf8");
    } else {
      skipped++;
      process.stdout.write(`· ${name} (${teamId})\n`);
    }
    if (i < todo.length - 1) await sleep(1300);
  }

  fs.writeFileSync(outPathEarly, JSON.stringify(out, null, 2), "utf8");
  console.log(`\n✅ Newly resolved ${resolved}/${todo.length}, skipped ${skipped}. Total: ${Object.keys(out).length}`);
  console.log(`   → ${outPathEarly}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
