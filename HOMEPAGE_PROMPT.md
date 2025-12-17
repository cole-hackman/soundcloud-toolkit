# Frontend Development Prompt: SoundCloud Toolkit Homepage

## Project Context

You are building a **public homepage** for **SC Toolkit** (SoundCloud Toolkit), a web application that helps SoundCloud power users organize, merge, and manage their playlists. The homepage should be a **landing page** that appears before users authenticate, serving as the entry point to the application.

## Technical Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS + Custom CSS variables
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Routing**: React Router v7
- **Current Route**: The homepage should be accessible at `/` and redirect authenticated users to `/dashboard`

## Design System & Colors

Use the existing CSS custom properties defined in `src/index.css`:

```css
--sc-orange: #FF5500        /* Primary brand color */
--sc-orange-hover: #E64A00  /* Hover state */
--sc-white: #FFFFFF         /* Card backgrounds */
--sc-light-gray: #F2F2F2    /* Background, borders */
--sc-text-dark: #333333     /* Headings, primary text */
--sc-text-light: #666666    /* Secondary text */
```

**Component Classes Available:**
- `.sc-card` - White card with border and shadow
- `.sc-primary-button` - Orange primary button (48px height, 200px min-width)
- `.sc-hover-card` - Hover animation for cards
- `.sc-input` - Input field styling
- `.sc-focus` - Focus ring styling

## Homepage Requirements

The homepage should be **comprehensive, modern, and visually impressive**. Use generous whitespace, modern typography, and sophisticated layouts. Each section should feel distinct yet cohesive.

### 1. Hero Section (Full-width, prominent)
- **Background**: Subtle gradient from `#FF5500` (10% opacity) to white, or clean white with orange accent
- **Logo**: Large, centered logo (`/sc toolkit transparent .png`) - 180-200px width
- **Headline**: "Smarter SoundCloud Playlists" - Large, bold (text-5xl to text-6xl), dark gray
- **Subheadline**: "Organize, merge, and clean your SoundCloud music in ways the native app can't. Powerful tools for power users." - Medium size, lighter gray, max-width 600px centered
- **Primary CTA**: Large, prominent "Continue with SoundCloud" button (use gradient: `from-[#FF5500] to-[#E64A00]`)
- **Secondary CTA**: Optional "Learn More" link below primary button
- **Layout**: Full-width section with generous vertical padding (py-20 to py-32), centered content
- **Animation**: Fade-in with slight upward motion, logo scales in

### 2. Features Section (Detailed, 4 cards)
**Layout**: 2x2 grid on desktop, 1 column mobile, with generous spacing between cards

Each feature card should be:
- **Large, prominent cards** (not small/minimal)
- **Icon**: Large icon (56-64px) in orange circle (80-96px circle)
- **Title**: Bold, text-xl or text-2xl
- **Description**: 2-3 sentences explaining the feature in detail
- **Visual**: Consider adding subtle background patterns or gradients
- **Hover**: Lift effect with shadow increase, slight scale

Features:
1. **Combine Playlists** (`Layers` icon)
   - "Merge multiple playlists into one unified collection. Automatically detect and remove duplicate tracks across all sources. Perfect for consolidating your music library or creating mega-playlists."

2. **Likes → Playlist** (`Heart` icon)
   - "Transform your liked tracks into organized playlists. Select from thousands of favorites and batch-create playlists with custom names. Never lose track of your favorite discoveries again."

3. **Playlist Modifier** (`ArrowUpDown` or `Shuffle` icon)
   - "Take full control of your playlists. Reorder tracks with drag-and-drop, remove unwanted songs, and apply smart sorting by title, artist, date, duration, or BPM. Your playlists, your way."

4. **Link Resolver** (`Link` icon)
   - "Get instant metadata from any SoundCloud URL. Resolve tracks, playlists, and user profiles to extract detailed information. Perfect for research, organization, and discovery."

### 3. Benefits Section (Full-width, alternating layout)
**Title**: "Built for SoundCloud Power Users" - Large heading (text-4xl)

**Layout**: Two-column layout with icons/checkmarks on left, text on right (alternate on mobile)

