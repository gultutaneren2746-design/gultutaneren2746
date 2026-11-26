/* =========================================================
   Aesthetica — application logic
   Renders the catalogue from services.js, handles filtering,
   search, detail modal, language switching and booking.
   ========================================================= */
(function () {
  "use strict";

  const CFG = window.CLINIC_CONFIG || {};
  const I18N = window.I18N;
  const SERVICES = window.SERVICES;
  const GROUPS = window.SERVICE_GROUPS;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    lang: loadLang(),
    group: "all",
    query: "",
    lastFocus: null
  };

  /* ---------------- Icons (inline SVG paths) ---------------- */
  const ICONS = {
    scalp:   '<path d="M5 14c0-5 3-9 7-9s7 4 7 9"/><path d="M5 14c0 3 1 5 2 6M19 14c0 3-1 5-2 6"/><path d="M8 8.5h.01M10.5 7h.01M13.5 7h.01M16 8.5h.01M9 11h.01M12 10h.01M15 11h.01"/>',
    brow:    '<path d="M3 11c3-4 9-5 14-3 1.5.6 3 1.6 4 3"/><path d="M6 16c1.5-1.2 3.5-2 6-2s4.5.8 6 2"/><circle cx="12" cy="16.5" r="1.3"/>',
    blade:   '<path d="M4 20 16 8"/><path d="m16 8 3-3 1 1-3 3"/><path d="M7 12c2-1 4-1 6 0M9 15c1.5-.7 3-.7 4.5 0"/>',
    drop:    '<path d="M12 3c3.5 4.5 6 7.8 6 11a6 6 0 0 1-12 0c0-3.2 2.5-6.5 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
    dissolve:'<path d="M12 3c3.5 4.5 6 7.8 6 11a6 6 0 0 1-12 0c0-3.2 2.5-6.5 6-11z" stroke-dasharray="2.5 2.5"/><path d="M9 14h6"/>',
    smooth:  '<path d="M3 8c3-2 6 2 9 0s6 2 9 0"/><path d="M3 13c3-1 6 1 9 0s6 1 9 0"/><path d="M3 18h18"/>',
    glow:    '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    dna:     '<path d="M7 3c0 6 10 6 10 12 0 3-2 5-2 6M17 3c0 6-10 6-10 12 0 3 2 5 2 6"/><path d="M8.5 7h7M8.5 17h7M10 12h4"/>',
    plasma:  '<path d="M9 3h6M10 3v6l-4 9a2 2 0 0 0 1.8 3h8.4a2 2 0 0 0 1.8-3l-4-9V3"/><path d="M7.5 15h9"/>',
    fibrin:  '<path d="M9 3h6M10 3v6l-4 9a2 2 0 0 0 1.8 3h8.4a2 2 0 0 0 1.8-3l-4-9V3"/><path d="M8 16c1.3-1 2.7 1 4 0s2.7 1 4 0"/>',
    peel:    '<path d="M5 19V8a4 4 0 0 1 4-4h10v11a4 4 0 0 1-4 4z"/><path d="M19 4c-3 0-5 2-5 5v10"/>',
    bottle:  '<path d="M10 2h4v3h-4z"/><path d="M9 5h6l1 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8z"/><path d="M8 12h8"/>',
    needle:  '<rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 9h.01M12 9h.01M15 9h.01M9 12h.01M12 12h.01M15 12h.01M9 15h.01M12 15h.01M15 15h.01"/>'
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.drop}</svg>`;

  /* ---------------- Helpers ---------------- */
  function t(key) { return (I18N[state.lang] && I18N[state.lang][key]) || I18N.en[key] || ""; }
  function L(obj) { return obj ? (obj[state.lang] || obj.en || "") : ""; }
  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function norm(str) {
    return String(str).toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
  }
  function highlight(text) {
    const safe = esc(text);
    if (!state.query) return safe;
    const q = state.query.trim();
    if (!q) return safe;
    const re = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
    return safe.replace(re, "<mark>$1</mark>");
  }
  function loadLang() {
    try {
      const saved = localStorage.getItem("lang");
      if (saved === "en" || saved === "tr") return saved;
    } catch (e) { /* storage unavailable */ }
    return CFG.defaultLanguage === "tr" ? "tr" : "en";
  }
  function saveLang(lang) { try { localStorage.setItem("lang", lang); } catch (e) { /* ignore */ } }
  function groupName(id) { const g = GROUPS.find((x) => x.id === id); return g ? g[state.lang] || g.en : ""; }
  function searchText(s) {
    const parts = [s.title.en, s.title.tr, s.tagline.en, s.tagline.tr, s.description.en, s.description.tr, groupName(s.group)];
    s.areas.forEach((a) => parts.push(a.en, a.tr, a.note ? a.note.en + " " + a.note.tr : ""));
    return norm(parts.join(" "));
  }
  SERVICES.forEach((s) => { s._search = searchText(s); });

  /* ---------------- Static text ---------------- */
  function applyStaticText() {
    document.documentElement.lang = state.lang;
    $$("[data-i18n]").forEach((el) => { const v = t(el.dataset.i18n); if (v) el.textContent = v; });
    $$("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    $$("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === state.lang)));
  }

  function applyConfig() {
    $$("[data-config]").forEach((el) => { const v = CFG[el.dataset.config]; if (v) el.textContent = v; });
    if (CFG.name) document.title = CFG.name + " — " + (CFG.subtitle || "Aesthetic Clinic");
    $$(".brand__mark").forEach((m) => { if (CFG.name) m.textContent = CFG.name.charAt(0).toUpperCase(); });
    $("#year").textContent = new Date().getFullYear();
  }

  /* ---------------- Stats & marquee ---------------- */
  function renderStats() {
    const areaCount = SERVICES.reduce((n, s) => n + s.areas.length, 0);
    $("#statCats").textContent = SERVICES.length;
    $("#statAreas").textContent = areaCount + "+";
  }
  function renderMarquee() {
    const items = SERVICES.map((s) => `<span>${esc(L(s.title))}</span>`).join("");
    $("#marquee").innerHTML = items + items;
  }

  /* ---------------- Filters ---------------- */
  function renderFilters() {
    $("#filters").innerHTML = GROUPS.map((g) => {
      const count = g.id === "all" ? SERVICES.length : SERVICES.filter((s) => s.group === g.id).length;
      return `<button class="chip" role="tab" data-group="${g.id}" aria-selected="${g.id === state.group}">
        ${esc(g[state.lang] || g.en)}<span class="chip__count">${count}</span></button>`;
    }).join("");
  }

  /* ---------------- Cards ---------------- */
  function filtered() {
    const q = norm(state.query.trim());
    return SERVICES.filter((s) =>
      (state.group === "all" || s.group === state.group) && (!q || s._search.includes(q)));
  }

  function renderGrid() {
    const list = filtered();
    const max = 5;
    $("#grid").innerHTML = list.map((s, i) => {
      const areas = s.areas.slice(0, max).map((a) => `<li>${highlight(L(a))}</li>`).join("");
      const more = s.areas.length > max ? `<li class="more">+${s.areas.length - max}</li>` : "";
      return `
      <button class="card" type="button" data-id="${s.id}" style="animation-delay:${Math.min(i, 8) * 60}ms">
        <div class="card__top">
          <span class="card__icon">${icon(s.icon)}</span>
          ${s.badge ? `<span class="badge">${esc(L(s.badge))}</span>` : ""}
        </div>
        <p class="card__group">${esc(groupName(s.group))}</p>
        <h3 class="card__title">${highlight(L(s.title))}</h3>
        <p class="card__tagline">${highlight(L(s.tagline))}</p>
        <ul class="card__areas">${areas}${more}</ul>
        <div class="card__foot">
          <span>${s.areas.length} ${esc(t("treat.areas"))}</span>
          <span class="card__more">${esc(t("treat.more"))}</span>
        </div>
      </button>`;
    }).join("");
    $("#empty").hidden = list.length > 0;
  }

  /* ---------------- Modal ---------------- */
  function openModal(id) {
    const s = SERVICES.find((x) => x.id === id);
    if (!s) return;
    state.lastFocus = document.activeElement;
    const f = s.facts || {};
    const facts = [["duration", f.duration], ["sessions", f.sessions], ["downtime", f.downtime], ["results", f.results]]
      .filter(([, v]) => v)
      .map(([k, v]) => `<div><dt>${esc(t("modal." + k))}</dt><dd>${esc(L(v))}</dd></div>`).join("");
    const areas = s.areas.map((a) =>
      `<li>${esc(L(a))}${a.note ? `<small>${esc(L(a.note))}</small>` : ""}</li>`).join("");

    $("#modalBody").innerHTML = `
      <div class="modal__hero">
        <span class="card__icon">${icon(s.icon)}</span>
        <p class="card__group">${esc(groupName(s.group))}${s.badge ? " · " + esc(L(s.badge)) : ""}</p>
        <h3 id="modalTitle">${esc(L(s.title))}</h3>
        <p>${esc(L(s.tagline))}</p>
      </div>
      <div class="modal__content">
        <p class="modal__desc">${esc(L(s.description))}</p>
        <div>
          <p class="modal__label">${esc(t("modal.areas"))}</p>
          <ul class="areas">${areas}</ul>
        </div>
        ${facts ? `<dl class="facts">${facts}</dl>` : ""}
        <p class="modal__note">${esc(t("modal.note"))}</p>
        <div><a href="#book" class="btn btn--primary" data-book="${s.id}">${esc(t("modal.book"))}</a></div>
      </div>`;

    const modal = $("#modal");
    modal.hidden = false;
    document.body.classList.add("modal-open");
    $(".modal__panel").scrollTop = 0;
    $(".modal__panel").focus();
    if (location.hash !== "#" + s.id) history.replaceState(null, "", "#" + s.id);
  }

  function closeModal() {
    const modal = $("#modal");
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    if (SERVICES.some((s) => "#" + s.id === location.hash)) history.replaceState(null, "", location.pathname + location.search);
    if (state.lastFocus) state.lastFocus.focus({ preventScroll: true });
  }

  function trapFocus(e) {
    const modal = $("#modal");
    if (modal.hidden || e.key !== "Tab") return;
    const focusables = $$("a[href], button, [tabindex]:not([tabindex='-1'])", modal);
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------------- FAQ ---------------- */
  function renderFaq() {
    const open = $$(".faq__q[aria-expanded='true']").map((b) => b.dataset.i);
    let html = "";
    for (let i = 1; i <= 6; i++) {
      const isOpen = open.includes(String(i));
      html += `<div class="faq__item">
        <button class="faq__q" type="button" data-i="${i}" aria-expanded="${isOpen}" aria-controls="faq-a${i}" id="faq-q${i}">${esc(t("faq.q" + i))}</button>
        <div class="faq__a" id="faq-a${i}" role="region" aria-labelledby="faq-q${i}"><div><p>${esc(t("faq.a" + i))}</p></div></div>
      </div>`;
    }
    $("#faqList").innerHTML = html;
  }

  /* ---------------- Contact ---------------- */
  function renderContact() {
    const items = [];
    if (CFG.phone) items.push(["☏", t("contact.phone"), `<a href="tel:${esc(CFG.phone.replace(/\s/g, ""))}">${esc(CFG.phone)}</a>`]);
    if (CFG.whatsapp) items.push(["✆", "WhatsApp", `<a href="https://wa.me/${esc(CFG.whatsapp)}" target="_blank" rel="noopener">+${esc(CFG.whatsapp)}</a>`]);
    if (CFG.email) items.push(["✉", t("contact.email"), `<a href="mailto:${esc(CFG.email)}">${esc(CFG.email)}</a>`]);
    if (CFG.address) items.push(["⌖", t("contact.address"), esc(CFG.address)]);
    if (CFG.hours) items.push(["◷", t("contact.hours"), esc(CFG.hours)]);
    if (CFG.instagram) items.push(["◎", t("contact.instagram"), `<a href="${esc(CFG.instagram)}" target="_blank" rel="noopener">${esc(CFG.instagram.replace(/^https?:\/\/(www\.)?/, ""))}</a>`]);
    $("#contactList").innerHTML = items.map(([ic, label, val]) =>
      `<li><span class="contact__icon" aria-hidden="true">${ic}</span><span><small>${esc(label)}</small>${val}</span></li>`).join("");

    $("#footerLinks").innerHTML = SERVICES.map((s) =>
      `<li><a href="#${s.id}" data-open="${s.id}">${esc(L(s.title))}</a></li>`).join("");
  }

  /* ---------------- Booking form ---------------- */
  function renderTreatmentSelect(keep) {
    const sel = $("#treatmentSelect");
    const current = keep || sel.value;
    sel.innerHTML = `<option value="">${esc(t("book.choose"))}</option>` +
      SERVICES.map((s) => `<option value="${s.id}">${esc(L(s.title))}</option>`).join("");
    sel.value = current || "";
    renderAreaSelect();
  }
  function renderAreaSelect(keep) {
    const s = SERVICES.find((x) => x.id === $("#treatmentSelect").value);
    const sel = $("#areaSelect");
    const current = keep || sel.value;
    sel.innerHTML = `<option value="">—</option>` +
      (s ? s.areas.map((a, i) => `<option value="${i}">${esc(L(a))}</option>`).join("") : "");
    sel.disabled = !s;
    if (s && current !== "" && s.areas[current]) sel.value = current;
  }

  function buildMessage(form) {
    const d = new FormData(form);
    const s = SERVICES.find((x) => x.id === d.get("treatment"));
    const area = s && d.get("area") !== "" ? s.areas[d.get("area")] : null;
    const lines = [
      t("book.msgTitle") + " — " + (CFG.name || ""),
      "",
      t("book.name") + ": " + d.get("name"),
      t("book.phone") + ": " + d.get("phone"),
      d.get("email") ? t("book.email") + ": " + d.get("email") : "",
      t("book.treatment") + ": " + (s ? L(s.title) : ""),
      area ? t("book.area").replace(/\s*\(.*\)/, "") + ": " + L(area) : "",
      d.get("date") ? t("book.date") + ": " + d.get("date") : "",
      d.get("message") ? "\n" + d.get("message") : ""
    ];
    return { text: lines.filter(Boolean).join("\n"), subject: t("book.msgTitle") + (s ? " — " + L(s.title) : "") };
  }

  function validate(form) {
    let ok = true;
    ["name", "phone", "treatment"].forEach((n) => {
      const el = form.elements[n];
      const bad = !String(el.value).trim();
      el.closest(".field").classList.toggle("is-invalid", bad);
      if (bad) ok = false;
    });
    if (!form.elements.consent.checked) ok = false;
    const err = $("#formError");
    err.hidden = ok;
    err.textContent = ok ? "" : t("book.required");
    return ok;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const action = (e.submitter && e.submitter.dataset.action) || "whatsapp";
    if (!validate(form)) return;
    const { text, subject } = buildMessage(form);
    if (action === "whatsapp") {
      const num = (CFG.whatsapp || "").replace(/\D/g, "");
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    } else if (action === "email") {
      location.href = `mailto:${CFG.email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    } else {
      copyText(text).then(() => toast(t("book.copied")));
    }
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    fallbackCopy(text);
    return Promise.resolve();
  }
  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    ta.remove();
  }

  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  function preselect(id) {
    renderTreatmentSelect(id);
    $("#treatmentSelect").closest(".field").classList.remove("is-invalid");
  }

  /* ---------------- Reveal on scroll ---------------- */
  function setupReveal() {
    const els = $$(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("is-visible")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    els.forEach((el) => io.observe(el));
  }

  /* ---------------- Render all ---------------- */
  function renderAll() {
    applyStaticText();
    renderStats();
    renderMarquee();
    renderFilters();
    renderGrid();
    renderFaq();
    renderContact();
    const areaKeep = $("#areaSelect").value;
    renderTreatmentSelect();
    renderAreaSelect(areaKeep);
  }

  /* ---------------- Events ---------------- */
  function bind() {
    // language
    $$("[data-lang]").forEach((b) => b.addEventListener("click", () => {
      if (state.lang === b.dataset.lang) return;
      state.lang = b.dataset.lang; saveLang(state.lang);
      const openId = !$("#modal").hidden && location.hash.slice(1);
      renderAll();
      if (openId) openModal(openId);
    }));

    // filters
    $("#filters").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      state.group = chip.dataset.group;
      $$(".chip").forEach((c) => c.setAttribute("aria-selected", String(c === chip)));
      renderGrid();
    });

    // search (debounced)
    let timer;
    $("#search").addEventListener("input", (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.query = e.target.value; renderGrid(); }, 120);
    });

    // card open
    $("#grid").addEventListener("click", (e) => {
      const card = e.target.closest(".card");
      if (card) openModal(card.dataset.id);
    });
    $("#footerLinks").addEventListener("click", (e) => {
      const a = e.target.closest("[data-open]");
      if (a) { e.preventDefault(); openModal(a.dataset.open); }
    });

    // modal
    $("#modal").addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) closeModal();
      const book = e.target.closest("[data-book]");
      if (book) {
        e.preventDefault();
        preselect(book.dataset.book);
        closeModal();
        $("#book").scrollIntoView({ behavior: "smooth" });
        setTimeout(() => $("#bookForm [name=name]").focus({ preventScroll: true }), 600);
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
      trapFocus(e);
    });

    // faq
    $("#faqList").addEventListener("click", (e) => {
      const q = e.target.closest(".faq__q");
      if (q) q.setAttribute("aria-expanded", String(q.getAttribute("aria-expanded") !== "true"));
    });

    // booking
    $("#treatmentSelect").addEventListener("change", () => renderAreaSelect());
    $("#bookForm").addEventListener("submit", handleSubmit);
    $("#bookForm").addEventListener("input", (e) => {
      const f = e.target.closest(".field");
      if (f) f.classList.remove("is-invalid");
    });

    // mobile menu
    const menuBtn = $("#menuBtn"), nav = $("#nav");
    menuBtn.addEventListener("click", () => {
      const open = menuBtn.getAttribute("aria-expanded") !== "true";
      menuBtn.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
    });
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) { menuBtn.setAttribute("aria-expanded", "false"); nav.classList.remove("is-open"); }
    });

    // header shadow
    const header = $(".header");
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // deep link: /#prp opens the PRP card
    window.addEventListener("hashchange", openFromHash);
  }

  function openFromHash() {
    const id = location.hash.slice(1);
    if (SERVICES.some((s) => s.id === id)) openModal(id);
  }

  /* ---------------- Init ---------------- */
  applyConfig();
  renderAll();
  bind();
  setupReveal();
  openFromHash();
})();
