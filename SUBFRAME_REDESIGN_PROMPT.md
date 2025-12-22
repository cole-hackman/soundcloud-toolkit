# Subframe Design Prompt: Redesign Dashboard & Tool Pages

## Project Context

Redesign **5 pages** in the SoundCloud Toolkit application to match the modern, polished aesthetic of the homepage. The homepage uses a clean, spacious design with generous whitespace, smooth animations, and a consistent SoundCloud-inspired color palette.

## Design System Reference (Homepage)

### Color Palette
- **Primary Orange**: `#FF5500` (SoundCloud brand color)
- **Primary Orange Hover**: `#E64A00`
- **Background**: `#F2F2F2` (light gray)
- **Card Background**: `#FFFFFF` (white)
- **Text Dark**: `#333333` (headings, primary text)
- **Text Light**: `#666666` (secondary text, descriptions)
- **Border**: `#F2F2F2` (light gray, subtle borders)

### Typography
- **Font Family**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- **Headings**: Large, bold (text-4xl to text-6xl for hero, text-2xl to text-3xl for page titles)
- **Body**: text-base to text-lg, line-height: 1.6-1.8
- **Font Weights**: Semibold (600) for headings, regular (400) for body

### Spacing & Layout
- **Section Padding**: Generous vertical spacing (py-20 to py-32)
- **Card Padding**: Large, spacious (p-8 to p-12)
- **Grid Gaps**: Generous gaps (gap-6 to gap-8)
- **Max Width**: Constrain content (max-w-6xl or max-w-7xl) for readability
- **Container**: `container mx-auto px-4 py-8`

### Component Patterns (Homepage)

#### Feature Cards
```tsx
// Large, spacious cards with hover effects
className="bg-white border-2 border-gray-200 rounded-2xl p-10 hover:border-[#FF5500] hover:shadow-2xl transition-all duration-300"
// Icon in gradient circle
className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center text-white"
// Hover animation
whileHover={{ y: -4, scale: 1.02 }}
```

#### Primary Buttons
```tsx
// Gradient button with shadow
className="px-10 py-4 bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all text-lg"
```

#### Cards
- White background
- Border: `border-2 border-gray-200`
- Border radius: `rounded-2xl` or `rounded-xl`
- Shadow: `shadow-lg` or `shadow-xl` on hover
- Padding: `p-8` to `p-12`

### Animations (Framer Motion)
- **Page Load**: Fade in with slight upward motion (`opacity: 0, y: 20` → `opacity: 1, y: 0`)
- **Hover Effects**: Lift up (`translateY(-4px)`), scale (`scale(1.02)`), enhanced shadow
- **Scroll Animations**: Use `whileInView` with `viewport={{ once: true }}`
- **Stagger**: Delay animations by `index * 0.1` for lists/grids
- **Transitions**: `duration: 0.5-0.6`, `ease: "easeOut"`

## Pages to Redesign

### 1. Dashboard (`/dashboard`)
**Current State**: Basic grid layout with feature cards and stats
**Redesign Goals**:
- Match homepage feature card style (large, spacious, gradient icon circles)
- Improve welcome section with better typography hierarchy
- Enhance stats section with modern card design
- Add smooth animations on load and hover
- Use gradient buttons for primary actions

**Key Elements**:
- Welcome message with user's name
- 4 feature cards (Combine Playlists, Likes → Playlist, Playlist Modifier, Link Resolver)
- Stats grid (Playlists, Liked Tracks, Following, Followers)
- Loading states with skeleton animations

### 2. Combine Playlists (`/combine`)
**Current State**: Functional but basic UI
**Redesign Goals**:
- Modern playlist selection interface with large, tappable cards
- Clear visual hierarchy for selected vs unselected playlists
- Prominent input field for new playlist title
- Success state with celebration animation
- Use gradient buttons and modern card designs

**Key Elements**:
- Playlist grid with artwork thumbnails
- Selection state (checkmarks, border highlights)
- Input field for merged playlist title
- Track count summary
- Combine button (gradient, large, prominent)
- Success screen with created playlist info

### 3. Likes → Playlist (`/likes-to-playlist`)
**Current State**: Basic list interface
**Redesign Goals**:
- Modern track list with better visual hierarchy
- Improved selection UI (checkboxes, hover states)
- Better pagination/loading states
- Playlist title input with modern styling
- Success state matching other pages

**Key Elements**:
- Track list with artwork, title, artist
- Selection checkboxes (orange accent color)
- Playlist title input
- Selected count indicator
- Create button (gradient, prominent)
- Pagination/load more button
- Success screen