**Benefits List** (with orange checkmark icons):
- ✓ Organize thousands of tracks with advanced playlist management tools
- ✓ Automatically detect and remove duplicate tracks across playlists
- ✓ Batch edit and reorganize your entire music library efficiently
- ✓ Get insights and analytics from SoundCloud links and metadata
- ✓ Smart sorting algorithms (by BPM, duration, artist, date)
- ✓ No limits - handle playlists with hundreds of tracks

**Visual**: Use `Check` icon from lucide-react in orange, large text, good spacing

### 4. How It Works Section (3-step process)
**Title**: "How It Works" - Centered heading

**Layout**: 3 columns (horizontal timeline on desktop, vertical on mobile)

Each step:
1. **Connect** (`LogIn` icon) - "Sign in securely with your SoundCloud account using OAuth"
2. **Organize** (`Settings` icon) - "Use powerful tools to merge, sort, and clean your playlists"
3. **Enjoy** (`Music` icon) - "Export your organized playlists back to SoundCloud"

**Design**: Number badges, icons, clear descriptions, connecting lines/arrows between steps

### 5. Security & Trust Section (Prominent, white background)
**Layout**: Centered card with white background, distinct from other sections

- **Icon**: Large shield icon (`Shield` from lucide-react) in orange, 64-80px
- **Title**: "Secure & Private" - Bold, large
- **Description**: "SC Toolkit uses official SoundCloud OAuth authentication. We never store your password and only request the minimum permissions needed. Your data stays private and secure."
- **Link**: "View Privacy Policy" link to `/privacy`
- **Visual**: White card on light gray background, prominent, trustworthy

### 6. Stats/Proof Section (Optional but recommended)
**Layout**: 4-column grid with numbers and labels

Example stats:
- "500+ tracks per playlist"
- "Zero duplicates"
- "100% secure"
- "Free to use"

**Design**: Large numbers (text-4xl), smaller labels, orange accent

### 7. Footer (Comprehensive)
**Layout**: Multi-column footer with:
- **Links**: About | Privacy Policy | (separated by bullets)
- **Disclaimer**: "SC Toolkit is not affiliated with SoundCloud." (smaller, lighter text)
- **Copyright**: Current year
- **Visual**: Clean, minimal, good spacing

## Authentication Logic

```typescript
import { useAuth } from '../contexts/AuthContext';

const { login, isAuthenticated } = useAuth();

// If authenticated, redirect to dashboard (handled in App.tsx routing)
// Login button should call: login() which redirects to /api/auth/login
```

## Responsive Design

- **Mobile-first approach**
- Breakpoints: sm (640px), md (768px), lg (1024px)
- Sticky CTA button on mobile (similar to Login page pattern)
- Ensure all text is readable and buttons are tappable on mobile

## Animation Requirements (Smooth & Modern)

Use Framer Motion extensively for a polished, professional feel:

### Page Load Animations
- **Hero**: Fade in with slight scale (0.95 → 1.0) and upward motion
- **Logo**: Scale in with bounce effect
- **Sections**: Staggered fade-in as user scrolls (use `whileInView`)
- **Feature Cards**: Stagger animation (delay each card by 0.1s)

### Interactive Animations
- **Hover Effects**: 
  - Cards: Lift up (translateY -4px), increase shadow, slight scale (1.02)
  - Buttons: Brightness change, slight scale
  - Links: Color transition
- **Click/Tap**: Subtle scale down (0.98) for tactile feedback

### Scroll Animations
- Use `whileInView` prop for elements to animate when scrolled into view
- Fade in from bottom with slight upward motion
- Stagger children animations for lists/grids

### Example Patterns:
```tsx
// Hero section
<motion.div
  initial={{ opacity: 0, y: 30, scale: 0.95 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  transition={{ duration: 0.6, ease: "easeOut" }}
>

// Staggered feature cards
{features.map((feature, index) => (
  <motion.div
    key={index}
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.5, delay: index * 0.1 }}
    whileHover={{ y: -4, scale: 1.02 }}
  >
))}

// Scroll-triggered section
<motion.section
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
  viewport={{ once: true }}
  transition={{ duration: 0.6 }}
>
```

## Code Structure

