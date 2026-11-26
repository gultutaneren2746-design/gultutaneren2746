# Aesthetica — Aesthetic & Skin Clinic Website

A fast, elegant, bilingual (English / Türkçe) treatment-catalogue website for an aesthetic clinic.
Pure HTML + CSS + JavaScript — no build step, no dependencies — ready for **GitHub Pages**.

## Treatments included

| Category | Areas |
|---|---|
| Scalp Micropigmentation (men & women) | Hairline Reconstruction · Density Treatment · Scar Coverage |
| Semi-Permanent Make-Up (SPMU) | Eyebrows · Lip Blush · Eyeliner |
| Microblading | Hair-stroke brows · Brow mapping |
| Dermal Fillers | Lips · Chin · Cheeks · Jawline |
| Lip Filler Dissolving | Migrated filler · Lumps & asymmetry |
| Anti-Wrinkle Treatment | Forehead · Frown · Crow's Feet · Bunny Lines · Nose Slimming · Nose Lift · Lip Flip · Gummy Smile · Pebbly Chin · Jawline Definition · Nefertiti Lift · Neck Lines |
| Skin Boosters | Face · Neck · Under Eyes · Hands |
| Polynucleotides | Face · Neck · Under Eyes · Hands |
| Platelet-Rich Plasma (PRP) | Full Face · Under Eyes · Neck · Décolletage · Scalp hair growth |
| Platelet-Rich Fibrin (PRF) | Full Face · Under Eyes · Neck · Décolletage · Scalp hair growth |
| Chemical Peels | Pigmentation · Acne · Dullness · Fine lines |
| Medical Skin Care | Assessment · Personalised regimen · Pre/post care |
| Microneedling | Hair loss (men & women) · Face, under eye, neck, décolletage, hands, body · Surgery marks, pigmentation, stretch marks |

## Features

- Data-driven catalogue — every card, detail window, booking option and footer link is generated from one file
- Category filters + instant search (searches EN & TR, area names and descriptions, with highlighting)
- Detail window for each treatment: description, areas with notes, treatment time, sessions, downtime, results
- Deep links: `index.html#prp`, `#fillers`, `#smp` … open a treatment directly
- Booking form that sends a ready-written request via **WhatsApp**, **email**, or copies it
- English / Türkçe switch (remembered per visitor), automatic dark mode, mobile-first layout
- Accessible: keyboard navigation, focus trap in dialogs, reduced-motion support

## Project structure

```
index.html              Page layout
assets/css/style.css    Design & responsive styles
assets/js/config.js     ← Clinic name, phone, WhatsApp, email, address, hours
assets/js/services.js   ← Treatment catalogue (add / edit treatments here)
assets/js/i18n.js       ← Interface texts in English & Turkish
assets/js/app.js        Application logic
.github/workflows/pages.yml  Automatic GitHub Pages deployment
```

## Personalise (Kişiselleştirme)

1. Open `assets/js/config.js` and fill in the clinic name, WhatsApp number (digits only, e.g. `905xxxxxxxxx`),
   phone, email, address, hours and Instagram link. Empty fields are hidden automatically.
2. Edit treatments in `assets/js/services.js` — each one has bilingual `title`, `tagline`, `description`, `areas` and `facts`.
3. Edit page texts in `assets/js/i18n.js`.

## Publish on GitHub Pages (Yayınlama)

1. Repository → **Settings → Pages** → *Build and deployment* → Source: **GitHub Actions**.
2. Push to `main` (or run the *Deploy website to GitHub Pages* workflow manually from the **Actions** tab).
3. The site appears at `https://<username>.github.io/<repository>/`.

## Run locally

Open `index.html` in a browser, or:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

> Medical disclaimer: information on the site is general guidance and does not replace a consultation.
