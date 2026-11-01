// The vehicle list customers and shops pick from (no free text): the makes and main models common in Palestine.
// Seeded into the Vehicle table by src/seed/vehicles.ts (idempotent). Make / model strings are the exact ones fitment rows
// store, so a customer's car and a shop's "fits these cars" always compare equal. Years: first and last model year
// sold here (ongoing models end at the current year + 1). Arabic names are what people type / read locally.
const NOW = new Date().getFullYear() + 1;

type M = [model: string, modelAr: string, yearFrom: number, yearTo: number];
export const VEHICLE_CATALOG: { make: string; makeAr: string; models: M[] }[] = [
  {
    make: "Toyota",
    makeAr: "تويوتا",
    models: [
      ["Corolla", "كورولا", 1995, NOW],
      ["Yaris", "يارس", 1999, NOW],
      ["Camry", "كامري", 1997, NOW],
      ["RAV4", "راف فور", 2000, NOW],
      ["Hilux", "هايلكس", 1997, NOW],
      ["Land Cruiser", "لاند كروزر", 1998, NOW],
      ["Prius", "بريوس", 2004, NOW],
      ["C-HR", "سي اتش ار", 2017, NOW],
    ],
  },
  {
    make: "Hyundai",
    makeAr: "هيونداي",
    models: [
      ["Elantra", "النترا", 2000, NOW],
      ["Accent", "أكسنت", 2000, NOW],
      ["i10", "آي 10", 2008, NOW],
      ["i20", "آي 20", 2009, NOW],
      ["i30", "آي 30", 2007, NOW],
      ["Tucson", "توسان", 2005, NOW],
      ["Santa Fe", "سانتا في", 2001, NOW],
      ["Sonata", "سوناتا", 2000, NOW],
      ["Kona", "كونا", 2018, NOW],
    ],
  },
  {
    make: "Kia",
    makeAr: "كيا",
    models: [
      ["Picanto", "بيكانتو", 2004, NOW],
      ["Rio", "ريو", 2000, NOW],
      ["Cerato", "سيراتو", 2004, NOW],
      ["Sportage", "سبورتاج", 2000, NOW],
      ["Sorento", "سورينتو", 2003, NOW],
      ["Optima", "أوبتيما", 2001, 2020],
      ["Niro", "نيرو", 2017, NOW],
      ["Stonic", "ستونيك", 2018, NOW],
    ],
  },
  {
    make: "Volkswagen",
    makeAr: "فولكس فاجن",
    models: [
      ["Golf", "جولف", 1998, NOW],
      ["Polo", "بولو", 1999, NOW],
      ["Passat", "باسات", 1997, NOW],
      ["Jetta", "جيتا", 2005, NOW],
      ["Tiguan", "تيغوان", 2008, NOW],
      ["Caddy", "كادي", 2004, NOW],
      ["Transporter", "ترانسبورتر", 2003, NOW],
    ],
  },
  {
    make: "Skoda",
    makeAr: "سكودا",
    models: [
      ["Octavia", "أوكتافيا", 1998, NOW],
      ["Fabia", "فابيا", 2000, NOW],
      ["Superb", "سوبيرب", 2002, NOW],
      ["Rapid", "رابيد", 2012, 2022],
      ["Kodiaq", "كودياك", 2017, NOW],
      ["Karoq", "كاروك", 2018, NOW],
    ],
  },
  {
    make: "Mercedes",
    makeAr: "مرسيدس",
    models: [
      ["A-Class", "الفئة A", 1998, NOW],
      ["C-Class", "الفئة C", 1994, NOW],
      ["E-Class", "الفئة E", 1995, NOW],
      ["S-Class", "الفئة S", 1998, NOW],
      ["Vito", "فيتو", 1996, NOW],
      ["Sprinter", "سبرنتر", 1996, NOW],
    ],
  },
  {
    make: "BMW",
    makeAr: "بي إم دبليو",
    models: [
      ["1 Series", "الفئة الأولى", 2004, NOW],
      ["3 Series", "الفئة الثالثة", 1998, NOW],
      ["5 Series", "الفئة الخامسة", 1996, NOW],
      ["X1", "إكس 1", 2009, NOW],
      ["X3", "إكس 3", 2004, NOW],
      ["X5", "إكس 5", 2000, NOW],
    ],
  },
  {
    make: "Peugeot",
    makeAr: "بيجو",
    models: [
      ["206", "206", 1998, 2012],
      ["207", "207", 2006, 2014],
      ["208", "208", 2012, NOW],
      ["301", "301", 2012, NOW],
      ["308", "308", 2007, NOW],
      ["2008", "2008", 2013, NOW],
      ["3008", "3008", 2009, NOW],
      ["Partner", "بارتنر", 1997, NOW],
    ],
  },
  {
    make: "Renault",
    makeAr: "رينو",
    models: [
      ["Clio", "كليو", 1998, NOW],
      ["Megane", "ميجان", 1996, NOW],
      ["Symbol", "سيمبول", 1999, 2021],
      ["Fluence", "فلوانس", 2010, 2017],
      ["Kangoo", "كانجو", 1998, NOW],
      ["Captur", "كابتشر", 2013, NOW],
    ],
  },
  {
    make: "Mitsubishi",
    makeAr: "ميتسوبيشي",
    models: [
      ["Lancer", "لانسر", 1995, 2017],
      ["Outlander", "أوتلاندر", 2003, NOW],
      ["Pajero", "باجيرو", 1991, 2021],
      ["ASX", "إيه إس إكس", 2010, NOW],
      ["Attrage", "أتراج", 2013, NOW],
      ["L200", "إل 200", 1996, NOW],
    ],
  },
  {
    make: "Nissan",
    makeAr: "نيسان",
    models: [
      ["Sunny", "صني", 1995, NOW],
      ["Micra", "ميكرا", 1992, NOW],
      ["Qashqai", "قاشقاي", 2007, NOW],
      ["X-Trail", "إكس تريل", 2001, NOW],
      ["Juke", "جوك", 2010, NOW],
      ["Navara", "نافارا", 1997, NOW],
    ],
  },
  {
    make: "Ford",
    makeAr: "فورد",
    models: [
      ["Focus", "فوكس", 1998, 2025],
      ["Fiesta", "فييستا", 1995, 2023],
      ["Transit", "ترانزيت", 1994, NOW],
      ["Kuga", "كوجا", 2008, NOW],
      ["Ranger", "رينجر", 1998, NOW],
    ],
  },
  {
    make: "Seat",
    makeAr: "سيات",
    models: [
      ["Ibiza", "إيبيزا", 1999, NOW],
      ["Leon", "ليون", 1999, NOW],
      ["Arona", "أرونا", 2017, NOW],
      ["Ateca", "أتيكا", 2016, NOW],
    ],
  },
  {
    make: "Audi",
    makeAr: "أودي",
    models: [
      ["A3", "إيه 3", 1996, NOW],
      ["A4", "إيه 4", 1995, NOW],
      ["A6", "إيه 6", 1997, NOW],
      ["Q3", "كيو 3", 2011, NOW],
      ["Q5", "كيو 5", 2008, NOW],
      ["Q7", "كيو 7", 2006, NOW],
    ],
  },
  {
    make: "Opel",
    makeAr: "أوبل",
    models: [
      ["Corsa", "كورسا", 1993, NOW],
      ["Astra", "أسترا", 1998, NOW],
      ["Insignia", "إنسيغنيا", 2008, 2022],
      ["Mokka", "موكا", 2012, NOW],
      ["Vectra", "فيكترا", 1995, 2008],
    ],
  },
];

/** Lowercase, trimmed, inner spaces collapsed: the form used for matching (same as fitment rows). */
export const normVehicle = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
