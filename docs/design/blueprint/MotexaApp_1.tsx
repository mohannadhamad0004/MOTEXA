import { createContext, useContext, useState, type ReactNode } from "react";
import { dict, type Key, type Lang } from "./i18n";
import { BrakeDisc, CarTop, Construction, Icon, SparkPlug, TowTruck, Wrench } from "./drawings";

type Screen = "home" | "parts" | "product" | "tow" | "status" | "mechanics" | "profile";
type Ctx = { t: (k: Key) => string; go: (s: Screen) => void; lang: Lang; setLang: (l: Lang) => void; dark: boolean; setDark: (d: boolean) => void; active: boolean };
const C = createContext<Ctx>(null!);
const useM = () => useContext(C);

/* ---------- primitives ---------- */
const Ltr = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <span dir="ltr" className={`inline-block ${className}`}>{children}</span>
);
const Mono = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <span dir="ltr" className={`inline-block font-mono text-[12px] text-soft ${className}`}>{children}</span>
);

function Hero({ tl, tr, bl, br, children, h = "h-[300px]" }: { tl: ReactNode; tr: ReactNode; bl?: ReactNode; br?: ReactNode; children: ReactNode; h?: string }) {
  return (
    <div className={`blueprint relative overflow-hidden ${h} text-cream`}>
      <Construction />
      <div className="tag absolute start-5 top-5 text-cream/70">{tl}</div>
      <div className="tag absolute end-5 top-5 text-bronze-light">{tr}</div>
      <div className="absolute inset-x-6 top-12 bottom-14 flex items-center justify-center">{children}</div>
      {(bl || br) && (
        <div className="absolute inset-x-5 bottom-12 flex items-end justify-between gap-3">
          <div className="tag text-cream/70">{bl}</div>
          <div className="tag max-w-[45%] text-end text-cream/50">{br}</div>
        </div>
      )}
    </div>
  );
}

function Sheet({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`relative -mt-8 rounded-t-[32px] bg-sheet px-5 pt-7 pb-28 ${className}`}>{children}</div>;
}

const Pill = ({ icon, children }: { icon?: ReactNode; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-pill px-3 py-1.5 text-[12px] font-semibold text-ink">{icon}{children}</span>
);

const H1 = ({ children }: { children: ReactNode }) => (
  <h1 className="mt-4 text-[36px] font-bold leading-[1.05] tracking-tight text-ink rtl:leading-[1.3] rtl:tracking-normal">{children}</h1>
);
const Sub = ({ children }: { children: ReactNode }) => <p className="mt-3 text-[15px] leading-relaxed text-soft">{children}</p>;

const Section = ({ n, title, children }: { n: string; title: string; children: ReactNode }) => (
  <section className="rise mt-10">
    <div className="mb-4 flex items-baseline gap-3">
      <Mono className="text-bronze">{n} —</Mono>
      <h2 className="text-[18px] font-bold text-ink">{title}</h2>
    </div>
    {children}
  </section>
);

function SearchField() {
  const { t } = useM();
  return (
    <label className="mt-6 flex h-14 items-center gap-3 rounded-[20px] border border-line bg-field px-4 text-soft">
      <Icon.search />
      <input className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-soft" placeholder={t("search")} />
    </label>
  );
}

const Chip = ({ children, on }: { children: ReactNode; on?: boolean }) => (
  <button className={`press inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold ${on ? "border-ink bg-btn text-btn-foreground" : "border-line bg-field text-ink"}`}>{children}</button>
);

const Primary = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
  <button onClick={onClick} className="press flex h-14 w-full items-center justify-center gap-2 rounded-full bg-btn text-[15px] font-bold text-btn-foreground">{children}</button>
);

