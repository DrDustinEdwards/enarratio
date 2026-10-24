// Applies the theme the reader chose, before first paint (Capsomer's theme switch). Loaded as a
// plain script in the head, so the page never flashes the other theme.
import { applyStoredTheme } from "capsomer/behaviour/theme-switch";

applyStoredTheme();
