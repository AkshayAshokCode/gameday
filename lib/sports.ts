// Canonical sport registry. The emoji doubles as the sport's animation
// glyph — button loading spinners, squad-reveal card backs, list accents —
// so picking a sport customizes the app's motion language for free.
export interface Sport {
  id: string;
  label: string;
  emoji: string;
}

export const SPORTS: Sport[] = [
  { id: "football", label: "Football", emoji: "⚽" },
  { id: "cricket", label: "Cricket", emoji: "🏏" },
  { id: "basketball", label: "Basketball", emoji: "🏀" },
  { id: "badminton", label: "Badminton", emoji: "🏸" },
  { id: "volleyball", label: "Volleyball", emoji: "🏐" },
  { id: "tennis", label: "Tennis", emoji: "🎾" },
  { id: "other", label: "Other", emoji: "🏆" },
];

export function sportEmoji(id: string | null | undefined): string {
  return SPORTS.find((s) => s.id === id)?.emoji ?? "🏆";
}
