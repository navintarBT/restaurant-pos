// Curated Tabler icon set for category icons (https://tabler.io/icons),
// scoped down to exactly the menu-category themes this shop uses (food,
// drinks, rice/noodles, meat, seafood, bread, fast food, dessert, fruit,
// vegetable, chef, pot, spicy, recommended, favorite, cart) — not the full
// library. Each entry is tagged with search keywords in Lao, Thai, and
// English. `key` is what gets stored on Category.icon and looked up again
// via CATEGORY_ICON_MAP. The picker also accepts typing/pasting a raw emoji
// for anything not covered here (rendered as plain text by
// CategoryIconGlyph as a fallback).
import type { TablerIcon } from "@tabler/icons-react";
import {
  IconToolsKitchen2,
  IconBeer, IconGlassFull, IconBottle, IconCup, IconMug, IconCoffee, IconMilk,
  IconBowlChopsticks, IconBowlSpoon,
  IconMeat, IconSausage, IconPig,
  IconFish,
  IconBread,
  IconPizza, IconBurger,
  IconIceCream, IconIceCream2, IconCake, IconCookie, IconCandy,
  IconApple, IconBanana, IconCherry, IconGrape, IconLemon, IconAvocado,
  IconCarrot, IconLeaf, IconMushroom,
  IconChefHat,
  IconSoup,
  IconPepper, IconFlame,
  IconStar,
  IconHeart,
  IconShoppingCart,
} from "@tabler/icons-react";

export interface IconOption {
  key: string;
  icon: TablerIcon;
  keywords: string[];
}

