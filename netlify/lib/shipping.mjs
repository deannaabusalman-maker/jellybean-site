// Real USPS shipping prices from Shippo. quote(address, box) prices a box from catalog.mjs parcelFor();
// with no box it prices one 6 oz jar.
// Netlify environment variables (set in Netlify, never in this public repo):
//   SHIPPO_API_KEY  your Shippo API token
//   SHIP_FROM       where you mail from, like "123 Main St, Lafayette, LA 70508"
//   SHIP_PARCEL     optional box + packed weight, "length,width,height,ounces" in inches (default "6,6,4,12")
// Without SHIPPO_API_KEY it falls back to the old flat price so the site keeps working.

const FLAT = 7;

export function cleanAddress(a) {
  const s = (v, n) => String(v || "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, n);
  const to = {
    street1: s(a && a.street1, 100),
    city: s(a && a.city, 60),
    state: s(a && a.state, 2).toUpperCase(),
    zip: s(a && a.zip, 10),
  };
  const ok = to.street1.length >= 3 && to.city.length >= 2 && /^[A-Z]{2}$/.test(to.state) && /^\d{5}(-\d{4})?$/.test(to.zip);
  return ok ? to : null;
}

function fromAddress() {
  const m = /^(.+?),\s*([^,]+?),\s*([A-Za-z]{2})\s+(\d{5})/.exec(process.env.SHIP_FROM || "");
  if (!m) return null;
  return { name: "Jellybean Slime", street1: m[1], city: m[2], state: m[3].toUpperCase(), zip: m[4], country: "US" };
}

function parcel() {
  const [l, w, h, oz] = (process.env.SHIP_PARCEL || "6,6,4,12").split(",").map((x) => parseFloat(x));
  const n = (x, d) => (Number.isFinite(x) && x > 0 ? String(x) : d);
  return { length: n(l, "6"), width: n(w, "6"), height: n(h, "4"), distance_unit: "in", weight: n(oz, "12"), mass_unit: "oz" };
}

// returns { amount, service, days } or throws Error("address" | "shippo")
export async function quote(addr, box) {
  const to = cleanAddress(addr);
  if (!to) throw new Error("address");
  const key = process.env.SHIPPO_API_KEY;
  const from = fromAddress();
  if (!key || !from) return { amount: FLAT, service: "Flat rate", days: null, flat: true };

  const r = await fetch("https://api.goshippo.com/shipments/", {
    method: "POST",
    headers: { Authorization: `ShippoToken ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      address_from: from,
      address_to: { name: "Customer", ...to, country: "US" },
      parcels: [box || parcel()],
      async: false,
    }),
  });
  const data = await r.json().catch(() => ({}));
  const rates = Array.isArray(data.rates) ? data.rates : [];
  const usps = rates.filter((x) => x.provider === "USPS");
  const pool = (usps.length ? usps : rates).filter((x) => x.currency === "USD" && Number(x.amount) > 0);
  if (!r.ok || !pool.length) {
    console.log("Shippo error", r.status, JSON.stringify(data.messages || data.detail || data).slice(0, 500));
    throw new Error("shippo");
  }
  const best = pool.reduce((a, b) => (Number(b.amount) < Number(a.amount) ? b : a));
  return {
    amount: Math.ceil(Number(best.amount) * 100) / 100,
    service: `${best.provider} ${best.servicelevel?.name || ""}`.trim(),
    days: best.estimated_days ?? null,
  };
}
