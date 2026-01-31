# Room Manager Design System (Master)

**Style**: Minimalist Pastel
**Typography**: Friendly Sans (Inter / Be Vietnam Pro)
**Palette**: Pastel Dreams (Lavender, Mint, Peach) with Dark Mode Support

---

## 1. Core Principles
- **Softness**: Rounded corners (`rounded-xl`), smooth transitions, no harsh lines.
- **Airy Layouts**: Generous whitespace, comfortable padding.
- **Subtle Depth**: Soft, diffuse shadows (`shadow-lg` not `shadow-nb`).
- **Pastel Accents**: Colors are soft, desaturated but luminous in Dark Mode.

## 2. Typography
- **Primary Font**: `Be Vietnam Pro` or `Inter`
- **Weights**: Light (300) to SemiBold (600). Avoid Heavy/Black weights.
- **Colors**: Soft Black (`#1e293b`) for text, not Pure Black.

## 3. Color Palette (Tokens)

### Light Theme
- **Background**: `#F8FAFC` (Slate 50) or Subtly Tinted White
- **Primary**: `#818CF8` (Pastel Indigo)
- **Secondary**: `#FCA5A5` (Pastel Red/Peach)
- **Accent**: `#34D399` (Pastel Mint)
- **Surface**: `#FFFFFF` (White)

### Dark Theme
- **Background**: `#0F172A` (Slate 900)
- **Primary**: `#A5B4FC` (Indigo 300)
- **Surface**: `#1E293B` (Slate 800)
- **Border**: `#334155` (Slate 700)

## 4. Components

### Cards & Surfaces
- **Border**: 1px subtle (`border-slate-100` dark: `border-slate-800`)
- **Radius**: `rounded-xl` or `rounded-2xl`
- **Shadow**: `shadow-sm` or `shadow-md` (Soft)

### Buttons
- **Shape**: `rounded-full` or `rounded-xl`
- **Style**: Flat or Soft Gradient. No thick borders.

### Layout
- **Sidebar**: Floating or Transparent blend. NO thick separator lines.
- **Header**: Glassmorphism (`backdrop-blur`) preferred over solid lines.

## 5. Anti-Patterns (Avoid)
- **Thick Borders**: No `border-2` or `border-4`.
- **Hard Shadows**: No `box-shadow` with 0 blur.
- **High Contrast Glare**: Avoid pure black on pure white.
