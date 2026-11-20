// Shows the customer the real shipping price for their address before they pay.
// Send { address, items } to price the whole cart, or just { address } for one jar.
import { quote } from "../lib/shipping.mjs";
import { priceCart, parcelFor } from "../lib/catalog.mjs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: "bad request" }, 400); }
  let box;
  if (b.items) {
    try { box = parcelFor(priceCart(b.items)); } catch { return json({ error: "cart" }, 400); }
  }
  try {
    return json(await quote(b.address, box));
  } catch (e) {
    return json({ error: e.message === "address" ? "address" : "shipping" }, e.message === "address" ? 400 : 502);
  }
};

export const config = { path: "/api/shipping-rate" };
