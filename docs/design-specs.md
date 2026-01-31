# Design Specifications - Neo-Brutalist (Room Manager)

## 🎨 Color Palette (Implemented via CSS Variables)

| Token Name           | Hex (Light) | Usage                                               |
|----------------------|-------------|-----------------------------------------------------|
| `--background`       | `#F8FAFC`   | Main page background (Slate 50)                     |
| `--foreground`       | `#0F172A`   | Primary text (Slate 900)                            |
| `--card`             | `#FFFFFF`   | Card background                                     |
| `--card-foreground`  | `#0F172A`   | Card text                                           |
| `--primary`          | `#0077B6`   | Primary Actions (Ocean Blue)                        |
| `--secondary`        | `#0F172A`   | Secondary Actions (Slate 900)                       |
| `--accent`           | `#FFD700`   | Highlights / Badges (Gold)                          |
| `--destructive`      | `#EF4444`   | Error / Delete Actions (Red)                        |
| `--border`           | `#1E293B`   | Borders (Slate 800) - Used for structural integrity |

## 📝 Typography

**Font Family**: `Be Vietnam Pro` (Primary), `Noto Sans` (Secondary).

| Usage | Class | Specs |
|-------|-------|-------|
| Body | `font-sans` | `Be Vietnam Pro`, sans-serif |
| Headings | `font-display` | `Be Vietnam Pro`, sans-serif |

## 🔲 Component Styles (Neo-Brutalist)

### Buttons (`components/ui/button.tsx`)
- **Border**: `2px solid`
- **Shadow**: `shadow-nb-sm` (2px hard shadow)
- **Interaction**:
  - Hover: `translate-x-[2px] translate-y-[2px]` (Press/Lift effect inverted) -> Actually implemented as "Lift" visual but physically it moves down-right to hide shadow?
  - Wait, implementation: `hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none`.
  - This means on hover, the button moves *down-right* by 2px (covering the shadow), making it look "Pressed".

### Cards (`components/ui/card.tsx`)
- **Border**: `2px solid var(--border)`
- **Shadow**: `shadow-nb` (4px hard shadow)
- **Radius**: `rounded-lg` (8px) - Slight softening per user need, but maintains brutalist borders.

### Inputs (`components/ui/input.tsx`)
- **Border**: `2px solid var(--input)`
- **Shadow**: `shadow-nb-sm`
- **Focus**: `border-primary` thick outline, NO glow/ring blur.

### Badges (`components/ui/badge.tsx`)
- **Style**: `rounded-sm border-2` (No pills!)
- **Font**: `font-bold`

## 📏 Taildwind Extension

### Box Shadows
- `shadow-nb-sm`: `2px 2px 0px 0px hsl(var(--border))`
- `shadow-nb`: `4px 4px 0px 0px hsl(var(--border))`
- `shadow-nb-lg`: `6px 6px 0px 0px hsl(var(--border))`

### Spacing & Borders
- All components use `border-2` defaults where applicable for the brutalist thick line look.
