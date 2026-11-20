// Jellybean cart: kept in this browser (localStorage) until checkout.
// Every page that includes this file gets the floating cart button.
(function () {
  const KEY = "jb-cart";
  const PRODUCTS = {
    "iced-lemonade": { name: "Iced Lemonade", desc: "6 oz · jelly cube x bingsu", price: 12, img: "/iced-lemonade.jpg" },
    "fairy-floss":   { name: "Fairy Floss",   desc: "6 oz · cloud dough",        price: 12, img: "/fairy-floss.jpg" },
    "mystery":       { name: "Mystery Slime Pack 🎁", desc: "3 surprise 4 oz slimes", price: 20, img: "" },
  };
  const MAX_QTY = 10;
  let mem = [];
  const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (_) { return mem; } };
  const write = (items) => { mem = items; try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (_) {} badge(); };
  const count = () => read().reduce((s, i) => s + (i.qty || 1), 0);

  function add(item) {
    const items = read();
    if (item.kind === "shop") {
      const same = items.find((i) => i.kind === "shop" && i.id === item.id);
      if (same) same.qty = Math.min(MAX_QTY, (same.qty || 1) + 1);
      else items.push({ kind: "shop", id: item.id, qty: 1 });
    } else {
      items.push({ ...item, qty: 1, uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });
    }
    write(items);
    toast();
  }

  // ---- floating cart button ----
  const css = `
  .jb-cartbtn{position:fixed;right:16px;bottom:16px;z-index:50;display:flex;align-items:center;gap:6px;
    background:#3b2a55;color:#fff;text-decoration:none;font:800 17px "Grandstander","Fredoka",system-ui,sans-serif;
    padding:11px 16px;border-radius:999px;box-shadow:0 4px 0 #24183a,0 8px 22px rgba(59,42,85,.28);transition:transform .15s}
  .jb-cartbtn[hidden]{display:none}
  .jb-cartbtn b{background:#ff6fa8;color:#fff;min-width:24px;height:24px;border-radius:999px;display:grid;place-items:center;font-size:14px;padding:0 6px}
  .jb-cartbtn.bump{animation:jbbump .45s}
  @keyframes jbbump{30%{transform:scale(1.18) rotate(-4deg)}60%{transform:scale(.95)}}
  .jb-toast{position:fixed;left:50%;bottom:78px;transform:translateX(-50%) translateY(20px);opacity:0;z-index:51;
    background:#fff;color:#3b2a55;border:3px solid #ff6fa8;border-radius:18px;padding:10px 14px;
    font:800 16px "Nunito",system-ui,sans-serif;display:flex;gap:12px;align-items:center;box-shadow:0 8px 24px rgba(59,42,85,.2);
    transition:opacity .2s,transform .2s;max-width:calc(100vw - 32px);white-space:nowrap}
  .jb-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  .jb-toast a{color:#fff;background:#ff6fa8;text-decoration:none;padding:6px 12px;border-radius:999px}
  @media print{.jb-cartbtn,.jb-toast{display:none}}`;
  let btn, tst, tTimer;
  function mount() {
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    btn = document.createElement("a");
    btn.className = "jb-cartbtn"; btn.href = "/cart.html";
    btn.innerHTML = `🛒 Cart <b>0</b>`;
    if (/\/cart(\.html)?$/.test(location.pathname)) btn.dataset.off = "1";
    document.body.appendChild(btn);
    tst = document.createElement("div");
    tst.className = "jb-toast"; tst.setAttribute("role", "status");
    tst.innerHTML = `<span>Added to your cart! 🫧</span><a href="/cart.html">View cart</a>`;
    document.body.appendChild(tst);
    badge();
  }
  function badge() {
    if (!btn) return;
    const n = count();
    btn.querySelector("b").textContent = n;
    btn.setAttribute("aria-label", `Cart, ${n} item${n === 1 ? "" : "s"}`);
    btn.hidden = !n || btn.dataset.off === "1";
  }
  function toast() {
    if (!btn) return;
    btn.classList.remove("bump"); void btn.offsetWidth; btn.classList.add("bump");
    tst.classList.add("show"); clearTimeout(tTimer);
    tTimer = setTimeout(() => tst.classList.remove("show"), 3500);
  }
  window.addEventListener("storage", (e) => { if (e.key === KEY) badge(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();

  // "Add to cart" buttons: <button data-add="fairy-floss">
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    if (!b) return;
    e.preventDefault();
    add({ kind: "shop", id: b.dataset.add });
    const old = b.dataset.label || (b.dataset.label = b.textContent);
    b.textContent = "Added! ✓";
    setTimeout(() => { b.textContent = old; }, 1600);
  });

  window.JBCart = { read, write, add, count, PRODUCTS, MAX_QTY };
})();