const Stamp = ({ label }: { label: string }) => (
  <div className="grid size-14 shrink-0 place-items-center rounded-full border border-dashed border-bronze text-bronze">
    <div className="grid size-11 place-items-center rounded-full border border-bronze text-center">
      <Icon.check className="size-4" />
      <span className="-mt-1 text-[8px] font-bold uppercase tracking-wider rtl:tracking-normal">{label}</span>
    </div>
  </div>
);

const PartThumb = ({ kind = "disc", className = "size-20" }: { kind?: "disc" | "plug" | "box"; className?: string }) => (
  <div className={`blueprint grid shrink-0 place-items-center rounded-[16px] p-2 ${className}`}>
    {kind === "disc" ? <BrakeDisc className="h-full w-full" /> : kind === "plug" ? <SparkPlug className="h-full w-full" /> : <Icon.box className="h-3/5 w-3/5 text-bronze-light" />}
  </div>
);

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex items-center justify-between gap-4 border-b border-line/60 py-3.5 text-[14px]">
    <span className="text-soft">{label}</span>
    <span className="text-end font-semibold text-ink">{value}</span>
  </div>
);

function Steps({ i }: { i: number }) {
  const { t } = useM();
  const s = [t("sRequested"), t("sAccepted"), t("sOnWay"), t("sDone")];
  return (
    <div className="mt-4 flex items-start">
      {s.map((l, k) => (
        <div key={k} className="flex flex-1 flex-col items-center gap-2 text-center">
          <div className="relative flex w-full items-center justify-center">
            {k > 0 && <span className={`absolute end-1/2 h-px w-full ${k <= i ? "bg-bronze" : "border-t border-dashed border-line"}`} />}
            <span className={`relative grid size-6 place-items-center rounded-full border ${k < i ? "border-bronze bg-bronze text-sheet" : k === i ? "border-bronze bg-sheet" : "border-line bg-sheet"}`}>
              {k < i ? <Icon.check className="size-3.5" /> : k === i ? <span className="size-2.5 rounded-full bg-bronze" /> : null}
            </span>
          </div>
          <span className={`text-[11px] ${k <= i ? "font-bold text-ink" : "text-soft"}`}>{l}</span>
        </div>
      ))}
    </div>
  );
}

function BackBtn({ to }: { to: Screen }) {
  const { go } = useM();
  return (
    <button onClick={() => go(to)} aria-label="Back" className="press absolute start-4 top-12 z-10 grid size-11 place-items-center rounded-full border border-cream/20 bg-blueprint/60 text-cream">
      <Icon.back className="size-5 rtl:-scale-x-100" />
    </button>
  );
}

/* ---------- data ---------- */
const products = [
  { name: "Front brake pads", nameAr: "فحمات فرامل أمامية", price: "180.00", brand: "Bosch", pn: "0 986 494 570", shop: "Al-Mahaba · Nablus", kind: "disc" as const },
  { name: "Brake disc, ventilated", nameAr: "ديسك فرامل مهوّى", price: "260.00", brand: "Brembo", pn: "09.A913.11", shop: "Al-Mahaba · Nablus", kind: "disc" as const },
  { name: "Spark plug, iridium", nameAr: "بوجيه إيريديوم", price: "45.00", brand: "Denso", pn: "SC16HR11", shop: "Al-Quds Parts · Ramallah", kind: "plug" as const },
  { name: "Oil filter", nameAr: "فلتر زيت", price: "35.00", brand: "Toyota", pn: "04152-YZZA6", shop: "Al-Mahaba · Nablus", kind: "box" as const },
];
const shops = [
  { n: "Al-Mahaba Auto Parts", c: "Nablus" },
  { n: "Al-Quds Parts", c: "Ramallah" },
  { n: "Hebron Motors Supply", c: "Hebron" },
];
const mechanics = [
  { n: "Khaled Odeh", w: "Abu Khaled Workshop", c: "Nablus", d: "3.2", s: ["Engine", "Brakes"] },
  { n: "Samer Haddad", w: "Haddad Auto Care", c: "Ramallah", d: null, s: ["Electrical", "A/C"] },
  { n: "Yousef Tamimi", w: "Tamimi Garage", c: "Hebron", d: null, s: ["Suspension", "Brakes"] },
  { n: "Rami Saleh", w: "Saleh Motors", c: "Jenin", d: null, s: ["Engine", "Gearbox"] },
];

