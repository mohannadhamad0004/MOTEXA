// The trail above every provider / admin page ("Parts admin › 3D models › W202 import"): one table of page names and the few
// logical parents that differ from the URL. The area root (Parts admin, Parts shop, …) comes from the area, the current page from
// its own title. Pure, so the tests can check it.
export type Crumb = { href: string; en: string; ar: string };

const LABELS: Record<string, [string, string]> = {
  // department admins (/dept: parts, tow, mechanics)
  "/dept/requests": ["Requests", "الطلبات"], "/dept/directory": ["Directory", "الدليل"], "/dept/messages": ["Messages", "الرسائل"], "/dept/profile": ["Profile", "الملف الشخصي"],
  "/dept/3d": ["3D models", "النماذج ثلاثية الأبعاد"], "/dept/3d/vehicles": ["Car 3D models", "نماذج السيارات"], "/dept/3d/accessories": ["Accessory 3D models", "نماذج الإكسسوارات"],
  "/dept/3d/requests": ["3D requests", "طلبات ثلاثية الأبعاد"], "/dept/3d/add": ["Add 3D model", "إضافة نموذج"],
  "/dept/vehicles": ["Vehicle catalog", "كتالوج المركبات"], "/dept/vehicles/requests": ["Vehicle requests", "طلبات المركبات"],
  "/dept/accessory-zones": ["Accessory fitting", "تركيب الإكسسوارات"], "/dept/accessory-fits": ["Bulk fits", "التركيب الجماعي"],
  "/dept/accessory3d": ["Accessory 3D requests", "طلبات الإكسسوارات ثلاثية الأبعاد"], "/dept/3d-submissions": ["Car 3D submissions", "طلبات نماذج السيارات"],
  "/dept/vehicle3d": ["Customer car 3D", "نماذج سيارات العملاء"], "/dept/orders": ["Orders", "الطلبات"], "/dept/tows": ["Tow jobs", "مهام السحب"],
  "/dept/tows/drivers": ["Drivers", "السائقون"], "/dept/tows/history": ["History", "السجل"], "/dept/tows/reports": ["Reports", "البلاغات"],
  // parts shop
  "/provider/parts/products": ["Products", "المنتجات"], "/provider/parts/orders": ["Orders", "الطلبات"], "/provider/parts/orders/list": ["Orders", "الطلبات"],
  "/provider/parts/messages": ["Messages", "الرسائل"], "/provider/parts/profile": ["Profile", "الملف"], "/provider/parts/inquiries": ["Inquiries", "الاستفسارات"],
  "/provider/parts/3d": ["3D models", "النماذج ثلاثية الأبعاد"],
  // tow company
  "/provider/tow/jobs": ["Jobs", "المهام"], "/provider/tow/fleet": ["Fleet", "الأسطول"], "/provider/tow/messages": ["Messages", "الرسائل"], "/provider/tow/profile": ["Profile", "الملف"],
  "/provider/tow/dispatch": ["Dispatch", "التوزيع"],
  // garage owner
  "/garage/requests": ["Requests", "الطلبات"], "/garage/mechanics": ["Mechanics", "الميكانيكيون"], "/garage/messages": ["Messages", "الرسائل"], "/garage/profile": ["Profile", "الملف"],
  // mechanic, super admin
  "/mechanic/requests": ["Requests", "الطلبات"],
  "/admin/providers": ["Providers", "مقدمو الخدمة"], "/admin/requests": ["Requests", "الطلبات"], "/admin/more": ["More", "المزيد"],
  "/admin/shops": ["Parts shops", "متاجر القطع"], "/admin/tow": ["Tow companies", "شركات السحب"],
};

