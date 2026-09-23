import { CATEGORY_ICON_MAP } from "../data/categoryIcons";

interface Props {
  icon?: string;
  size?: number;
  color?: string;
}

// Renders a category's icon: looks up `icon` as a Tabler icon key first;
// falls back to drawing the raw string as text (covers custom-pasted emoji,
// and any category saved back when icons were plain emoji).
const CategoryIconGlyph: React.FC<Props> = ({ icon, size = 20, color }) => {
  if (!icon) return null;
  const Icon = CATEGORY_ICON_MAP[icon];
  if (Icon) return <Icon size={size} color={color} stroke={1.75} />;
  return <span style={{ fontSize: size, lineHeight: 1 }}>{icon}</span>;
};

export default CategoryIconGlyph;
