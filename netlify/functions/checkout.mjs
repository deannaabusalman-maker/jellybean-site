// Build-your-own checkout: re-prices the order on the server (so nobody can change the price
// in their browser) and creates a one-time Square checkout link for exactly that total.
// Needs two Netlify environment variables: SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID.

const BASES = { butter: 12, cloud: 12, glossy: 12, clear: 12 };
const DELUXE = { none: 0, perlite: 1, bingsu: 2, pumice: 2, frosting: 1, cloud: 1, clouddough: 1, foamcrunch: 2 };
const DELUXE_INCLUDES = { perlite: ["perlite"], bingsu: ["bingsu"], foamcrunch: ["foam"] };
const ADDINS = { foam: 1, bingsu: 1, jelly: 1, perlite: 1, clay: 1, charms: 1 };
const EXTRA = { reg: 0, xtra: 0.5, xtra2: 1 }; // charms have no amount choice
const SHIPPING = 7;
const MAX_ADDINS = 5;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  const location = process.env.SQUARE_LOCATION_ID;
  if (req.method === "GET") return json({ ready: Boolean(token && location) });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!token || !location) return json({ error: "not set up" }, 503);

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad request" }, 400); }

  // ---- price it again here; ignore any total the browser sends ----
  if (!(b.base in BASES) || !(b.deluxe in DELUXE)) return json({ error: "bad picks" }, 400);
  const included = DELUXE_INCLUDES[b.deluxe] || [];
  const addins = (Array.isArray(b.addins) ? b.addins : [])
    .filter((a) => a && a.id in ADDINS && !included.includes(a.id));
  const seen = new Set();
  let addinTotal = 0;
  for (const a of addins) {
    if (seen.has(a.id)) return json({ error: "bad picks" }, 400);
    seen.add(a.id);
    addinTotal += ADDINS[a.id] + (a.id === "charms" ? 0 : EXTRA[a.amt] ?? 0);
  }
  if (seen.size > MAX_ADDINS) return json({ error: "too many add-ins" }, 400);
  const ship = b.pickup === "ship";
  const slimePrice = BASES[b.base] + DELUXE[b.deluxe] + addinTotal;

  const clean = (s, n) => String(s || "").replace(/[\u0000-\u0009\u000b-\u001f]+/g, " ").trim().slice(0, n);
  const name = clean(b.slimeName, 18);
  const lineItems = [{
    name: name ? `Custom slime: ${name}` : "Build your own slime (6 oz)",
    quantity: "1",
    base_price_money: { amount: Math.round(slimePrice * 100), currency: "USD" },
    note: clean(b.summary, 1900),
  }];
  if (ship) lineItems.push({
    name: "Shipping (U.S. flat rate)", quantity: "1",
    base_price_money: { amount: SHIPPING * 100, currency: "USD" },
  });

  const site = new URL(req.url).origin;
  const body = {
    idempotency_key: crypto.randomUUID(),
    order: { location_id: location, line_items: lineItems, reference_id: "build-your-own" },
    checkout_options: {
      redirect_url: `${site}/build.html?paid=1`,
      ask_for_shipping_address: ship,
      allow_tipping: false,
    },
  };
  const email = clean(b.email, 120);
  if (/^\S+@\S+\.\S+$/.test(email)) body.pre_populated_data = { buyer_email: email };

  const r = await fetch("https://connect.squareup.com/v2/online-checkout/payment-links", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Square-Version": "2024-10-17",
    },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.payment_link?.url) {
    console.log("Square error", r.status, JSON.stringify(data.errors || data));
    return json({ error: "square" }, 502);
  }
  return json({ url: data.payment_link.url, total: slimePrice + (ship ? SHIPPING : 0) });
};

export const config = { path: "/api/checkout" };
