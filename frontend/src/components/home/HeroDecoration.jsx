import { HERO_DECORATIONS } from "@/lib/heroDecorations";

const PARTICLE_COUNT = 16;

// Purely decorative overlay for festivals and events (aria-hidden, never blocks clicks). Positions
// are derived from the index rather than Math.random() so server and client render the same markup.
// Animations are switched off for prefers-reduced-motion in globals.css.
export function HeroDecoration({ id }) {
  const preset = HERO_DECORATIONS[id];
  if (!preset) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-1 overflow-hidden">
      <div className="absolute inset-0" style={{ background: preset.tint }} />
      {preset.stripe ? (
        <div className="absolute inset-x-0 top-0 flex h-1.5">
          <span className="flex-1 bg-[#ff9933]" />
          <span className="flex-1 bg-white" />
          <span className="flex-1 bg-[#138808]" />
        </div>
      ) : null}
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const item = preset.items[i % preset.items.length];
        const style = {
          left: `${(i * 37 + 11) % 97}%`,
          animationDelay: `${-((i * 1.7) % 9)}s`,
          animationDuration: `${9 + ((i * 5) % 7)}s`,
          fontSize: `${14 + ((i * 7) % 16)}px`,
          ...(preset.motion === "float" ? { top: `${(i * 23 + 8) % 88}%` } : {}),
        };
        return preset.color ? (
          <span
            key={i}
            className={`hero-particle hero-${preset.motion} rounded-full opacity-70 blur-[1px]`}
            style={{ ...style, width: style.fontSize, height: style.fontSize, background: item }}
          />
        ) : (
          <span key={i} className={`hero-particle hero-${preset.motion}`} style={style}>
            {item}
          </span>
        );
      })}
    </div>
  );
}