export const CATEGORY_ICONS: IconOption[] = [
  // อาหาร (food, general)
  { key: "ToolsKitchen2", icon: IconToolsKitchen2, keywords: ["food", "อาหาร", "ອາຫານ"] },

  // เครื่องดื่ม (drinks)
  { key: "Beer", icon: IconBeer, keywords: ["drink", "beer", "เครื่องดื่ม", "เบียร์", "ເຄື່ອງດື່ມ", "ເບຍ"] },
  { key: "GlassFull", icon: IconGlassFull, keywords: ["drink", "glass", "เครื่องดื่ม", "แก้ว", "ເຄື່ອງດື່ມ", "ແກ້ວ"] },
  { key: "Bottle", icon: IconBottle, keywords: ["drink", "bottle", "เครื่องดื่ม", "ขวด", "ເຄື່ອງດື່ມ", "ຂວດ"] },
  { key: "Cup", icon: IconCup, keywords: ["drink", "cup", "เครื่องดื่ม", "ถ้วย", "ເຄື່ອງດື່ມ", "ຈອກ"] },
  { key: "Mug", icon: IconMug, keywords: ["drink", "mug", "เครื่องดื่ม", "ແກ້ວມັກ", "ຈອກ"] },
  { key: "Coffee", icon: IconCoffee, keywords: ["drink", "coffee", "เครื่องดื่ม", "กาแฟ", "ເຄື່ອງດື່ມ", "ກາເຟ"] },
  { key: "Milk", icon: IconMilk, keywords: ["drink", "milk", "เครื่องดื่ม", "นม", "ເຄື່ອງດື່ມ", "ນົມ"] },

  // ข้าว/เส้น (rice/noodles)
  { key: "BowlChopsticks", icon: IconBowlChopsticks, keywords: ["noodle", "เส้น", "ก๋วยเตี๋ยว", "ເສັ້ນ", "ເຝີ"] },
  { key: "BowlSpoon", icon: IconBowlSpoon, keywords: ["rice", "ข้าว", "เข้า", "ເຂົ້າ"] },

  // เนื้อ (meat)
  { key: "Meat", icon: IconMeat, keywords: ["meat", "เนื้อ", "ຊີ້ນ"] },
  { key: "Sausage", icon: IconSausage, keywords: ["sausage", "เนื้อ", "ไส้กรอก", "ໄສ້ກອກ"] },
  { key: "Pig", icon: IconPig, keywords: ["pork", "เนื้อ", "หมู", "ໝູ"] },

  // อาหารทะเล (seafood)
  { key: "Fish", icon: IconFish, keywords: ["seafood", "fish", "อาหารทะเล", "ปลา", "ອາຫານທະເລ", "ປາ"] },

  // ขนมปัง (bread)
  { key: "Bread", icon: IconBread, keywords: ["bread", "ขนมปัง", "ເຂົ້າຈີ່"] },

  // ฟาสต์ฟู้ด (fast food)
  { key: "Pizza", icon: IconPizza, keywords: ["fast food", "pizza", "ฟาสต์ฟู้ด", "พิซซ่า"] },
  { key: "Burger", icon: IconBurger, keywords: ["fast food", "burger", "ฟาสต์ฟู้ด", "เบอร์เกอร์"] },

  // ของหวาน (dessert)
  { key: "IceCream", icon: IconIceCream, keywords: ["dessert", "ice cream", "ของหวาน", "ไอศกรีม", "ຂອງຫວານ", "ກາແລ້ມ"] },
  { key: "IceCream2", icon: IconIceCream2, keywords: ["dessert", "ice cream", "ของหวาน", "ไอศกรีม", "ຂອງຫວານ", "ກາແລ້ມ"] },
  { key: "Cake", icon: IconCake, keywords: ["dessert", "cake", "ของหวาน", "เค้ก", "ເຄັກ"] },
  { key: "Cookie", icon: IconCookie, keywords: ["dessert", "cookie", "ของหวาน", "คุกกี้"] },
  { key: "Candy", icon: IconCandy, keywords: ["dessert", "candy", "ของหวาน", "ลูกอม", "ຂະໜົມ"] },

  // ผลไม้ (fruit)
  { key: "Apple", icon: IconApple, keywords: ["fruit", "apple", "ผลไม้", "หมากไม้", "แอปเปิ้ล", "ໝາກໄມ້", "ໝາກໂປມ"] },
  { key: "Banana", icon: IconBanana, keywords: ["fruit", "banana", "ผลไม้", "กล้วย", "ໝາກກ້ວຍ"] },
  { key: "Cherry", icon: IconCherry, keywords: ["fruit", "cherry", "ผลไม้", "เชอร์รี่"] },
  { key: "Grape", icon: IconGrape, keywords: ["fruit", "grape", "ผลไม้", "องุ่น", "ໝາກອະງຸ່ນ"] },
  { key: "Lemon", icon: IconLemon, keywords: ["fruit", "lemon", "lime", "ผลไม้", "มะนาว", "ໝາກນາວ"] },
  { key: "Avocado", icon: IconAvocado, keywords: ["fruit", "avocado", "ผลไม้", "อโวคาโด"] },

  // ผัก (vegetable)
  { key: "Carrot", icon: IconCarrot, keywords: ["vegetable", "carrot", "ผัก", "แครอท"] },
  { key: "Leaf", icon: IconLeaf, keywords: ["vegetable", "herb", "ผัก", "ສະໝຸນໄພ"] },
  { key: "Mushroom", icon: IconMushroom, keywords: ["vegetable", "mushroom", "ผัก", "เห็ด", "ເຫັດ"] },

  // เชฟ (chef)
  { key: "ChefHat", icon: IconChefHat, keywords: ["chef", "เชฟ", "ພໍ່ຄົວ"] },

  // หม้อ (pot)
  { key: "Soup", icon: IconSoup, keywords: ["pot", "hot pot", "หม้อ", "แกง", "ตุ๋น", "ໝໍ້", "ແກງ", "ຕົ້ມ"] },

  // เผ็ด (spicy)
  { key: "Pepper", icon: IconPepper, keywords: ["spicy", "chili", "เผ็ด", "พริก", "ໝາກເຜັດ"] },
  { key: "Flame", icon: IconFlame, keywords: ["spicy", "hot", "เผ็ด", "ร้อน", "ໄຟ", "ຮ້ອນ"] },

  // แนะนำ (recommended)
  { key: "Star", icon: IconStar, keywords: ["recommended", "featured", "แนะนำ", "ແນະນຳ"] },

  // ถูกใจ (favorite/like)
  { key: "Heart", icon: IconHeart, keywords: ["favorite", "like", "ถูกใจ", "ມັກ"] },

  // ตะกร้า / cart
  { key: "ShoppingCart", icon: IconShoppingCart, keywords: ["cart", "ตะกร้า", "cart", "ກະຕ່າ"] },
];

export const CATEGORY_ICON_MAP: Record<string, TablerIcon> = Object.fromEntries(
  CATEGORY_ICONS.map((opt) => [opt.key, opt.icon])
);
