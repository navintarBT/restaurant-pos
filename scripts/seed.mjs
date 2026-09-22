/**
 * Seed script — adds a starter Lao-language menu (categories + products) for
 * a pub: beer, cocktails, whiskey sets, bar snacks, mixers/water. Every
 * photo is a generated SVG placeholder (colored background + emoji) embedded
 * as a data: URI, so nothing depends on a real photo existing yet — replace
 * any of them later from the app's own "แก้ไขเมนู" (edit menu) screen.
 *
 * Usage: node scripts/seed.mjs [shopId]
 *   (shopId defaults to the only shop found in Firestore if omitted)
 *
 * Requires: scripts/service-account.json
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";

const SERVICE_ACCOUNT_PATH = "./scripts/service-account.json";

if (!existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("❌ ບໍ່ພົບ scripts/service-account.json");
  process.exit(1);
}

const app = initializeApp({
  credential: cert(JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"))),
});
const db = getFirestore(app);

function svgPhoto(emoji, bg) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${bg}"/><text x="50%" y="53%" font-size="190" text-anchor="middle" dominant-baseline="central">${emoji}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const CATEGORIES = ["ເບຍ", "ຄັອກເທວ", "ເຫຼົ້າ", "ອາຫານກິນຫຼິ້ນ", "ນ້ຳດື່ມ"];

const PRODUCTS = [
  { name: "ເບຍລາວ ແກ້ວ", category: "ເບຍ", price: 15000, cost: 8000, stock: 100, needsKitchen: false, emoji: "🍺", bg: "#FDE68A" },
  { name: "ເບຍລາວ ຂວດໃຫຍ່", category: "ເບຍ", price: 25000, cost: 14000, stock: 80, needsKitchen: false, emoji: "🍺", bg: "#FCD34D" },
  { name: "ເບຍລາວ ກະປ໋ອງ", category: "ເບຍ", price: 20000, cost: 11000, stock: 100, needsKitchen: false, emoji: "🥫", bg: "#FBBF24" },
  { name: "ເບຍລາວ ດຳ", category: "ເບຍ", price: 25000, cost: 14000, stock: 50, needsKitchen: false, emoji: "🍺", bg: "#92400E" },
  { name: "ໂມຈິໂຕ", category: "ຄັອກເທວ", price: 45000, cost: 20000, stock: 30, needsKitchen: false, emoji: "🍹", bg: "#6EE7B7" },
  { name: "ຈິນໂທນິກ", category: "ຄັອກເທວ", price: 50000, cost: 22000, stock: 30, needsKitchen: false, emoji: "🍸", bg: "#93C5FD" },
  { name: "ລອງໄອແລນ ໄອສ໌ທີ", category: "ຄັອກເທວ", price: 55000, cost: 25000, stock: 25, needsKitchen: false, emoji: "🍹", bg: "#FCA5A5" },
  { name: "ວິສກີ້ Hennessy VS (ແກ້ວ)", category: "ເຫຼົ້າ", price: 35000, cost: 20000, stock: 40, needsKitchen: false, emoji: "🥃", bg: "#D97706" },
  { name: "ຊຸດ Hennessy VS (ຂວດ)", category: "ເຫຼົ້າ", price: 850000, cost: 600000, stock: 10, needsKitchen: false, emoji: "🍾", bg: "#B45309" },
  { name: "ຊຸດ Johnnie Walker Red (ຂວດ)", category: "ເຫຼົ້າ", price: 650000, cost: 450000, stock: 10, needsKitchen: false, emoji: "🍾", bg: "#DC2626" },
  { name: "ໄກ່ທອດ", category: "ອາຫານກິນຫຼິ້ນ", price: 35000, cost: 18000, stock: 40, needsKitchen: true, emoji: "🍗", bg: "#FBBF24" },
  { name: "ກຸ້ງແຊ່ນ້ຳປາ", category: "ອາຫານກິນຫຼິ້ນ", price: 55000, cost: 30000, stock: 25, needsKitchen: true, emoji: "🦐", bg: "#FCA5A5" },
  { name: "ສົ້ມຕຳ", category: "ອາຫານກິນຫຼິ້ນ", price: 25000, cost: 12000, stock: 40, needsKitchen: true, emoji: "🥗", bg: "#86EFAC" },
  { name: "ແຄບໝູ", category: "ອາຫານກິນຫຼິ້ນ", price: 30000, cost: 15000, stock: 30, needsKitchen: true, emoji: "🥓", bg: "#FDBA74" },
  { name: "ເຂົ້າໜຽວ", category: "ອາຫານກິນຫຼິ້ນ", price: 10000, cost: 4000, stock: 50, needsKitchen: true, emoji: "🍚", bg: "#FEF3C7" },
  { name: "ນ້ຳດື່ມ", category: "ນ້ຳດື່ມ", price: 5000, cost: 2000, stock: 100, needsKitchen: false, emoji: "💧", bg: "#7DD3FC" },
  { name: "ໂຄກ / ສະໄປ", category: "ນ້ຳດື່ມ", price: 10000, cost: 5000, stock: 100, needsKitchen: false, emoji: "🥤", bg: "#FCA5A5" },
  { name: "ໂຊດາ", category: "ນ້ຳດື່ມ", price: 8000, cost: 3000, stock: 100, needsKitchen: false, emoji: "🥤", bg: "#BAE6FD" },
];

async function main() {
  let shopId = process.argv[2];

  if (!shopId) {
    const snap = await db.collection("shops").limit(1).get();
    if (snap.empty) { console.error("❌ ບໍ່ພົບ shop ໃດໃນ Firestore"); process.exit(1); }
    shopId = snap.docs[0].id;
    console.log(`🔍 ພົບ shopId: ${shopId} (${snap.docs[0].data().name ?? ""})`);
  }

  console.log(`\n🌱 ກຳລັງເພີ່ມໝວດໝູ່ + ເມນູຕົວຢ່າງ ໃສ່ shop "${shopId}"...\n`);

  const catRef = {};
  for (const name of CATEGORIES) {
    const existing = await db.collection(`shops/${shopId}/categories`).where("name", "==", name).limit(1).get();
    if (!existing.empty) {
      catRef[name] = existing.docs[0].id;
      console.log(`  · ໝວດ "${name}" ມີແລ້ວ`);
      continue;
    }
    const ref = await db.collection(`shops/${shopId}/categories`).add({ name });
    catRef[name] = ref.id;
    console.log(`  ✓ ສ້າງໝວດ "${name}"`);
  }

  console.log("");
  let added = 0, skipped = 0;
  for (const p of PRODUCTS) {
    const existing = await db.collection(`shops/${shopId}/products`).where("name", "==", p.name).limit(1).get();
    if (!existing.empty) {
      console.log(`  · "${p.name}" ມີແລ້ວ — ຂ້າມ`);
      skipped++;
      continue;
    }
    await db.collection(`shops/${shopId}/products`).add({
      name: p.name,
      category: p.category,
      price: p.price,
      costPrice: p.cost,
      photoUrl: svgPhoto(p.emoji, p.bg),
      needsKitchen: p.needsKitchen,
      variants: [{ size: "ປົກກະຕິ", color: "ປົກກະຕິ", stock: p.stock, minStock: 5 }],
    });
    console.log(`  ✓ ເພີ່ມ "${p.name}" (${p.price.toLocaleString()} ກີບ)`);
    added++;
  }

  console.log(`\n✅ ແລ້ວໆ — ເພີ່ມໃໝ່ ${added} ລາຍການ, ຂ້າມ (ມີແລ້ວ) ${skipped} ລາຍການ`);
}

main().catch((e) => { console.error(e); process.exit(1); });