### 4. Playlist Modifier (`/playlist-modifier`)
**Current State**: Functional drag-and-drop interface
**Redesign Goals**:
- Modern track list with better drag-and-drop visual feedback
- Improved sort dropdown styling
- Better playlist selector
- Enhanced save/undo controls
- Modern card design for track items

**Key Elements**:
- Playlist selector dropdown
- Sort options dropdown
- Draggable track list with grip handles
- Track items with artwork, title, artist, duration
- Remove/delete buttons
- Save button (gradient, prominent)
- Undo button
- Change indicator

### 5. Link Resolver (`/link-resolver`)
**Current State**: Basic input and result display
**Redesign Goals**:
- Modern input section with icon and gradient button
- Enhanced result card with better layout
- Improved empty and error states
- Better visual hierarchy for resolved content
- Consistent with other pages

**Key Elements**:
- URL input with link icon
- Resolve button (gradient, with search icon)
- Example URLs (clickable, orange links)
- Result card with artwork/avatar
- Metadata display (title, artist, type, etc.)
- External link button
- Copy to clipboard functionality
- Empty state message
- Error state styling

## Design Requirements

### Consistency Checklist
- [ ] Use homepage color palette exactly (`#FF5500`, `#F2F2F2`, `#333333`, `#666666`)
- [ ] Match homepage typography (font sizes, weights, line heights)
- [ ] Use same spacing patterns (generous padding, gaps)
- [ ] Apply same card styles (white bg, border-2, rounded-2xl, shadows)
- [ ] Use gradient buttons for primary actions (`from-[#FF5500] to-[#E64A00]`)
- [ ] Implement smooth animations (Framer Motion, fade-in, hover effects)
- [ ] Match icon sizes and styles (Lucide React icons)
- [ ] Use same loading states (skeleton animations, spinners)

### Visual Hierarchy
1. **Page Title**: Large, bold (text-3xl to text-4xl), dark gray
2. **Subtitle/Description**: Medium size (text-base to text-lg), light gray
3. **Section Headers**: Bold (text-xl to text-2xl)
4. **Body Text**: Regular weight, readable line-height
5. **Actions**: Gradient buttons for primary, outlined/secondary for secondary

### Interactive Elements
- **Buttons**: 
  - Primary: Gradient orange, rounded-lg, hover shadow
  - Secondary: White bg, border, hover border-orange
  - Disabled: Light gray bg, reduced opacity
- **Inputs**: White bg, border, rounded, focus ring (orange)
- **Cards**: Hover lift effect, border color change to orange
- **Links**: Orange color, hover to darker orange

### Responsive Design
- **Mobile**: Single column, full-width buttons, stacked layouts
- **Tablet**: 2-column grids where appropriate
- **Desktop**: Full multi-column layouts, max-width containers
- **Breakpoints**: sm (640px), md (768px), lg (1024px)

### Animation Guidelines
- **Page Load**: Staggered fade-in (0.1s delay between items)
- **Hover**: Smooth transitions (200-300ms), lift effect
- **Loading**: Skeleton shimmer or spinner
- **Success**: Scale animation (0.9 → 1.0) with fade-in
- **Scroll**: Use `whileInView` for elements entering viewport

## Technical Stack
- **Framework**: React 18 + TypeScript
- **Styling**: TailwindCSS + Custom CSS variables
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Build**: Vite

## Deliverables

For each page, provide:
1. **Complete component code** matching homepage aesthetic
2. **Responsive design** (mobile, tablet, desktop)
3. **Smooth animations** using Framer Motion
4. **Consistent styling** with homepage
5. **Accessible markup** (semantic HTML, ARIA labels)
6. **Loading states** (skeletons, spinners)
7. **Error states** (styled error messages)
8. **Success states** (celebration animations)

## Reference Files
- **Homepage**: `src/pages/Home.tsx` - Reference for design system
- **CSS Variables**: `src/index.css` - Color palette and utility classes
- **Current Pages**: 
  - `src/pages/Dashboard.tsx`
  - `src/pages/CombinePlaylists.tsx`
  - `src/pages/LikesToPlaylist.tsx`
  - `src/pages/PlaylistModifier.tsx`
  - `src/pages/LinkResolver.tsx`

## Design Philosophy

The redesigned pages should feel like a **premium, modern SaaS application**:
- **Spacious**: Generous whitespace, breathing room
- **Polished**: Smooth animations, hover effects, professional finish
- **Consistent**: Same design language as homepage throughout
- **Intuitive**: Clear visual hierarchy, obvious actions
- **Delightful**: Subtle animations, satisfying interactions

Think **Linear, Stripe, Vercel** - clean, modern, professional, with excellent attention to detail.