1. Create component: `src/pages/Home.tsx`
2. Use existing patterns from `Login.tsx` and `Dashboard.tsx`
3. Import necessary hooks: `useAuth` from `contexts/AuthContext`
4. Use `Link` from `react-router-dom` for internal navigation
5. Follow existing naming conventions and code style

## Visual Style Guidelines (Modern & Clean)

### Typography
- **Headings**: Large, bold, excellent hierarchy (text-4xl to text-6xl for hero)
- **Body**: Readable line-height (1.6-1.8), comfortable font sizes (text-base to text-lg)
- **Spacing**: Generous vertical rhythm - use py-16, py-20, py-24, py-32 for section spacing
- **Max-width**: Constrain content width (max-w-6xl or max-w-7xl) for readability

### Layout & Spacing
- **Sections**: Each major section should have distinct spacing (py-20 to py-32)
- **Cards**: Large, spacious cards with padding (p-8 to p-12)
- **Grid gaps**: Generous gaps between grid items (gap-6 to gap-8)
- **Whitespace**: Don't be afraid of whitespace - it creates breathing room

### Modern Design Elements
- **Gradients**: Use subtle gradients for hero background or buttons (`bg-gradient-to-r from-[#FF5500] to-[#E64A00]`)
- **Shadows**: Enhanced shadows on hover (shadow-lg, shadow-xl)
- **Borders**: Subtle borders (border-1 or border-2) with light gray
- **Rounded corners**: Consistent border-radius (rounded-lg, rounded-xl)
- **Icons**: Large, prominent icons (56-80px) in colored circles or squares
- **Backgrounds**: Alternate section backgrounds (white sections on light gray background)

### Color Usage
- **Primary actions**: Orange gradient buttons
- **Text hierarchy**: Dark gray for headings, lighter gray for body
- **Accents**: Orange for icons, checkmarks, highlights
- **Backgrounds**: Light gray (`--sc-light-gray`) for page, white for cards
- **Hover states**: Darker orange (`#E64A00`) for interactive elements

## Modern UI Patterns to Implement

1. **Card Design**: 
   - Large, spacious cards with excellent padding
   - Subtle borders with soft shadows
   - Hover states that lift and enhance shadow
   - Rounded corners (rounded-xl)

2. **Typography Hierarchy**:
   - Clear distinction between H1, H2, H3
   - Generous line-height for readability
   - Proper font weights (semibold for headings, regular for body)

3. **Color Contrast**:
   - Ensure WCAG AA compliance
   - Use orange strategically (not overwhelming)
   - Gray text for secondary information

4. **Visual Interest**:
   - Use gradients sparingly but effectively
   - Icon backgrounds (colored circles/squares)
   - Alternating section backgrounds
   - Decorative elements (subtle patterns, shapes)

5. **Responsive Patterns**:
   - Mobile: Single column, stacked sections
   - Tablet: 2-column grids where appropriate
   - Desktop: Full multi-column layouts
   - Sticky CTA on mobile (bottom of viewport)

## Additional Considerations

- **SEO**: Include semantic HTML (`<header>`, `<main>`, `<section>`, `<footer>`), proper heading hierarchy (H1 → H2 → H3), meta descriptions
- **Accessibility**: 
  - Proper ARIA labels for icons and interactive elements
  - Keyboard navigation support (Tab order, Enter/Space for buttons)
  - Focus states (`.sc-focus` class) visible and clear
  - Alt text for all images
  - Screen reader friendly structure
- **Performance**: 
  - Lazy load images below the fold
  - Optimize animations (use `will-change` sparingly)
  - Code splitting if needed
- **Error Handling**: Graceful fallbacks if auth check fails
- **Loading States**: Consider skeleton loaders for any dynamic content

## Example Layout Structure

