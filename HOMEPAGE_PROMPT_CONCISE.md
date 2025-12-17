# Homepage Development Prompt (Concise Version)

Build a **comprehensive, modern homepage** for **SC Toolkit** - a SoundCloud playlist management web app. This should be a full-featured landing page, not minimal.

## Tech Stack
- React 18 + TypeScript + Vite
- TailwindCSS + Framer Motion
- React Router v7
- Lucide React icons

## Design System
**Colors**: `--sc-orange: #FF5500`, `--sc-white: #FFFFFF`, `--sc-light-gray: #F2F2F2`, `--sc-text-dark: #333333`, `--sc-text-light: #666666`

**Component Classes**: `.sc-card`, `.sc-primary-button`, `.sc-hover-card`, `.sc-input`, `.sc-focus`

## Required Sections (Comprehensive)

### 1. Hero Section (Full-width, prominent)
- Large logo (`/sc toolkit transparent .png`) - 180-200px
- Headline: "Smarter SoundCloud Playlists" (text-5xl to text-6xl)
- Subheadline: "Organize, merge, and clean your SoundCloud music in ways the native app can't. Powerful tools for power users."
- Large CTA: "Continue with SoundCloud" (gradient button)
- Generous spacing (py-20 to py-32)

### 2. Features Section (2x2 grid, detailed cards)
Large, spacious cards with:
- Large icons (56-64px) in orange circles
- Bold titles (text-xl to text-2xl)
- 2-3 sentence descriptions
- Hover: lift effect with shadow

Features:
1. **Combine Playlists** (`Layers`) - "Merge multiple playlists into one unified collection. Automatically detect and remove duplicate tracks..."
2. **Likes → Playlist** (`Heart`) - "Transform your liked tracks into organized playlists. Select from thousands of favorites..."
3. **Playlist Modifier** (`ArrowUpDown`) - "Take full control of your playlists. Reorder tracks with drag-and-drop..."
4. **Link Resolver** (`Link`) - "Get instant metadata from any SoundCloud URL. Resolve tracks, playlists..."

### 3. Benefits Section (2-column layout)
- Title: "Built for SoundCloud Power Users" (text-4xl)
- List with orange checkmarks (`Check` icon):
  - ✓ Organize thousands of tracks with advanced tools
  - ✓ Automatically detect and remove duplicates
  - ✓ Batch edit and reorganize efficiently
  - ✓ Get insights from SoundCloud links
  - ✓ Smart sorting (BPM, duration, artist, date)
  - ✓ No limits - handle hundreds of tracks

### 4. How It Works (3-step timeline)
Horizontal on desktop, vertical on mobile:
1. **Connect** (`LogIn`) - "Sign in securely with SoundCloud OAuth"
2. **Organize** (`Settings`) - "Use powerful tools to merge, sort, and clean"
3. **Enjoy** (`Music`) - "Export organized playlists back to SoundCloud"

### 5. Security Section (Centered white card)
- Large shield icon (`Shield`, 64-80px) in orange
- Title: "Secure & Private" (bold, large)
- Description: "SC Toolkit uses official SoundCloud OAuth. We never store your password..."
- Link: "View Privacy Policy" → `/privacy`

### 6. Stats Section (Optional, 4-column grid)
- "500+ tracks per playlist" | "Zero duplicates" | "100% secure" | "Free to use"

### 7. Footer
- Links: About | Privacy Policy
- Disclaimer: "SC Toolkit is not affiliated with SoundCloud"
- Copyright: Current year

## Design Requirements

**Modern & Clean**:
- Generous whitespace (py-20 to py-32 between sections)
- Large, spacious cards (p-8 to p-12)
- Excellent typography hierarchy
- Alternating section backgrounds
- Subtle gradients for hero/buttons
- Enhanced shadows on hover
- Large icons (56-80px) in colored backgrounds

**Animations**:
- Hero: Fade + scale + upward motion
- Sections: Scroll-triggered fade-in (`whileInView`)
- Cards: Stagger animations, hover lift effects
- Smooth transitions throughout

**Responsive**:
- Mobile: Single column, stacked
- Tablet: 2-column grids
- Desktop: Full multi-column layouts
- Sticky CTA on mobile bottom

## Code Pattern
```tsx
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

// Scroll animations
<motion.section
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
  viewport={{ once: true }}
>
```

**File**: `src/pages/Home.tsx`  
**Route**: `/` (redirects authenticated users to `/dashboard`)

**Inspiration**: Modern SaaS landing pages (Stripe, Linear, Vercel) - comprehensive, spacious, professional.

