// Festival / event presets the admin can pick for the home page hero. Keep the ids in sync with
// HERO_DECORATIONS in backend/src/models/HeroBanner.js.
//   motion: "fall" drifts down, "rise" drifts up, "float" bobs in place
//   tint:   soft colour wash laid over the banner photo
export const HERO_DECORATIONS = {
  diwali: {
    label: "Diwali",
    motion: "rise",
    items: ["🪔", "✨", "🪔", "🎇", "✨"],
    tint: "radial-gradient(ellipse at 50% 100%, rgba(255,150,30,0.35), transparent 60%)",
    greeting: "Happy Diwali!",
  },
  holi: {
    label: "Holi",
    motion: "float",
    items: ["#ff3d81", "#ffd23f", "#3ddc97", "#3d8bff", "#b66dff"],
    color: true,
    tint: "linear-gradient(120deg, rgba(255,61,129,0.18), rgba(255,210,63,0.15), rgba(61,139,255,0.18))",
    greeting: "Happy Holi!",
  },
  christmas: {
    label: "Christmas",
    motion: "fall",
    items: ["❄️", "❄️", "🎄", "❄️", "⭐"],
    tint: "linear-gradient(to bottom, rgba(200,30,40,0.18), transparent 50%)",
    greeting: "Merry Christmas!",
  },
  "new-year": {
    label: "New Year",
    motion: "fall",
    items: ["🎉", "✨", "🎊", "✨", "🥂"],
    tint: "radial-gradient(ellipse at 50% 0%, rgba(255,210,63,0.28), transparent 60%)",
    greeting: "Happy New Year!",
  },
  tricolor: {
    label: "Independence / Republic Day",
    motion: "float",
    items: ["🇮🇳", "✨", "🇮🇳"],
    tint: "linear-gradient(to bottom, rgba(255,153,51,0.22), transparent 40%, transparent 60%, rgba(19,136,8,0.22))",
    stripe: true,
    greeting: "Jai Hind!",
  },
  eid: {
    label: "Eid",
    motion: "float",
    items: ["🌙", "⭐", "✨", "🌙", "⭐"],
    tint: "radial-gradient(ellipse at 80% 0%, rgba(80,200,140,0.3), transparent 55%)",
    greeting: "Eid Mubarak!",
  },
};

export const HERO_DECORATION_IDS = Object.keys(HERO_DECORATIONS);