```
┌─────────────────────────────────────────────┐
│           HERO SECTION (Full-width)         │
│   Large Logo                                 │
│   "Smarter SoundCloud Playlists" (H1)        │
│   Subheadline (2-3 lines)                   │
│   [Continue with SoundCloud] (Large CTA)    │
│   Optional: Learn More link                 │
└─────────────────────────────────────────────┘
         [Generous spacing - py-24]
┌─────────────────────────────────────────────┐
│        FEATURES SECTION (2x2 Grid)          │
│   ┌──────────┐  ┌──────────┐                │
│   │ Feature 1│  │ Feature 2│                │
│   │ Large Icon│  │ Large Icon│                │
│   │ Title     │  │ Title     │                │
│   │ 2-3 lines │  │ 2-3 lines │                │
│   └──────────┘  └──────────┘                │
│   ┌──────────┐  ┌──────────┐                │
│   │ Feature 3│  │ Feature 4│                │
│   │ Large Icon│  │ Large Icon│                │
│   │ Title     │  │ Title     │                │
│   │ 2-3 lines │  │ 2-3 lines │                │
│   └──────────┘  └──────────┘                │
└─────────────────────────────────────────────┘
         [Generous spacing - py-24]
┌─────────────────────────────────────────────┐
│      BENEFITS SECTION (2-column)             │
│   "Built for SoundCloud Power Users"        │
│   ┌────────────┐  ┌────────────┐            │
│   │ ✓ Benefit 1│  │ ✓ Benefit 4│            │
│   │ ✓ Benefit 2│  │ ✓ Benefit 5│            │
│   │ ✓ Benefit 3│  │ ✓ Benefit 6│            │
│   └────────────┘  └────────────┘            │
└─────────────────────────────────────────────┘
         [Generous spacing - py-24]
┌─────────────────────────────────────────────┐
│      HOW IT WORKS (3-step timeline)         │
│   [1. Connect] → [2. Organize] → [3. Enjoy] │
│   Icons + descriptions for each step        │
└─────────────────────────────────────────────┘
         [Generous spacing - py-24]
┌─────────────────────────────────────────────┐
│    SECURITY SECTION (Centered white card)   │
│         [Shield Icon - Large]                │
│         "Secure & Private"                   │
│         Description paragraph                │
│         [View Privacy Policy] link          │
└─────────────────────────────────────────────┘
         [Generous spacing - py-24]
┌─────────────────────────────────────────────┐
│      STATS SECTION (4-column grid)          │
│   [500+]  [Zero]  [100%]  [Free]            │
│   tracks  dupes  secure  to use             │
└─────────────────────────────────────────────┘
         [Generous spacing - py-16]
┌─────────────────────────────────────────────┐
│              FOOTER                         │
│   About | Privacy Policy                    │
│   "SC Toolkit is not affiliated..."         │
│   Copyright © 2024                          │
└─────────────────────────────────────────────┘
```

**Key Design Principles:**
- Each section should feel distinct with clear visual separation
- Use alternating backgrounds (white sections on gray, gray sections on white)
- Generous vertical spacing between sections (py-20 to py-32)
- Content should be centered and constrained to readable widths
- Modern, clean aesthetic with excellent typography hierarchy

## Deliverables

1. Complete `src/pages/Home.tsx` component
2. Responsive design (mobile, tablet, desktop)
3. Smooth animations and interactions
4. Proper TypeScript types
5. Integration with existing auth system
6. Clean, maintainable code following project patterns

## Reference Files

- `src/pages/Login.tsx` - For styling and layout patterns
- `src/pages/Dashboard.tsx` - For feature card patterns
- `src/index.css` - For color variables and component classes
- `src/contexts/AuthContext.tsx` - For authentication logic

---

## Final Notes

**Design Philosophy**: This homepage should be **comprehensive, modern, and impressive**. It's not a minimal landing page - it's a full-featured marketing page that showcases all the value the tool provides.

**Key Requirements**:
- **More content**: Multiple sections with detailed information
- **Modern aesthetic**: Clean, spacious, professional design with excellent typography
- **Visual hierarchy**: Clear section separation, prominent CTAs, excellent spacing
- **Comprehensive**: Cover all features, benefits, security, and how it works
- **Polished**: Smooth animations, hover effects, professional finish

**Inspiration**: Think of modern SaaS landing pages (Stripe, Linear, Vercel) - clean, spacious, comprehensive, with excellent use of whitespace and typography.

The homepage should feel like a **premium product** that users will trust with their SoundCloud data. Every element should be intentional, well-spaced, and contribute to the overall professional aesthetic.

