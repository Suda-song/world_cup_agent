import type { Player, MoodState } from "../types";

// 默认心情基线（中等水平球队）
function baseMood(over: number, isStar?: boolean): MoodState {
  return {
    pressure: isStar ? 68 : 50,
    confidence: Math.min(85, 45 + over * 0.35),
    fatigue: 38,
    motivation: isStar ? 82 : 70,
  };
}

let pid = 0;
function p(
  teamId: string,
  name: string,
  position: Player["position"],
  overall: number,
  mood?: Partial<MoodState>,
  isStar?: boolean
): Player {
  const b = baseMood(overall, isStar);
  return {
    id: `p${++pid}`,
    teamId,
    name,
    position,
    overall,
    isStar,
    mood: { ...b, ...mood },
  };
}

export const PLAYERS: Player[] = [
  // 阿根廷
  p("arg", "E. Martínez", "GK", 88, { confidence: 86, pressure: 70 }, true),
  p("arg", "C. Romero", "DF", 86, { confidence: 80 }),
  p("arg", "N. Molina", "DF", 82),
  p("arg", "R. De Paul", "MF", 84, { motivation: 88 }),
  p("arg", "E. Fernández", "MF", 86, { confidence: 82 }),
  p("arg", "L. Messi", "FW", 93, { confidence: 95, pressure: 85, motivation: 95 }, true),
  p("arg", "J. Álvarez", "FW", 86, { confidence: 84 }),
  p("arg", "L. Martínez", "FW", 85, { confidence: 82 }),

  // 法国
  p("fra", "M. Maignan", "GK", 87),
  p("fra", "W. Saliba", "DF", 85),
  p("fra", "T. Hernández", "DF", 84),
  p("fra", "A. Tchouaméni", "MF", 86),
  p("fra", "E. Camavinga", "MF", 85),
  p("fra", "K. Mbappé", "FW", 94, { confidence: 92, pressure: 82, motivation: 90 }, true),
  p("fra", "O. Dembélé", "FW", 87, { confidence: 80 }),
  p("fra", "M. Thuram", "FW", 84),

  // 西班牙
  p("esp", "U. Simón", "GK", 86),
  p("esp", "A. Laporte", "DF", 84),
  p("esp", "D. Cubarsí", "DF", 83, { confidence: 78, pressure: 60 }),
  p("esp", "Rodri", "MF", 92, { confidence: 88, pressure: 72, motivation: 88 }, true),
  p("esp", "Pedri", "MF", 89, { confidence: 85, fatigue: 50 }),
  p("esp", "Gavi", "MF", 85, { motivation: 84 }),
  p("esp", "Lamine Yamal", "FW", 90, { confidence: 86, pressure: 75, motivation: 86 }, true),
  p("esp", "N. Williams", "FW", 86, { confidence: 82 }),

  // 英格兰
  p("eng", "J. Pickford", "GK", 85),
  p("eng", "J. Stones", "DF", 85),
  p("eng", "K. Walker", "DF", 83),
  p("eng", "Declan Rice", "MF", 88, { confidence: 84 }),
  p("eng", "J. Bellingham", "MF", 90, { confidence: 88, pressure: 78, motivation: 88 }, true),
  p("eng", "P. Foden", "MF", 88, { confidence: 85, fatigue: 52 }),
  p("eng", "H. Kane", "FW", 90, { confidence: 86, pressure: 80, motivation: 86 }, true),
  p("eng", "B. Saka", "FW", 87, { confidence: 84 }),

  // 巴西
  p("bra", "Alisson", "GK", 89, { confidence: 86 }, true),
  p("bra", "Marquinhos", "DF", 86),
  p("bra", "G. Magalhães", "DF", 84),
  p("bra", "Bruno Guimarães", "MF", 87, { confidence: 83 }),
  p("bra", "Lucas Paquetá", "MF", 85),
  p("bra", "Vinícius Jr", "FW", 92, { confidence: 88, pressure: 76, motivation: 88 }, true),
  p("bra", "Rodrygo", "FW", 86, { confidence: 82 }),
  p("bra", "Endrick", "FW", 83, { confidence: 78, pressure: 64 }),

  // 葡萄牙
  p("por", "Diogo Costa", "GK", 85),
  p("por", "Rúben Dias", "DF", 87, { confidence: 84 }),
  p("por", "Nuno Mendes", "DF", 84),
  p("por", "Bruno Fernandes", "MF", 89, { confidence: 86, motivation: 86 }, true),
  p("por", "Vitinha", "MF", 86, { confidence: 82 }),
  p("por", "B. Silva", "MF", 87),
  p("por", "Cristiano Ronaldo", "FW", 86, { confidence: 84, pressure: 82, motivation: 92, fatigue: 58 }, true),
  p("por", "Rafael Leão", "FW", 87, { confidence: 83 }),

  // 荷兰
  p("ned", "B. Verbruggen", "GK", 83),
  p("ned", "V. van Dijk", "DF", 88, { confidence: 85, pressure: 70 }, true),
  p("ned", "D. Dumfries", "DF", 84),
  p("ned", "F. de Jong", "MF", 87, { confidence: 83, fatigue: 50 }),
  p("ned", "R. Gravenberch", "MF", 84),
  p("ned", "C. Gakpo", "FW", 85, { confidence: 82 }),
  p("ned", "M. Depay", "FW", 84, { motivation: 82 }),
  p("ned", "Xavi Simons", "FW", 85, { confidence: 80, pressure: 64 }),

  // 德国
  p("ger", "M. ter Stegen", "GK", 88, { confidence: 85 }, true),
  p("ger", "A. Rüdiger", "DF", 85),
  p("ger", "J. Kimmich", "MF", 88, { confidence: 85, pressure: 72, motivation: 86 }, true),
  p("ger", "R. Xhaka-style", "MF", 85),
  p("ger", "Jamal Musiala", "FW", 90, { confidence: 87, pressure: 74, motivation: 86 }, true),
  p("ger", "F. Wirtz", "FW", 88, { confidence: 84, fatigue: 52 }),
  p("ger", "K. Adeyemi", "FW", 84),
  p("ger", "N. Füllkrug", "FW", 82),

  // 比利时
  p("bel", "K. Casteels", "GK", 83),
  p("bel", "W. Faes", "DF", 82),
  p("bel", "A. Theate", "DF", 81),
  p("bel", "K. De Bruyne", "MF", 90, { confidence: 86, pressure: 78, fatigue: 56, motivation: 88 }, true),
  p("bel", "A. Onana", "MF", 83),
  p("bel", "J. Doku", "FW", 85, { confidence: 82 }),
  p("bel", "L. Openda", "FW", 84),
  p("bel", "R. Lukaku", "FW", 84, { pressure: 74 }),

  // 意大利
  p("ita", "G. Donnarumma", "GK", 88, { confidence: 85 }, true),
  p("ita", "A. Bastoni", "DF", 87, { confidence: 84 }),
  p("ita", "G. Dimarco", "DF", 84),
  p("ita", "N. Barella", "MF", 88, { confidence: 85, motivation: 86 }, true),
  p("ita", "S. Tonali", "MF", 85),
  p("ita", "D. Frattesi", "MF", 83),
  p("ita", "F. Chiesa", "FW", 84, { fatigue: 54 }),
  p("ita", "M. Retegui", "FW", 82),

  // 克罗地亚
  p("cro", "D. Livaković", "GK", 85, { confidence: 82 }, true),
  p("cro", "J. Gvardiol", "DF", 86, { confidence: 83 }),
  p("cro", "J. Stanišić", "DF", 82),
  p("cro", "L. Modrić", "MF", 86, { confidence: 84, pressure: 76, fatigue: 60, motivation: 90 }, true),
  p("cro", "M. Kovačić", "MF", 85),
  p("cro", "M. Pašalić", "MF", 82),
  p("cro", "A. Kramarić", "FW", 83),
  p("cro", "A. Budimir", "FW", 81),

  // 乌拉圭
  p("uru", "S. Rochet", "GK", 82),
  p("uru", "J. Giménez", "DF", 85, { confidence: 82 }),
  p("uru", "R. Araújo", "DF", 86, { confidence: 83 }),
  p("uru", "F. Valverde", "MF", 89, { confidence: 86, motivation: 86 }, true),
  p("uru", "M. Ugarte", "MF", 83),
  p("uru", "N. Nández", "MF", 82),
  p("uru", "D. Núñez", "FW", 85, { confidence: 80, pressure: 70 }),
  p("uru", "M. Araújo", "FW", 80),

  // 哥伦比亚
  p("col", "C. Vargas", "GK", 81),
  p("col", "D. Sánchez", "DF", 82),
  p("col", "D. Muñoz", "DF", 81),
  p("col", "J. Lerma", "MF", 83),
  p("col", "J. Quintero", "MF", 82),
  p("col", "J. Rodríguez", "MF", 84, { confidence: 80, fatigue: 56, motivation: 86 }, true),
  p("col", "L. Díaz", "FW", 87, { confidence: 84, motivation: 88 }, true),
  p("col", "J. Córdoba", "FW", 82),

  // 摩洛哥
  p("mar", "Y. Bounou", "GK", 85, { confidence: 83 }, true),
  p("mar", "N. Aguerd", "DF", 83),
  p("mar", "A. Hakimi", "DF", 86, { confidence: 84, motivation: 86 }, true),
  p("mar", "R. Saiss", "DF", 82),
  p("mar", "S. Amrabat", "MF", 83, { fatigue: 54 }),
  p("mar", "A. Ounahi", "MF", 82),
  p("mar", "H. Ziyech", "FW", 83, { confidence: 80 }),
  p("mar", "Y. En-Nesyri", "FW", 83),

  // 日本
  p("jpn", "Z. Suzuki", "GK", 82),
  p("jpn", "K. Tomiyasu", "DF", 83),
  p("jpn", "T. Itakura", "DF", 82),
  p("jpn", "W. Endo", "MF", 83, { motivation: 84 }),
  p("jpn", "H. Morita", "MF", 82),
  p("jpn", "T. Kubo", "FW", 85, { confidence: 82, motivation: 86 }, true),
  p("jpn", "K. Mitoma", "FW", 85, { confidence: 82, fatigue: 52 }),
  p("jpn", "A. Ueda", "FW", 81),

  // 美国
  p("usa", "M. Turner", "GK", 80),
  p("usa", "S. Robinson", "DF", 79),
  p("usa", "S. Dest", "DF", 80),
  p("usa", "T. Adams", "MF", 82, { motivation: 86 }, true),
  p("usa", "W. McKennie", "MF", 82),
  p("usa", "G. Reyna", "MF", 81, { confidence: 78 }),
  p("usa", "C. Pulisic", "FW", 85, { confidence: 82, pressure: 76, motivation: 88 }, true),
  p("usa", "F. Balogun", "FW", 82),

  // 墨西哥
  p("mex", "G. Ochoa", "GK", 81, { pressure: 74, motivation: 86 }, true),
  p("mex", "C. Salcedo", "DF", 78),
  p("mex", "J. Sánchez", "MF", 80),
  p("mex", "E. Álvarez", "MF", 81),
  p("mex", "L. Chávez", "MF", 80),
  p("mex", "H. Lozano", "FW", 82, { confidence: 80, motivation: 84 }, true),
  p("mex", "S. Giménez", "FW", 83, { confidence: 80 }),
  p("mex", "A. Vega", "FW", 79),

  // 塞内加尔
  p("sen", "É. Mendy", "GK", 83, { confidence: 80 }, true),
  p("sen", "K. Koulibaly", "DF", 83, { confidence: 80 }),
  p("sen", "I. Jakobs", "DF", 80),
  p("sen", "I. Gueye", "MF", 82, { motivation: 84 }),
  p("sen", "P. Gueye", "MF", 81),
  p("sen", "I. Sarr", "FW", 82, { confidence: 79 }),
  p("sen", "S. Mané", "FW", 85, { confidence: 82, pressure: 72, motivation: 88 }, true),
  p("sen", "B. Dia", "FW", 82),

  // 加拿大
  p("can", "M. Crépeau", "GK", 78),
  p("can", "M. Cornelius", "DF", 77),
  p("can", "A. Davies", "DF", 84, { confidence: 82, motivation: 86 }, true),
  p("can", "S. Eustáquio", "MF", 80),
  p("can", "J. Osorio", "MF", 79),
  p("can", "T. Buchanan", "FW", 80),
  p("can", "J. David", "FW", 84, { confidence: 81, motivation: 84 }, true),
  p("can", "C. Larin", "FW", 81),

  // 韩国
  p("kor", "Kim Seung-gyu", "GK", 80),
  p("kor", "Kim Min-jae", "DF", 85, { confidence: 82 }, true),
  p("kor", "Kim Young-gwon", "DF", 79),
  p("kor", "Hwang In-beom", "MF", 81),
  p("kor", "Lee Jae-sung", "MF", 80),
  p("kor", "Son Heung-min", "FW", 87, { confidence: 84, pressure: 78, motivation: 90 }, true),
  p("kor", "Lee Kang-in", "FW", 83, { confidence: 80 }),
  p("kor", "Hwang Hee-chan", "FW", 82),

  // 瑞士
  p("sui", "Y. Sommer", "GK", 84, { confidence: 81 }, true),
  p("sui", "M. Akanji", "DF", 85, { confidence: 82 }),
  p("sui", "R. Rodríguez", "DF", 80),
  p("sui", "G. Xhaka", "MF", 86, { confidence: 83, motivation: 84 }, true),
  p("sui", "R. Freuler", "MF", 81),
  p("sui", "X. Shaqiri", "FW", 82, { fatigue: 56 }),
  p("sui", "D. Embolo", "FW", 82, { confidence: 79 }),
  p("sui", "R. Vargas", "FW", 80),

  // 丹麦
  p("den", "K. Schmeichel", "GK", 82, { pressure: 70 }, true),
  p("den", "A. Christensen", "DF", 83),
  p("den", "J. Andersen", "DF", 81),
  p("den", "P. Højlund", "FW", 82, { confidence: 79 }),
  p("den", "C. Eriksen", "MF", 84, { confidence: 81, fatigue: 58, motivation: 86 }, true),
  p("den", "M. Højbjerg", "MF", 82),
  p("den", "J. Wind", "FW", 79),
  p("den", "M. Damsgaard", "FW", 80),

  // 挪威
  p("nor", "Ø. Nyland", "GK", 80),
  p("nor", "K. Ajer", "DF", 80),
  p("nor", "L. Østigård", "DF", 79),
  p("nor", "S. Berge", "MF", 81),
  p("nor", "M. Ødegaard", "MF", 87, { confidence: 84, pressure: 74, motivation: 88 }, true),
  p("nor", "P. Sørloth", "FW", 82),
  p("nor", "E. Haaland", "FW", 92, { confidence: 90, pressure: 80, motivation: 90 }, true),
  p("nor", "A. Sørloth", "FW", 80),

  // 奥地利
  p("aut", "P. Pentz", "GK", 79),
  p("aut", "M. Danso", "DF", 80),
  p("aut", "K. Laimer", "MF", 83, { motivation: 84 }),
  p("aut", "M. Sabitzer", "MF", 84, { confidence: 81, motivation: 84 }, true),
  p("aut", "N. Seiwald", "MF", 80),
  p("aut", "M. Arnautović", "FW", 81, { fatigue: 58, pressure: 70 }),
  p("aut", "P. Wimmer", "FW", 79),
  p("aut", "M. Gregoritsch", "FW", 79),

  // 乌克兰
  p("ukr", "A. Lunin", "GK", 83, { confidence: 80 }, true),
  p("ukr", "I. Zabarnyi", "DF", 82),
  p("ukr", "O. Zinchenko", "DF", 82, { motivation: 86 }),
  p("ukr", "R. Sudakov", "MF", 82, { confidence: 79 }),
  p("ukr", "T. Stepanenko", "MF", 80),
  p("ukr", "M. Mudryk", "FW", 82, { confidence: 78 }),
  p("ukr", "A. Dovbyk", "FW", 84, { confidence: 81, motivation: 84 }, true),
  p("ukr", "V. Tsyhankov", "FW", 82),
];

export const PLAYER_MAP: Record<string, Player[]> = PLAYERS.reduce(
  (acc, pl) => {
    (acc[pl.teamId] ||= []).push(pl);
    return acc;
  },
  {} as Record<string, Player[]>
);

export function playersOf(teamId: string): Player[] {
  return PLAYER_MAP[teamId] ?? [];
}