/* ---------- screens ---------- */
function Home() {
  const { t, go, lang, active } = useM();
  return (
    <>
      <Hero tl={t("greeting")} tr={<Ltr>M / 01</Ltr>} bl={t("carName")} br={t("forward")}>
        <CarTop className="w-full max-w-[300px]" />
      </Hero>
      <Sheet>
        {active && (
          <button onClick={() => go("status")} className="rise press mb-8 w-full rounded-[20px] border border-bronze bg-field p-4 text-start">
            <div className="flex items-center justify-between">
              <span className="tag text-bronze">{t("activeTow")}</span>
              <Mono>[REQ-ID]</Mono>
            </div>
            <p className="mt-2 text-[15px] font-bold text-ink">{t("accepted")}</p>
            <Steps i={1} />
            <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-bold text-bronze">{t("viewReq")} <Icon.arrow className="size-4 rtl:-scale-x-100" /></span>
          </button>
        )}
        <Pill icon={<Icon.shield className="size-4 text-bronze" />}>{t("carOwner")}</Pill>
        <H1>{t("homeTitle")}</H1>
        <Sub>{t("homeSub")}</Sub>
        <SearchField />

        <button onClick={() => go("tow")} className="rise press blueprint relative mt-6 w-full overflow-hidden rounded-[24px] p-5 text-start text-cream">
          <div className="flex items-start justify-between">
            <span className="tag text-bronze-light"><Ltr>TOW / 02</Ltr></span>
            <Icon.arrow className="size-5 text-bronze-light rtl:-scale-x-100" />
          </div>
          <TowTruck className="mx-auto my-2 h-24 w-full" />
          <p className="text-[22px] font-bold">{t("reqTow")}</p>
          <p className="text-[13px] text-cream/70">{t("reqTowSub")}</p>
        </button>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            { k: "buyParts" as const, s: "buyPartsSub" as const, i: <Icon.parts />, to: "parts" as Screen, n: "03" },
            { k: "findMech" as const, s: "findMechSub" as const, i: <Icon.mech />, to: "mechanics" as Screen, n: "04" },
          ].map((x) => (
            <button key={x.k} onClick={() => go(x.to)} className="rise press flex min-h-36 flex-col justify-between rounded-[20px] border border-line bg-field p-4 text-start">
              <div className="flex justify-between text-bronze">{x.i}<Mono>{x.n}</Mono></div>
              <div>
                <p className="text-[16px] font-bold text-ink">{t(x.k)}</p>
                <p className="text-[12px] text-soft">{t(x.s)}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-3 flex h-14 items-center justify-between rounded-[18px] border border-dashed border-line px-4 text-soft">
          <span className="flex items-center gap-2 text-[14px] font-semibold"><Icon.spark className="size-4" />{t("ai")}</span>
          <span className="text-[12px]">{t("soon")}</span>
        </div>

        <Section n="01" title={t("recent")}>
          <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5">
            {products.map((p) => (
              <button key={p.pn} onClick={() => go("product")} className="press w-40 shrink-0 rounded-[20px] border border-line bg-field p-2.5 text-start">
                <PartThumb kind={p.kind} className="aspect-square w-full" />
                <p className="mt-2.5 line-clamp-1 text-[13px] font-semibold text-ink">{lang === "ar" ? p.nameAr : p.name}</p>
                <Ltr className="text-[15px] font-bold text-ink">₪ {p.price}</Ltr>
              </button>
            ))}
          </div>
        </Section>
        <Section n="02" title={t("shops")}>
          {shops.map((s) => (
            <div key={s.n} className="flex items-center gap-3 border-b border-line/60 py-3">
              <div className="grid size-11 place-items-center rounded-full bg-pill text-bronze"><Icon.shop /></div>
              <div className="flex-1"><p className="text-[14px] font-bold text-ink">{s.n}</p><p className="text-[12px] text-soft">{s.c}</p></div>
              <Icon.chev className="size-4 text-soft rtl:-scale-x-100" />
            </div>
          ))}
        </Section>
      </Sheet>
    </>
  );
}

function Parts() {
  const { t, go, lang } = useM();
  return (
    <>
      <Hero h="h-[220px]" tl={<Ltr>PARTS / 03</Ltr>} tr={t("results")}>
        <BrakeDisc className="h-full" />
      </Hero>
      <Sheet>
        <h1 className="text-[34px] font-bold leading-none text-ink">{t("partsTitle")}</h1>
        <Sub>{t("partsSub")}</Sub>
        <SearchField />
        <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
          <Chip on><Icon.check className="size-4" />{t("fits")}</Chip>
          <Chip><Icon.filter className="size-4" />{t("filters")}</Chip>
          <Chip>{t("sort")}<Icon.down className="size-4" /></Chip>
        </div>
        <div className="no-scrollbar -mx-5 mt-3 flex gap-5 overflow-x-auto border-b border-line px-5">
          {(["cAll", "cBrakes", "cEngine", "cFilters", "cElectric"] as const).map((c, i) => (
            <button key={c} className={`h-11 shrink-0 text-[14px] ${i === 1 ? "border-b-2 border-ink font-bold text-ink" : "text-soft"}`}>{t(c)}</button>
          ))}
        </div>
        <div className="mt-2">
          {products.map((p) => (
            <button key={p.pn} onClick={() => go("product")} className="rise press flex w-full gap-4 border-b border-line/60 py-4 text-start">
              <PartThumb kind={p.kind} className="size-24" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-ink">{lang === "ar" ? p.nameAr : p.name}</p>
                <Ltr className="mt-1 text-[22px] font-bold text-ink">₪ {p.price}</Ltr>
                <p className="text-[12px] text-soft">{p.brand} · {t("new")} · <Mono>{p.pn}</Mono></p>
                <p className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-bronze"><Icon.check className="size-3.5" />{t("fitsYour")}</p>
                <p className="text-[12px] text-soft">{p.shop}</p>
              </div>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

function Product() {
  const { t, lang } = useM();
  return (
    <>
      <div className="relative">
        <BackBtn to="parts" />
        <Hero h="h-[340px]" tl={<Ltr>PART NO. 0 986 494 570</Ltr>} tr={t("brakes")} bl={<Ltr>Ø 275 MM</Ltr>} br={<Ltr>REV. A</Ltr>}>
          <BrakeDisc dims className="h-full" />
        </Hero>
      </div>
      <Sheet className="pb-36">
        <Mono>Bosch · 0 986 494 570</Mono>
        <h1 className="mt-2 text-[32px] font-bold leading-tight text-ink">{lang === "ar" ? products[0]!.nameAr : products[0]!.name}</h1>
        <Ltr className="mt-2 text-[28px] font-bold text-ink">₪ 180.00</Ltr>
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill icon={<Icon.check className="size-3.5 text-bronze" />}>{t("fitsYour")}</Pill>
          <Pill icon={<Icon.box className="size-3.5 text-bronze" />}>{t("inStock")}</Pill>
          <Pill icon={<Icon.spark className="size-3.5 text-bronze" />}>{t("new")}</Pill>
        </div>
        <Section n="01" title={t("pd")}>
          <Row label={t("brand")} value="Bosch" />
          <Row label={t("partNo")} value={<Mono className="text-ink">0 986 494 570</Mono>} />
          <Row label={t("condition")} value={t("new")} />
          <Row label={t("category")} value={t("brakes")} />
          <Row label={t("position")} value={t("front")} />
        </Section>
        <Section n="02" title={t("compat")}>
          <div className="flex items-center justify-between rounded-[18px] border border-bronze bg-field p-4">
            <div><p className="font-bold text-ink">Toyota Corolla</p><Mono>2014–2019</Mono></div>
            <Pill icon={<Icon.car className="size-4 text-bronze" />}>{t("yourCar")}</Pill>
          </div>
          <Row label="Toyota Auris" value={<Mono className="text-ink">2013–2018</Mono>} />
        </Section>
        <Section n="03" title={t("shop")}>
          <div className="flex items-center gap-4 rounded-[20px] border border-line bg-field p-4">
            <div className="grid size-12 place-items-center rounded-full bg-pill text-bronze"><Icon.shop /></div>
            <div className="flex-1"><p className="font-bold text-ink">Al-Mahaba Auto Parts</p><p className="flex items-center gap-1 text-[13px] text-soft"><Icon.pin className="size-4" />Nablus</p></div>
            <Stamp label={t("verified")} />
          </div>
        </Section>
      </Sheet>
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-4 border-t border-line bg-sheet/95 px-5 py-4 backdrop-blur">
        <Ltr className="text-[22px] font-bold text-ink">₪ 180.00</Ltr>
        <div className="flex-1"><Primary><Icon.chat className="size-5" />{t("ask")}</Primary></div>
      </div>
    </>
  );
}

function MapArt({ route = false }: { route?: boolean }) {
  return (
    <svg viewBox="0 0 390 460" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" fill="none">
      <g stroke="var(--bronze-light)" opacity="0.22" strokeWidth="6" strokeLinecap="round">
        <path d="M-10 120 C100 140 200 90 400 130" /><path d="M60 -10 C80 150 40 300 90 470" />
        <path d="M-10 330 C120 300 260 360 400 320" /><path d="M260 -10 C240 160 300 300 270 470" />
      </g>
      <g stroke="var(--bronze-light)" opacity="0.12" strokeWidth="2">
        <path d="M-10 220 L400 240 M160 -10 L180 470 M-10 40 L400 60 M330 -10 L350 470 M-10 410 L400 400" />
      </g>
      {route && (
        <path className="draw" d="M120 300 C150 260 160 210 200 190 C240 170 260 140 290 110" stroke="var(--bronze-light)" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 0" />
      )}
      <g transform="translate(120 300)">
        <circle r="10" fill="var(--customer)" className="pulse-ring" opacity="0.5" />
        <circle r="8" fill="var(--customer)" stroke="var(--cream)" strokeWidth="2.5" />
      </g>
      {[[290, 110], ...(route ? [] : [[230, 380], [60, 70]])].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <path d="M0 0 C-14 -14 -16 -22 -16 -28 a16 16 0 0 1 32 0 C16 -22 14 -14 0 0Z" fill="var(--bronze-light)" opacity={i ? 0.55 : 1} />
          <path d="M-8 -26 V-32 H-2 L0 -36 H4 V-26 M4 -29 H9 V-26" stroke="var(--blueprint)" strokeWidth="1.6" />
        </g>
      ))}
    </svg>
  );
}

function Tow() {
  const { t, go } = useM();
  return (
    <>
      <div className="blueprint relative h-[480px] overflow-hidden">
        <MapArt />
        <div className="tag absolute start-5 top-5 text-cream/70"><Ltr>TOW / 02</Ltr></div>
        <div className="tag absolute end-5 top-5 text-bronze-light">Nablus</div>
        <div className="absolute bottom-12 end-3 font-mono text-[9px] text-cream/50">© OpenStreetMap contributors</div>
      </div>
      <Sheet>
        <div className="mx-auto -mt-3 mb-5 h-1.5 w-12 rounded-full bg-line" />
        <h1 className="text-[28px] font-bold leading-tight text-ink">{t("nearby")}</h1>
        <p className="mt-1 flex items-center gap-2 text-[14px] text-soft"><span className="size-2 rounded-full bg-bronze" />{t("avail")}</p>
        <div className="mt-5"><Primary onClick={() => go("status")}><Icon.tow />{t("reqNearest")}</Primary></div>
        <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
          <Chip on>{t("availNow")}</Chip><Chip>{t("flatbed")}</Chip><Chip>{t("wheel")}</Chip>
        </div>
        <div className="rise mt-4 flex items-center gap-4 rounded-[20px] border border-line bg-field p-4">
          <div className="blueprint grid size-14 shrink-0 place-items-center rounded-[14px] text-bronze-light"><Icon.tow className="size-7" /></div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">Al-Noor Recovery & Towing</p>
            <p className="text-[12px] text-soft">Nablus · {t("towTypes")}</p>
            <p className="mt-1 text-[12px] font-semibold text-bronze">{t("truckFree")}</p>
          </div>
          <Ltr className="font-mono text-[13px] font-semibold text-ink">≈ 7.0 km</Ltr>
        </div>
      </Sheet>
    </>
  );
}

function Status() {
  const { t, go } = useM();
  const steps = [
    { l: t("sRequested"), s: "done" }, { l: t("sAccepted"), s: "now" }, { l: t("sOnWay"), s: "next" }, { l: t("sDone"), s: "next" },
  ];
  return (
    <>
      <div className="blueprint relative h-[320px] overflow-hidden">
        <MapArt route />
        <BackBtn to="home" />
        <div className="tag absolute end-5 top-5 text-bronze-light"><Ltr>ROUTE / 02</Ltr></div>
        <div className="absolute bottom-12 end-3 font-mono text-[9px] text-cream/50">© OpenStreetMap contributors</div>
      </div>
      <Sheet>
        <div className="flex items-center justify-between">
          <Mono>[REQ-ID]</Mono>
          <Pill icon={<span className="size-2 rounded-full bg-bronze" />}>{t("sAccepted")}</Pill>
        </div>
        <H1>{t("onReq")}</H1>
        <div className="mt-8">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className={`grid size-7 place-items-center rounded-full border ${s.s === "done" ? "border-bronze bg-bronze text-sheet" : s.s === "now" ? "border-bronze" : "border-line"}`}>
                  {s.s === "done" ? <Icon.check className="size-4" /> : s.s === "now" ? <span className="size-3 rounded-full bg-bronze" /> : <span className="size-2 rounded-full border border-line" />}
                </span>
                {i < 3 && <span className={`h-9 w-px ${i < 1 ? "bg-bronze" : "border-s border-dashed border-line"}`} />}
              </div>
              <div className="flex flex-1 justify-between pt-1">
                <span className={`text-[15px] ${s.s === "next" ? "text-soft" : "font-bold text-ink"}`}>{s.l}</span>
                {s.s !== "next" && <Mono>[time]</Mono>}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Row label={t("pickup")} value={t("pickupVal")} />
          <Row label={t("problem")} value={t("problemVal")} />
          <Row label={t("car")} value={t("carName")} />
        </div>
        <p className="mt-4 flex items-center gap-2 text-[12px] text-soft"><span className="size-1.5 animate-pulse rounded-full bg-bronze" />{t("auto")}</p>
        <div className="mt-10 border-t border-line pt-6 text-center">
          <button onClick={() => go("tow")} className="h-11 text-[15px] font-bold text-destructive">{t("cancel")}</button>
        </div>
      </Sheet>
    </>
  );
}

function Mechanics() {
  const { t } = useM();
  return (
    <>
      <Hero h="h-[260px]" tl={<Ltr>MECHANICS / 04</Ltr>} tr={t("verifiedBy")}>
        <Wrench className="h-full" />
      </Hero>
      <Sheet>
        <h1 className="text-[34px] font-bold leading-none text-ink">{t("mechTitle")}</h1>
        <Sub>{t("mechSub")}</Sub>
        <SearchField />
        <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
          <Chip>{t("city")}<Icon.down className="size-4" /></Chip>
          <Chip>{t("skill")}<Icon.down className="size-4" /></Chip>
          <Chip on><Icon.pin className="size-4" />{t("near")}</Chip>
        </div>
        <div className="mt-3">
          {mechanics.map((m, i) => (
            <div key={m.n} className="rise flex items-center gap-4 border-b border-line/60 py-5" style={{ animationDelay: `${i * 70}ms` }}>
              <div className="blueprint grid size-14 shrink-0 place-items-center rounded-full text-[20px] font-bold text-bronze-light">{m.n[0]}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold text-ink">{m.n}</p>
                <p className="text-[13px] text-soft">{m.w}</p>
                <p className="text-[12px] text-soft">{m.c}{m.d && <> · <Ltr className="font-mono">≈ {m.d} km</Ltr></>}</p>
                <div className="mt-2 flex gap-1.5">
                  {m.s.map((s) => <span key={s} className="rounded-full bg-pill px-2.5 py-1 text-[11px] font-semibold text-ink">{s}</span>)}
                  <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-soft"><Ltr>+2</Ltr></span>
                </div>
              </div>
              <Stamp label={t("verified")} />
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
}

function Profile() {
  const { t, lang, setLang, dark, setDark } = useM();
  const Seg = ({ opts, val, on }: { opts: [string, string][]; val: string; on: (v: string) => void }) => (
    <div className="flex rounded-full bg-pill p-1">
      {opts.map(([v, l]) => (
        <button key={v} onClick={() => on(v)} className={`h-9 rounded-full px-3 text-[12px] font-bold ${val === v ? "bg-btn text-btn-foreground" : "text-soft"}`}>{l}</button>
      ))}
    </div>
  );
  const Group = ({ title, children }: { title: string; children: ReactNode }) => (
    <div className="rise mt-8"><p className="tag mb-2 text-soft">{title}</p><div className="rounded-[20px] border border-line bg-field px-4">{children}</div></div>
  );
  const Item = ({ icon, label, right }: { icon: ReactNode; label: string; right?: ReactNode }) => (
    <div className="flex min-h-14 items-center gap-3 border-b border-line/50 py-2 last:border-0">
      <span className="text-bronze">{icon}</span><span className="flex-1 text-[14px] font-semibold text-ink">{label}</span>
      {right ?? <Icon.chev className="size-4 text-soft rtl:-scale-x-100" />}
    </div>
  );
  return (
    <>
      <Hero tl={t("workspace")} tr={<Ltr>M / 05</Ltr>} br={<span dir="ltr" className="rounded-md border border-bronze-light px-2 py-1 font-mono text-bronze-light">COROLLA · 2018</span>}>
        <CarTop className="w-full max-w-[280px]" />
      </Hero>
      <Sheet>
        <Pill icon={<Icon.shield className="size-4 text-bronze" />}>{t("carOwner")}</Pill>
        <H1>Mohannad Hamad</H1>
        <Mono className="mt-2">mohannad@motexa.ps</Mono>
        <Group title={t("myCar")}>
          <Item icon={<Icon.car />} label={t("carName")} />
        </Group>
        <Group title={t("settings")}>
          <Item icon={<Icon.globe />} label={t("language")} right={<Seg val={lang} on={(v) => setLang(v as Lang)} opts={[["en", "EN"], ["ar", "AR"]]} />} />
          <Item icon={<Icon.sun />} label={t("appearance")} right={<Seg val={dark ? "d" : "l"} on={(v) => setDark(v === "d")} opts={[["l", t("light")], ["d", t("dark")], ["s", t("system")]]} />} />
        </Group>
        <Group title={t("help")}>
          <Item icon={<Icon.help />} label={t("helpCenter")} />
          <Item icon={<Icon.chat />} label={t("contact")} />
        </Group>
        <button className="mt-8 h-12 w-full rounded-full border border-line text-[15px] font-bold text-destructive">{t("signOut")}</button>
      </Sheet>
    </>
  );
}

/* ---------- shell ---------- */
function Tabs({ cur }: { cur: Screen }) {
  const { t, go } = useM();
  const tabs: [Screen, Key, (p: { className?: string | undefined }) => ReactNode][] = [
    ["home", "home", Icon.home], ["parts", "parts", Icon.parts], ["mechanics", "mechanics", Icon.mech], ["tow", "tow", Icon.tow], ["profile", "profile", Icon.user],
  ];
  const active = cur === "product" ? "parts" : cur === "status" ? "tow" : cur;
  return (
    <nav className="absolute inset-x-3 bottom-3 z-20 flex rounded-[26px] border border-line bg-sheet/95 p-1.5 backdrop-blur">
      {tabs.map(([s, k, Ic]) => (
        <button key={s} onClick={() => go(s)} className={`press flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[10px] font-bold ${active === s ? "bg-btn text-btn-foreground" : "text-soft"}`}>
          <Ic className="size-5" />{t(k)}
        </button>
      ))}
    </nav>
  );
}

export default function MotexaApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [lang, setLang] = useState<Lang>("en");
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState(false);
  const go = (s: Screen) => {
    setScreen(s);
    document.getElementById("mx-scroll")?.scrollTo({ top: 0 });
  };
  const ctx: Ctx = { t: (k) => dict[lang][k], go, lang, setLang, dark, setDark, active };
  const Toggle = ({ on, a, b, onClick }: { on: boolean; a: string; b: string; onClick: () => void }) => (
    <button onClick={onClick} className="press flex h-9 items-center rounded-full bg-pill p-1 text-[11px] font-bold">
      <span className={`rounded-full px-2.5 py-1 ${!on ? "bg-btn text-btn-foreground" : "text-soft"}`}>{a}</span>
      <span className={`rounded-full px-2.5 py-1 ${on ? "bg-btn text-btn-foreground" : "text-soft"}`}>{b}</span>
    </button>
  );
  const views: Record<Screen, ReactNode> = {
    home: <Home />, parts: <Parts />, product: <Product />, tow: <Tow />, status: <Status />, mechanics: <Mechanics />, profile: <Profile />,
  };
  return (
    <C.Provider value={ctx}>
      <div className={`${dark ? "dark" : ""} min-h-screen`}>
        <div className="flex min-h-screen items-center justify-center gap-8 bg-page p-0 sm:p-8">
          <div className="fixed end-4 top-4 z-50 flex flex-col items-end gap-2 rounded-[20px] border border-line bg-sheet p-3 text-ink shadow-lg" dir="ltr">
            <span className="font-mono text-[10px] tracking-[0.2em] text-soft">MOTEXA / PROTO</span>
            <Toggle on={dark} a="Light" b="Dark" onClick={() => setDark(!dark)} />
            <Toggle on={lang === "ar"} a="EN" b="AR" onClick={() => setLang(lang === "en" ? "ar" : "en")} />
            <Toggle on={active} a="Req off" b="Req on" onClick={() => { setActive(!active); go("home"); }} />
          </div>
          <div className="relative h-screen w-full overflow-hidden bg-sheet sm:h-[844px] sm:w-[390px] sm:rounded-[54px] sm:border-[10px] sm:border-blueprint sm:shadow-2xl">
            <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="h-full">
              <div id="mx-scroll" key={screen + lang} className="no-scrollbar h-full overflow-y-auto">{views[screen]}</div>
              {screen !== "product" && <Tabs cur={screen} />}
            </div>
          </div>
        </div>
      </div>
    </C.Provider>
  );
}
