/* =========================================================
   TREATMENT CATALOGUE
   Every treatment on the site is generated from this file.
   To add / edit a treatment, change the objects below.
   Text fields are bilingual: { en: "...", tr: "..." }
   ========================================================= */

window.SERVICE_GROUPS = [
  { id: "all",          en: "All Treatments",          tr: "Tüm Uygulamalar" },
  { id: "pigmentation", en: "Pigmentation & Brows",    tr: "Pigmentasyon & Kaş" },
  { id: "injectables",  en: "Injectables",             tr: "Enjeksiyonlar" },
  { id: "regenerative", en: "Regenerative",            tr: "Rejeneratif" },
  { id: "skin",         en: "Skin & Hair",             tr: "Cilt & Saç" }
];

window.SERVICES = [
  /* ---------------- SCALP MICROPIGMENTATION ---------------- */
  {
    id: "smp",
    group: "pigmentation",
    icon: "scalp",
    badge: { en: "Men & Women", tr: "Kadın & Erkek" },
    title: { en: "Scalp Micropigmentation", tr: "Saç Mikropigmentasyonu (SMP)" },
    tagline: {
      en: "The look of fuller hair — without surgery.",
      tr: "Ameliyatsız, daha gür saç görünümü."
    },
    description: {
      en: "Scalp micropigmentation places thousands of tiny pigment impressions into the scalp to replicate natural hair follicles. It restores a defined hairline, adds visual density to thinning areas and camouflages scars — for both men and women.",
      tr: "Saç mikropigmentasyonu, doğal saç köklerini taklit eden binlerce mikro pigment noktasının saçlı deriye uygulanmasıdır. Belirgin bir saç çizgisi oluşturur, seyrek bölgelere görsel yoğunluk kazandırır ve izleri kamufle eder — kadın ve erkekler için uygundur."
    },
    areas: [
      { en: "Hairline Reconstruction", tr: "Saç Çizgisi Rekonstrüksiyonu",
        note: { en: "A natural, age-appropriate front hairline designed to suit your face.", tr: "Yüzünüze uygun, doğal ve yaşınıza yakışan ön saç çizgisi tasarımı." } },
      { en: "Density Treatment", tr: "Yoğunluk Uygulaması",
        note: { en: "Reduces scalp shine-through in thinning or diffuse areas, ideal for longer hair.", tr: "Seyrek bölgelerde saçlı derinin görünmesini azaltır; uzun saçlarda da idealdir." } },
      { en: "Scar Coverage", tr: "İz Kamuflajı",
        note: { en: "Blends hair-transplant (FUE/FUT), injury or surgical scars into the surrounding scalp.", tr: "Saç ekimi (FUE/FUT), yaralanma veya ameliyat izlerini çevre dokuyla bütünleştirir." } }
    ],
    facts: {
      duration: { en: "2–4 hours per session", tr: "Seans başına 2–4 saat" },
      sessions: { en: "Usually 2–3 sessions", tr: "Genellikle 2–3 seans" },
      downtime: { en: "Mild redness for 1–3 days", tr: "1–3 gün hafif kızarıklık" },
      results:  { en: "Long-lasting; occasional top-up", tr: "Uzun süreli; ara sıra tazeleme" }
    }
  },

  /* ---------------- SEMI PERMANENT MAKE UP ---------------- */
  {
    id: "spmu",
    group: "pigmentation",
    icon: "brow",
    title: { en: "Semi-Permanent Make-Up (SPMU)", tr: "Kalıcı Makyaj (SPMU)" },
    tagline: {
      en: "Wake up with effortless definition.",
      tr: "Her sabah zahmetsizce belirgin bir görünüm."
    },
    description: {
      en: "Semi-permanent make-up deposits pigment into the upper layers of the skin to enhance your natural features. Shape, shade and intensity are customised to your face, skin tone and lifestyle.",
      tr: "Kalıcı makyaj, doğal hatlarınızı güzelleştirmek için pigmenti cildin üst katmanlarına yerleştirir. Şekil, renk tonu ve yoğunluk; yüz yapınıza, ten renginize ve yaşam tarzınıza göre kişiselleştirilir."
    },
    areas: [
      { en: "Eyebrows", tr: "Kaş",
        note: { en: "Powder, ombré or combination brows for fuller, symmetrical shape.", tr: "Daha dolgun ve simetrik kaşlar için pudra, ombre veya kombine teknik." } },
      { en: "Lip Blush", tr: "Dudak Renklendirme (Lip Blush)",
        note: { en: "Soft, even colour that refreshes lip tone and defines the border.", tr: "Dudak tonunu canlandıran, sınırları belirginleştiren yumuşak ve eşit renk." } },
      { en: "Eyeliner", tr: "Eyeliner",
        note: { en: "Lash-enhancement or classic liner for eyes that look defined all day.", tr: "Gün boyu belirgin gözler için kirpik dibi veya klasik eyeliner." } }
    ],
    facts: {
      duration: { en: "2–3 hours", tr: "2–3 saat" },
      sessions: { en: "Initial + perfecting session (6–8 weeks)", tr: "İlk seans + rötuş (6–8 hafta sonra)" },
      downtime: { en: "Healing 7–14 days", tr: "İyileşme 7–14 gün" },
      results:  { en: "1–3 years depending on skin", tr: "Cilde bağlı olarak 1–3 yıl" }
    }
  },

  /* ---------------- MICROBLADING ---------------- */
  {
    id: "microblading",
    group: "pigmentation",
    icon: "blade",
    title: { en: "Microblading", tr: "Microblading" },
    tagline: {
      en: "Hair-stroke brows that look naturally yours.",
      tr: "Doğal kıl görünümlü kaşlar."
    },
    description: {
      en: "Microblading uses a fine hand tool to create crisp, hair-like strokes that mimic natural brow hair. It is ideal for sparse, over-plucked or uneven brows and for clients who want a soft, feathered finish.",
      tr: "Microblading, doğal kaş kıllarını taklit eden ince ve belirgin vuruşlar oluşturmak için özel bir el aleti kullanır. Seyrek, aşırı alınmış veya asimetrik kaşlar ve yumuşak, tüy görünümlü bir sonuç isteyenler için idealdir."
    },
    areas: [
      { en: "Hair-stroke Brows", tr: "Kıl Tekniği Kaş",
        note: { en: "Individually drawn strokes following your natural brow direction.", tr: "Doğal kaş yönünüzü takip eden tek tek çizilmiş kıllar." } },
      { en: "Brow Shaping & Mapping", tr: "Kaş Tasarımı & Haritalama",
        note: { en: "Measured design to balance your facial proportions.", tr: "Yüz oranlarınızı dengeleyen ölçülü tasarım." } }
    ],
    facts: {
      duration: { en: "Approx. 2 hours", tr: "Yaklaşık 2 saat" },
      sessions: { en: "Initial + top-up (6–8 weeks)", tr: "İlk seans + rötuş (6–8 hafta)" },
      downtime: { en: "Healing 7–10 days", tr: "İyileşme 7–10 gün" },
      results:  { en: "12–18 months", tr: "12–18 ay" }
    }
  },

  /* ---------------- DERMAL FILLERS ---------------- */
  {
    id: "fillers",
    group: "injectables",
    icon: "drop",
    title: { en: "Dermal Fillers", tr: "Dermal Dolgu" },
    tagline: {
      en: "Restore volume, refine contours.",
      tr: "Hacmi geri kazandırın, hatları belirginleştirin."
    },
    description: {
      en: "Hyaluronic-acid dermal fillers restore lost volume, enhance proportions and sculpt facial contours. Results are immediate and tailored for a balanced, natural-looking outcome.",
      tr: "Hyalüronik asit bazlı dolgular, kaybolan hacmi geri kazandırır, yüz oranlarını iyileştirir ve hatları şekillendirir. Sonuçlar anında görülür ve dengeli, doğal bir görünüm için kişiye özel planlanır."
    },
    areas: [
      { en: "Lips", tr: "Dudak",
        note: { en: "Hydration, definition or subtle volume with natural movement.", tr: "Doğal hareketle nem, belirginlik veya hafif hacim." } },
      { en: "Chin", tr: "Çene Ucu",
        note: { en: "Projection and balance for a harmonious profile.", tr: "Uyumlu bir profil için çene ucu projeksiyonu ve denge." } },
      { en: "Cheeks", tr: "Elmacık",
        note: { en: "Lift and contour to the mid-face.", tr: "Orta yüze kaldırma ve kontür etkisi." } },
      { en: "Jawline", tr: "Çene Hattı",
        note: { en: "A sharper, more defined jaw contour.", tr: "Daha keskin ve belirgin bir çene hattı." } }
    ],
    facts: {
      duration: { en: "30–60 minutes", tr: "30–60 dakika" },
      sessions: { en: "Usually 1 session", tr: "Genellikle 1 seans" },
      downtime: { en: "Possible swelling 2–5 days", tr: "2–5 gün olası şişlik" },
      results:  { en: "6–18 months depending on area", tr: "Bölgeye göre 6–18 ay" }
    }
  },

  /* ---------------- LIP DISSOLVING ---------------- */
  {
    id: "lip-dissolving",
    group: "injectables",
    icon: "dissolve",
    title: { en: "Lip Filler Dissolving", tr: "Dudak Dolgusu Eritme" },
    tagline: {
      en: "A clean canvas for natural lips.",
      tr: "Doğal dudaklar için temiz bir başlangıç."
    },
    description: {
      en: "Hyaluronidase is used to safely break down unwanted, migrated or lumpy hyaluronic-acid filler. It corrects overfilled results and prepares the lips for a fresh, balanced treatment if desired.",
      tr: "İstenmeyen, yer değiştirmiş veya topaklanmış hyalüronik asit dolguyu güvenle eritmek için hyalüronidaz kullanılır. Aşırı dolgu görünümünü düzeltir ve istenirse dudakları yeni, dengeli bir uygulamaya hazırlar."
    },
    areas: [
      { en: "Migrated Filler", tr: "Yer Değiştirmiş Dolgu",
        note: { en: "Removes filler that has spread above the lip border.", tr: "Dudak sınırının üzerine yayılmış dolguyu giderir." } },
      { en: "Lumps & Asymmetry", tr: "Topaklanma & Asimetri",
        note: { en: "Smooths irregularities for an even result.", tr: "Düzgün bir sonuç için düzensizlikleri giderir." } }
    ],
    facts: {
      duration: { en: "20–30 minutes", tr: "20–30 dakika" },
      sessions: { en: "1–2 sessions", tr: "1–2 seans" },
      downtime: { en: "Swelling 24–48 hours", tr: "24–48 saat şişlik" },
      results:  { en: "Visible within 24–72 hours", tr: "24–72 saat içinde görünür" }
    }
  },

  /* ---------------- ANTI-WRINKLE ---------------- */
  {
    id: "anti-wrinkle",
    group: "injectables",
    icon: "smooth",
    badge: { en: "12 Areas", tr: "12 Bölge" },
    title: { en: "Anti-Wrinkle Treatment", tr: "Kırışıklık Karşıtı Uygulama" },
    tagline: {
      en: "Soften expression lines, keep your expression.",
      tr: "Mimik çizgilerini yumuşatın, ifadenizi koruyun."
    },
    description: {
      en: "Precisely placed neuromodulator injections relax the muscles responsible for dynamic lines. Beyond smoothing wrinkles, they can lift, slim and reshape specific features with a refreshed, never frozen, finish.",
      tr: "Hassas noktalara uygulanan nöromodülatör enjeksiyonları, mimik çizgilerine neden olan kasları gevşetir. Kırışıklıkları yumuşatmanın ötesinde, belirli bölgeleri kaldırabilir, inceltebilir ve yeniden şekillendirebilir — donuk değil, dinlenmiş bir görünüm."
    },
    areas: [
      { en: "Forehead Lines", tr: "Alın Çizgileri" },
      { en: "Frown Lines", tr: "Kaş Arası Çizgileri" },
      { en: "Crow's Feet", tr: "Kaz Ayağı" },
      { en: "Bunny Lines", tr: "Burun Kökü Çizgileri (Bunny Lines)" },
      { en: "Nose Slimming", tr: "Burun İnceltme" },
      { en: "Nose Lift", tr: "Burun Ucu Kaldırma" },
      { en: "Lip Flip", tr: "Lip Flip" },
      { en: "Gummy Smile Correction", tr: "Diş Eti Gülüşü Düzeltme" },
      { en: "Pebbly Chin", tr: "Portakal Kabuğu Çene" },
      { en: "Jawline Definition", tr: "Çene Hattı Belirginleştirme" },
      { en: "Nefertiti Lift (Platysmal Bands)", tr: "Nefertiti Lifting (Platizma Bantları)" },
      { en: "Neck Lines", tr: "Boyun Çizgileri" }
    ],
    facts: {
      duration: { en: "15–30 minutes", tr: "15–30 dakika" },
      sessions: { en: "Review at 2 weeks", tr: "2. haftada kontrol" },
      downtime: { en: "Minimal — back to routine same day", tr: "Minimal — aynı gün günlük yaşama dönüş" },
      results:  { en: "Onset 3–14 days, lasts 3–4 months", tr: "3–14 günde başlar, 3–4 ay sürer" }
    }
  },

  /* ---------------- SKIN BOOSTERS ---------------- */
  {
    id: "skin-boosters",
    group: "injectables",
    icon: "glow",
    title: { en: "Skin Boosters", tr: "Skin Booster (Cilt Nemlendirici Enjeksiyon)" },
    tagline: {
      en: "Deep hydration for a lit-from-within glow.",
      tr: "İçten gelen ışıltı için derin nem."
    },
    description: {
      en: "Skin boosters deliver micro-droplets of hyaluronic acid into the skin to improve hydration, elasticity and texture. Ideal for dull, dehydrated or crepey skin, they create a fresh, dewy finish without adding volume.",
      tr: "Skin booster, cildin nem, elastikiyet ve dokusunu iyileştirmek için hyalüronik asidi mikro damlacıklar halinde cilde uygular. Mat, nemsiz veya kırışık görünümlü ciltler için idealdir; hacim eklemeden taze ve ışıltılı bir görünüm sağlar."
    },
    areas: [
      { en: "Face", tr: "Yüz" },
      { en: "Neck", tr: "Boyun" },
      { en: "Under Eyes", tr: "Göz Altı" },
      { en: "Hands", tr: "El" }
    ],
    facts: {
      duration: { en: "30–45 minutes", tr: "30–45 dakika" },
      sessions: { en: "Course of 2–3, 4 weeks apart", tr: "4 hafta arayla 2–3 seans" },
      downtime: { en: "Small bumps for 24–48 hours", tr: "24–48 saat küçük kabarıklıklar" },
      results:  { en: "6–9 months; maintenance advised", tr: "6–9 ay; idame önerilir" }
    }
  },

  /* ---------------- POLYNUCLEOTIDES ---------------- */
  {
    id: "polynucleotides",
    group: "regenerative",
    icon: "dna",
    title: { en: "Polynucleotides", tr: "Polinükleotid" },
    tagline: {
      en: "Bio-stimulating repair at a cellular level.",
      tr: "Hücresel düzeyde biyo-uyarıcı onarım."
    },
    description: {
      en: "Polynucleotides are highly purified DNA fragments that support the skin's natural repair processes. They help improve skin quality, firmness, fine lines and dark circles — especially in delicate areas such as under the eyes.",
      tr: "Polinükleotidler, cildin doğal onarım süreçlerini destekleyen yüksek saflıkta DNA parçacıklarıdır. Cilt kalitesini, sıkılığı, ince çizgileri ve göz altı morluklarını iyileştirmeye yardımcı olur — özellikle göz altı gibi hassas bölgelerde."
    },
    areas: [
      { en: "Face", tr: "Yüz" },
      { en: "Neck", tr: "Boyun" },
      { en: "Under Eyes", tr: "Göz Altı" },
      { en: "Hands", tr: "El" }
    ],
    facts: {
      duration: { en: "30–45 minutes", tr: "30–45 dakika" },
      sessions: { en: "Course of 3, 2–3 weeks apart", tr: "2–3 hafta arayla 3 seans" },
      downtime: { en: "Small bumps for 24–48 hours", tr: "24–48 saat küçük kabarıklıklar" },
      results:  { en: "Gradual over 8–12 weeks", tr: "8–12 haftada kademeli" }
    }
  },

  /* ---------------- PRP ---------------- */
  {
    id: "prp",
    group: "regenerative",
    icon: "plasma",
    title: { en: "Platelet-Rich Plasma (PRP)", tr: "Trombositten Zengin Plazma (PRP)" },
    tagline: {
      en: "Your own growth factors, put to work.",
      tr: "Kendi büyüme faktörleriniz, sizin için çalışıyor."
    },
    description: {
      en: "PRP uses a small sample of your own blood, spun to concentrate platelets rich in growth factors. Re-injected into the skin or scalp, it stimulates collagen, improves tone and texture and supports hair growth.",
      tr: "PRP, büyüme faktörlerinden zengin trombositleri yoğunlaştırmak için santrifüj edilen az miktarda kendi kanınızı kullanır. Cilde veya saçlı deriye uygulandığında kolajeni uyarır, ton ve dokuyu iyileştirir ve saç büyümesini destekler."
    },
    areas: [
      { en: "Full Face", tr: "Tüm Yüz" },
      { en: "Under Eyes", tr: "Göz Altı" },
      { en: "Neck", tr: "Boyun" },
      { en: "Décolletage", tr: "Dekolte" },
      { en: "Scalp — Hair Growth", tr: "Saçlı Deri — Saç Büyümesi" }
    ],
    facts: {
      duration: { en: "45–60 minutes", tr: "45–60 dakika" },
      sessions: { en: "Course of 3–4, monthly", tr: "Aylık 3–4 seans" },
      downtime: { en: "Redness 24–48 hours", tr: "24–48 saat kızarıklık" },
      results:  { en: "Progressive over 3 months", tr: "3 ay boyunca kademeli" }
    }
  },

  /* ---------------- PRF ---------------- */
  {
    id: "prf",
    group: "regenerative",
    icon: "fibrin",
    title: { en: "Platelet-Rich Fibrin (PRF)", tr: "Trombositten Zengin Fibrin (PRF)" },
    tagline: {
      en: "The next generation of natural regeneration.",
      tr: "Doğal yenilenmenin yeni nesli."
    },
    description: {
      en: "PRF is prepared with a slower spin and no additives, keeping platelets, white cells and stem cells within a natural fibrin matrix. This allows growth factors to be released gradually for longer-lasting regeneration.",
      tr: "PRF, katkı maddesi kullanılmadan daha yavaş bir santrifüjle hazırlanır; trombositler, beyaz kan hücreleri ve kök hücreler doğal bir fibrin matriksinde kalır. Bu sayede büyüme faktörleri kademeli olarak salınır ve daha uzun süreli yenilenme sağlanır."
    },
    areas: [
      { en: "Full Face", tr: "Tüm Yüz" },
      { en: "Under Eyes", tr: "Göz Altı" },
      { en: "Neck", tr: "Boyun" },
      { en: "Décolletage", tr: "Dekolte" },
      { en: "Scalp — Hair Growth", tr: "Saçlı Deri — Saç Büyümesi" }
    ],
    facts: {
      duration: { en: "45–60 minutes", tr: "45–60 dakika" },
      sessions: { en: "Course of 3, monthly", tr: "Aylık 3 seans" },
      downtime: { en: "Redness / swelling 24–72 hours", tr: "24–72 saat kızarıklık / şişlik" },
      results:  { en: "Progressive over 3 months", tr: "3 ay boyunca kademeli" }
    }
  },

  /* ---------------- CHEMICAL PEELS ---------------- */
  {
    id: "chemical-peels",
    group: "skin",
    icon: "peel",
    title: { en: "Chemical Peels", tr: "Kimyasal Peeling" },
    tagline: {
      en: "Resurface for brighter, smoother skin.",
      tr: "Daha aydınlık ve pürüzsüz cilt için yenilenme."
    },
    description: {
      en: "Medical-grade peels use carefully selected acids to exfoliate and renew the skin. They target dullness, uneven tone, pigmentation, congestion and fine lines, with strengths chosen to suit your skin type.",
      tr: "Medikal peelingler, cildi arındırmak ve yenilemek için özenle seçilmiş asitler kullanır. Matlık, ton eşitsizliği, lekeler, gözenek tıkanıklığı ve ince çizgileri hedefler; güç seviyesi cilt tipinize göre belirlenir."
    },
    areas: [
      { en: "Pigmentation & Melasma", tr: "Leke & Melazma" },
      { en: "Acne & Congestion", tr: "Akne & Tıkanıklık" },
      { en: "Dullness & Texture", tr: "Matlık & Doku" },
      { en: "Fine Lines", tr: "İnce Çizgiler" }
    ],
    facts: {
      duration: { en: "30–45 minutes", tr: "30–45 dakika" },
      sessions: { en: "Course of 3–6", tr: "3–6 seanslık kür" },
      downtime: { en: "0–7 days flaking depending on depth", tr: "Derinliğe göre 0–7 gün soyulma" },
      results:  { en: "Brighter skin after each session", tr: "Her seans sonrası daha aydınlık cilt" }
    }
  },

  /* ---------------- MEDICAL SKIN CARE ---------------- */
  {
    id: "medical-skincare",
    group: "skin",
    icon: "bottle",
    title: { en: "Medical Skin Care", tr: "Medikal Cilt Bakımı" },
    tagline: {
      en: "Clinical results that continue at home.",
      tr: "Evde de devam eden klinik sonuçlar."
    },
    description: {
      en: "Following a detailed skin assessment, you receive a personalised home-care plan using professional, clinically proven products. It maximises and protects the results of in-clinic treatments.",
      tr: "Detaylı bir cilt analizinin ardından, profesyonel ve klinik olarak kanıtlanmış ürünlerle kişiye özel bir ev bakım planı hazırlanır. Klinikte yapılan uygulamaların sonuçlarını en üst düzeye çıkarır ve korur."
    },
    areas: [
      { en: "Skin Assessment", tr: "Cilt Analizi" },
      { en: "Personalised Regimen", tr: "Kişiye Özel Bakım Rutini" },
      { en: "Pre & Post-Treatment Care", tr: "Uygulama Öncesi & Sonrası Bakım" }
    ],
    facts: {
      duration: { en: "Consultation 30–45 minutes", tr: "Konsültasyon 30–45 dakika" },
      sessions: { en: "Reviews every 6–12 weeks", tr: "6–12 haftada bir kontrol" },
      downtime: { en: "None", tr: "Yok" },
      results:  { en: "Visible in 6–12 weeks", tr: "6–12 haftada görünür" }
    }
  },

  /* ---------------- MICRONEEDLING ---------------- */
  {
    id: "microneedling",
    group: "skin",
    icon: "needle",
    badge: { en: "Skin & Hair", tr: "Cilt & Saç" },
    title: { en: "Microneedling", tr: "Mikro İğneleme (Microneedling)" },
    tagline: {
      en: "Collagen induction for skin and scalp.",
      tr: "Cilt ve saçlı deri için kolajen indüksiyonu."
    },
    description: {
      en: "Microneedling creates controlled micro-channels that trigger the body's natural healing response, boosting collagen and elastin. It refines skin texture, softens scars and stretch marks, evens pigmentation and stimulates the scalp for hair loss in men and women.",
      tr: "Mikro iğneleme, vücudun doğal iyileşme yanıtını tetikleyen kontrollü mikro kanallar oluşturarak kolajen ve elastin üretimini artırır. Cilt dokusunu düzeltir, izleri ve çatlakları yumuşatır, lekeleri eşitler ve kadın ve erkeklerde saç dökülmesine karşı saçlı deriyi uyarır."
    },
    areas: [
      { en: "Hair Loss — Men & Women", tr: "Saç Dökülmesi — Kadın & Erkek",
        note: { en: "Stimulates follicles; can be combined with PRP / PRF.", tr: "Saç köklerini uyarır; PRP / PRF ile kombine edilebilir." } },
      { en: "Skin — Face, Under Eye, Neck", tr: "Cilt — Yüz, Göz Altı, Boyun",
        note: { en: "Texture, pores, fine lines and overall radiance.", tr: "Doku, gözenekler, ince çizgiler ve genel ışıltı." } },
      { en: "Skin — Décolletage, Hands & Body", tr: "Cilt — Dekolte, El & Vücut",
        note: { en: "Crepey texture and sun damage on the body.", tr: "Vücuttaki kırışık doku ve güneş hasarı." } },
      { en: "Surgery Marks & Scars", tr: "Ameliyat İzleri & Skarlar",
        note: { en: "Softens and flattens surgical and acne scarring.", tr: "Ameliyat ve akne izlerini yumuşatır ve düzleştirir." } },
      { en: "Pigmentation", tr: "Pigmentasyon (Leke)",
        note: { en: "Helps even out tone and sun spots.", tr: "Ton eşitsizliği ve güneş lekelerini dengelemeye yardımcı olur." } },
      { en: "Stretch Marks", tr: "Çatlaklar",
        note: { en: "Improves texture and colour of stretch marks.", tr: "Çatlakların doku ve rengini iyileştirir." } }
    ],
    facts: {
      duration: { en: "45–75 minutes", tr: "45–75 dakika" },
      sessions: { en: "Course of 3–6, 4 weeks apart", tr: "4 hafta arayla 3–6 seans" },
      downtime: { en: "Redness 1–3 days", tr: "1–3 gün kızarıklık" },
      results:  { en: "Progressive over 3–6 months", tr: "3–6 ay boyunca kademeli" }
    }
  }
];
