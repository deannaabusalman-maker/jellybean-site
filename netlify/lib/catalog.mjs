// Prices live HERE on the server, so nobody can change a price in their browser.
// To add a new shop slime: add a line to SHOP (and an "Add to cart" button on index.html).

export const SHOP = {
  "iced-lemonade": { name: "Iced Lemonade slime (6 oz)", price: 12, jars6: 1 },
  "fairy-floss":   { name: "Fairy Floss slime (6 oz)",   price: 12, jars6: 1 },
  "mystery":       { name: "Mystery Slime Pack (3 x 4 oz)", price: 20, jars4: 3 },
};

// Build your own (same menu as build.html)
const BASES = { butter: 12, cloud: 12, glossy: 12, clear: 12 };
const DELUXE = { none: 0, perlite: 1, bingsu: 2, pumice: 2, frosting: 1, cloud: 1, clouddough: 1, foamcrunch: 2 };
const DELUXE_INCLUDES = { perlite: ["perlite"], bingsu: ["bingsu"], foamcrunch: ["foam"] };
const ADDINS = { foam: 1, bingsu: 1, jelly: 1, perlite: 1, clay: 1, charms: 1 };
const EXTRA = { reg: 0, xtra: 0.5, xtra2: 1 }; // charms have no amount choice
const MAX_ADDINS = 5;

export const MAX_QTY = 10;
export const MAX_LINES = 20;

export const clean = (s, n) => String(s || "").replace(/[\u0000-\u0009\u000b-\u001f]+/g, " ").trim().slice(0, n);

// returns the price of one custom slime, or throws Error("bad picks")
export function priceCustom(p) {
  const bad = () => { throw new Error("bad picks"); };
  if (!p || !(p.base in BASES) || !(p.deluxe in DELUXE)) bad();
  const included = DELUXE_INCLUDES[p.deluxe] || [];
  const addins = (Array.isArray(p.addins) ? p.addins : []).filter((a) => a && a.id in ADDINS && !included.includes(a.id));
  const seen = new Set();
  let total = BASES[p.base] + DELUXE[p.deluxe];
  for (const a of addins) {
    if (seen.has(a.id)) bad();
    seen.add(a.id);
    total += ADDINS[a.id] + (a.id === "charms" ? 0 : EXTRA[a.amt] ?? 0);
  }
  if (seen.size > MAX_ADDINS) bad();
  return total;
}

// Turns the browser's cart into priced lines. Throws Error("bad cart") on anything odd.
export function priceCart(items) {
  if (!Array.isArray(items) || !items.length || items.length > MAX_LINES) throw new Error("bad cart");
  return items.map((it) => {
    const qty = Math.floor(Number(it && it.qty));
    if (!(qty >= 1 && qty <= MAX_QTY)) throw new Error("bad cart");
    if (it.kind === "shop") {
      const p = SHOP[it.id];
      if (!p) throw new Error("bad cart");
      return { name: p.name, price: p.price, qty, jars6: p.jars6 || 0, jars4: p.jars4 || 0 };
    }
    if (it.kind === "custom") {
      let price;
      try { price = priceCustom(it.picks); } catch { throw new Error("bad cart"); }
      const nm = clean(it.name, 18);
      return { name: nm ? `Custom slime: ${nm}` : "Build your own slime (6 oz)", price, qty, jars6: 1, jars4: 0, note: clean(it.summary, 1500) };
    }
    throw new Error("bad cart");
  });
}

// Box + packed weight for the whole order.
// Based on a real box: one 6 oz + three 4 oz jars + a few candies = 23.3 oz.
export function parcelFor(lines) {
  const jars6 = lines.reduce((s, l) => s + l.jars6 * l.qty, 0);
  const jars4 = lines.reduce((s, l) => s + l.jars4 * l.qty, 0);
  const oz = Math.ceil(3 + jars6 * 7.5 + jars4 * 4.5);
  const jars = jars6 + jars4;
  const [l, w, h] = jars <= 2 ? [6, 6, 4] : jars <= 6 ? [8, 8, 6] : jars <= 12 ? [12, 10, 6] : [14, 12, 8];
  return { length: String(l), width: String(w), height: String(h), distance_unit: "in", weight: String(oz), mass_unit: "oz" };
}

// Coupon codes. To add one: add a line here (CODE: percent off the slimes; shipping is never discounted).
// To turn a code off: delete its line.
export const CODES = {
  WELCOME20: { pct: 20, label: "Welcome 20% off" },
};
export const findCode = (s) => {
  const k = String(s || "").trim().toUpperCase().replace(/\s+/g, "");
  return CODES[k] ? { code: k, ...CODES[k] } : null;
};
