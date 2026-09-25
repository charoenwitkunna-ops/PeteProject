(() => {
// Lightweight synonym-aware search for the item catalog.
const SYNONYM_MAP = {
  phone: ["iphone", "apple", "samsung", "android", "mobile", "cellphone"],
  laptop: ["macbook", "computer", "chromebook", "notebook"],
  headphone: ["airpods", "earbuds", "earphones", "audio", "bluetooth"],
  airpods: ["headphone", "earphones", "apple", "bluetooth", "audio"],
  bottle: ["flask", "hydro", "water", "tumbler", "thermos"],
  flask: ["bottle", "hydro", "water", "thermos"],
  uniform: ["blazer", "jacket", "shirt", "tie", "skirt", "trousers", "sweater"],
  jacket: ["blazer", "coat", "hoodie", "cardigan", "sweater", "uniform"],
  calculator: ["casio", "scientific", "math", "classwiz"],
  keys: ["keychain", "lanyard", "fob", "lock"],
  bag: ["backpack", "wallet", "pouch", "purse", "tote"]
};

function performAiSearch(items, query) {
  if (!query || query.trim() === "") return items;
  const rawTokens = query.toLowerCase().split(/\s+/).filter(token => token.length > 0);
  const searchTokens = new Set(rawTokens);

  rawTokens.forEach(token => {
    Object.entries(SYNONYM_MAP).forEach(([key, synonyms]) => {
      if (token === key || synonyms.includes(token)) {
        searchTokens.add(key);
        synonyms.forEach(synonym => searchTokens.add(synonym));
      }
    });
  });

  return items.map(item => {
    let score = 0;
    const title = (item.title || "").toLowerCase();
    const description = (item.publicDescription || "").toLowerCase();
    const location = (item.foundLocation || "").toLowerCase();
    const code = (item.itemCode || "").toLowerCase();
    const category = (item.category || "").toLowerCase();

    if (code.includes(query.toLowerCase().trim())) score += 100;
    searchTokens.forEach(token => {
      if (title.includes(token)) score += 20;
      if (description.includes(token)) score += 10;
      if (location.includes(token)) score += 8;
      if (category.includes(token)) score += 12;
    });
    return { item, score };
  }).filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(result => result.item);
}

window.performAiSearch = performAiSearch;
})();
