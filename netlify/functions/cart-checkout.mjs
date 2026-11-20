// Cart checkout: prices every item again here (ignores any price from the browser),
// prices shipping for the whole box, and makes one Square checkout link for everything.
// Uses the same Netlify environment variables as checkout.mjs.
import { quote } from "../lib/shipping.mjs";
import { priceCart, parcelFor, clean } from "../lib/catalog.mjs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
const cents = (d) => ({ amount: Math.round(d * 100), currency: "USD" });

export default async (req) => {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  const location = process.env.SQUARE_LOCATION_ID;
  if (req.method === "GET") return json({ ready: Boolean(token && location) });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!token || !location) return json({ error: "not set up" }, 503);

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad request" }, 400); }
  let lines;
  try { lines = priceCart(b.items); } catch { return json({ error: "cart" }, 400); }

  const lineItems = lines.map((l) => {
    const li = { name: l.name, quantity: String(l.qty), base_price_money: cents(l.price) };
    if (l.note) li.note = l.note;
    return li;
  });
  let total = lines.reduce((s, l) => s + l.price * l.qty, 0);

  if (b.pickup === "ship") {
    let q;
    try { q = await quote(b.address, parcelFor(lines)); }
    catch (e) { return json({ error: e.message === "address" ? "address" : "shipping" }, 400); }
    const a = b.address || {};
    lineItems.push({
      name: `Shipping (${q.service})`, quantity: "1", base_price_money: cents(q.amount),
      note: clean(`Ship to ${clean(b.name, 60)}: ${a.street1}, ${a.city}, ${a.state} ${a.zip}`, 300),
    });
    total += q.amount;
  }

  const site = new URL(req.url).origin;
  const body = {
    idempotency_key: crypto.randomUUID(),
    order: { location_id: location, line_items: lineItems, reference_id: "website-cart" },
    checkout_options: {
      redirect_url: `${site}/cart.html?paid=1`,
      ask_for_shipping_address: false, // we already have their address (shipping was priced from it)
      allow_tipping: false,
    },
    payment_note: clean(`${b.pickup === "ship" ? "SHIP" : "LOCAL PICKUP"} · ${clean(b.name, 60)}`, 200),
  };
  const email = clean(b.email, 120);
  if (/^\S+@\S+\.\S+$/.test(email)) body.pre_populated_data = { buyer_email: email };

  const r = await fetch("https://connect.squareup.com/v2/online-checkout/payment-links", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Square-Version": "2024-10-17" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.payment_link?.url) {
    console.log("Square error", r.status, JSON.stringify(data.errors || data));
    return json({ error: "square" }, 502);
  }
  return json({ url: data.payment_link.url, total: Math.round(total * 100) / 100 });
};

export const config = { path: "/api/cart-checkout" };