/** where a page really belongs when that is not its URL parent */
const OVERRIDES: [RegExp, string][] = [
  [/^\/dept\/vehicles\/imports(\/|$)/, "/dept/3d/vehicles"],
  [/^\/dept\/vehicles$/, "/dept/3d"], [/^\/dept\/vehicles\/requests$/, "/dept/3d"],
  [/^\/dept\/(accessory-zones|accessory3d|3d-submissions|vehicle3d)$/, "/dept/3d"],
  [/^\/dept\/accessory-fits$/, "/dept/accessory-zones"],
  [/^\/dept\/review\//, "/dept/requests"], [/^\/dept\/mechanic-requests\//, "/dept/requests"],
  [/^\/dept\/thread\//, "/dept/messages"],
  [/^\/dept\/edit\/(shop|product)\//, "/dept/directory"], [/^\/dept\/edit\/(company|truck)\//, "/dept/directory"],
  [/^\/dept\/(map|directory-map)$/, "/dept/directory"],
  [/^\/provider\/parts\/orders\/(chat|map)\//, "/provider/parts/orders"],
  [/^\/provider\/parts\/motexa$/, "/provider/parts/messages"], [/^\/provider\/tow\/motexa$/, "/provider/tow/messages"],
  [/^\/provider\/parts\/(inventory|fitment|categories)$/, "/provider/parts/products"],
  [/^\/provider\/parts\/(business|delivery|media|settings|analytics|preview)$/, "/provider/parts/profile"],
  [/^\/provider\/tow\/(requests|dispatch)\//, "/provider/tow/jobs"],
  [/^\/provider\/tow\/(drivers|trucks)$/, "/provider/tow/fleet"], [/^\/provider\/tow\/(live|active|history)$/, "/provider/tow/dispatch"],
  [/^\/provider\/tow\/(availability|service-area|company|media|settings|stats|preview)$/, "/provider/tow/profile"],
  [/^\/provider\/tow\/[0-9a-f]{8}-[0-9a-f-]{27}$/, "/provider/tow/fleet"], // a truck (/provider/tow/<uuid>)
  [/^\/garage\/motexa$/, "/garage/messages"], [/^\/garage\/(info|live)$/, "/garage/profile"],
  [/^\/dept\/garage-mechanics$/, "/dept/directory"], [/^\/dept\/mechanics-live$/, "/dept/requests"],
];

export function parentOf(path: string): string | null {
  for (const [re, parent] of OVERRIDES) if (re.test(path) && parent !== path) return parent;
  let p = path;
  while (p.lastIndexOf("/") > 0) { p = p.slice(0, p.lastIndexOf("/")); if (LABELS[p]) return p; }
  return null;
}

/** the labelled pages between the area root and this page (root and the page itself excluded) */
export function crumbsFor(path: string): Crumb[] {
  const out: Crumb[] = [];
  const seen = new Set<string>([path]);
  for (let p = parentOf(path); p && !seen.has(p) && out.length < 6; p = parentOf(p)) {
    seen.add(p);
    const l = LABELS[p];
    if (l) out.unshift({ href: p, en: l[0], ar: l[1] });
  }
  return out;
}

/** the area every provider / admin path belongs to (its root crumb); the department layout names its own department */
export function areaRoot(path: string): Crumb {
  if (path.startsWith("/provider/parts")) return { href: "/provider/parts", en: "Parts shop", ar: "متجر القطع" };
  if (path.startsWith("/provider/tow")) return { href: "/provider/tow", en: "Tow company", ar: "شركة السحب" };
  if (path.startsWith("/provider/onboarding")) return { href: "/provider/onboarding", en: "Application", ar: "الطلب" };
  if (path.startsWith("/driver")) return { href: "/driver", en: "Driver", ar: "السائق" };
  if (path.startsWith("/mechanic")) return { href: "/mechanic", en: "Mechanic", ar: "الميكانيكي" };
  if (path.startsWith("/garage")) return { href: "/garage", en: "Garage", ar: "الكراج" };
  if (path.startsWith("/admin")) return { href: "/admin", en: "Super admin", ar: "المشرف العام" };
  return { href: "/dept", en: "Department", ar: "القسم" };
}
