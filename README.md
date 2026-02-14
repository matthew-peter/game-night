# Game Night

A multi-game platform for playing board games online with friends and family. Currently features Codenames Duet, with more games coming soon.

## Features

- **Multiple Games** - Growing collection of board games (starting with Codenames Duet)
- **2-4 Players** - Flexible player support per game
- **Mobile-First** - PWA with responsive design for phone, tablet, and desktop
- **Real-Time** - Live updates, presence indicators, and in-game chat
- **Push Notifications** - Smart notifications (in-app toasts vs. OS push)
- **Easy Sharing** - Invite friends with a PIN code or shareable link
- **Word Definitions** - Long-press any word to see its definition (Codenames)
- **Card Swaps** - Kid-friendly option to swap out unfamiliar words before play

## Tech Stack

- **Framework**: Next.js (App Router)
- **Database**: Supabase (PostgreSQL + Realtime)
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **Notifications**: Web Push API + Service Worker
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account (free tier works)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd game-night
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to your project's SQL Editor
3. Run `supabase/schema.sql` to create the base schema
4. Run all migrations in `supabase/migrations/` in order
5. Go to Settings > API and copy your project URL and anon key

### 3. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For push notifications, also add VAPID keys (generate with `npx web-push generate-vapid-keys`):
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Games

### Codenames Duet

The cooperative word game for 2 players. Give one-word clues to help your partner find secret agents on the board.

**How to Play:**
1. Create a game and share the PIN with your partner
2. Each player sees a key card showing which words are agents (green), assassins (black), or bystanders (beige)
3. Take turns giving one-word clues and guessing words
4. Find all 15 agents before running out of timer tokens
5. Hit an assassin and you lose!

**Key Rules:**
- 9 agents per player's key (15 unique total, with 3 shared)
- 3 assassins per player's key (with overlaps per Duet rules)
- Each wrong guess or turn end uses a timer token
- At 0 tokens, you're in sudden death -- one wrong guess loses

## Architecture

The platform uses a game-agnostic core with game-specific modules:

```
src/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   │   └── games/         # Game CRUD, moves, chat, joining
│   ├── dashboard/         # Game lobby (create/join)
│   ├── game/[id]/         # Active game play + waiting room
│   ├── history/           # Past games
│   └── join/[pin]/        # Join via invite link
├── components/
│   ├── auth/              # Login/signup
│   ├── game/              # Game UI (board, clues, status, chat)
│   ├── shared/            # Header, notifications
│   └── ui/                # shadcn/ui primitives
└── lib/
    ├── game/              # Game logic, word lists, key generation
    ├── store/             # Zustand state (game, notifications)
    ├── supabase/          # Database clients and types
    └── utils/             # Helpers (PIN generation, etc.)
```

**Database design:** Games use a `game_players` join table for N-player support, with seat-indexed arrays in JSONB columns (`key_card`, `board_state`) for flexible per-player state.

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

Remember to update `NEXT_PUBLIC_APP_URL` to your production URL.

## License

MIT
