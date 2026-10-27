// Clearly labeled demo data for designing the interface.
// Replace this with authenticated Supabase data before real use.
export const demoPins = [
  { id: "p1", name: "Castle at Night", character: "Parks", set: "Park Icons", owned: 2, tradeable: 1, visibility: "Friends", color: "lavender", symbol: "✦" },
  { id: "p2", name: "Cosmic Explorer", character: "Space", set: "Galactic Adventures", owned: 1, tradeable: 1, visibility: "Friends", color: "blue", symbol: "✧" },
  { id: "p3", name: "Flower Mouse", character: "Characters", set: "Garden Collection", owned: 3, tradeable: 2, visibility: "Private", color: "pink", symbol: "❀" },
  { id: "p4", name: "Ocean Dream", character: "Movies", set: "Ocean Stories", owned: 1, tradeable: 0, visibility: "Friends", color: "teal", symbol: "≈" },
  { id: "p5", name: "Golden Balloon", character: "Parks", set: "Park Icons", owned: 2, tradeable: 1, visibility: "Friends", color: "gold", symbol: "✧" },
  { id: "p6", name: "Midnight Companion", character: "Characters", set: "Nighttime Magic", owned: 1, tradeable: 0, visibility: "Private", color: "navy", symbol: "☾" }
];

export const demoFriends = [
  { id: "f1", name: "Alex Morgan", initials: "AM", status: "3 pins shared", pin: "Castle at Night", match: true },
  { id: "f2", name: "Jordan Lee", initials: "JL", status: "5 pins shared", pin: "Cosmic Explorer", match: false },
  { id: "f3", name: "Taylor Reed", initials: "TR", status: "2 pins shared", pin: "Golden Balloon", match: true }
];

export const demoWishlist = [
  { id: "w1", name: "Castle at Night", set: "Park Icons", priority: "High", match: "Available from Alex" },
  { id: "w2", name: "Moonlit Voyage", set: "Ocean Stories", priority: "Medium", match: "No current match" },
  { id: "w3", name: "Festival Flower", set: "Garden Collection", priority: "Low", match: "Available from Taylor" }
];
