// Внутриигровые цены в Минетках.
export const catalog = [
  { id: "watermelon", name: "Арбуз", rarity: "Обычный", price: 100, color: "#80d6b4", kind: "watermelon" },
  { id: "pumpkin", name: "Тыква", rarity: "Обычный", price: 250, color: "#80d6b4", kind: "pumpkin" },
  { id: "dumplings", name: "Пельмени", rarity: "Обычный", price: 400, color: "#80d6b4", kind: "dumplings" },
  { id: "water", name: "Яндекс бутылка воды", rarity: "Обычный", price: 750, color: "#80d6b4", kind: "water" },
  { id: "gta6", name: "Диск GTA VI", rarity: "Редкий", price: 1500, color: "#6db7ff", kind: "disc" },
  { id: "zalma", name: "Свидание с Залмой", rarity: "Редкий", price: 3000, color: "#6db7ff", kind: "date" },
  { id: "fox", name: "Лисичка потенциала", rarity: "Эпический", price: 7000, color: "#d79aff", kind: "fox" },
  { id: "solaris", name: "Солярис", rarity: "Легендарный", price: 15000, color: "#ffcd83", kind: "car" },
];
export const findSkin = (id) => catalog.find((item) => item.id === id);
export const legacyItems = { p250: "watermelon", glock: "pumpkin", mp9: "dumplings", m4: "water", ak: "gta6", awp: "zalma", knife: "fox", butterfly: "solaris" };
