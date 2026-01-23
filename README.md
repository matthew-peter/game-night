# Codenames Duet

A web app version of the cooperative word game Codenames Duet, playable across two devices.

## Features

- 🎮 **Full Codenames Duet rules** - Same mechanics as the physical game
- 📱 **Mobile-friendly** - Responsive design for phone and tablet
- 🔗 **Easy sharing** - Share via PIN code or shareable link
- 📖 **Word definitions** - Long-press any word to see its definition
- 📊 **Game tracking** - Timer tokens, agents found, turn indicator
- 📜 **Move history** - Review all clues and guesses
- ⚙️ **Configurable** - Adjustable timer tokens and clue strictness

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL + Realtime)
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account (free tier works)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd codenames
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to your project's SQL Editor
3. Copy the contents of `supabase/schema.sql` and run it
4. Go to Settings → API and copy your project URL and anon key

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

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## How to Play

### Game Setup
1. Create an account with a username
2. One player creates a new game, configuring timer tokens (default 9) and clue strictness
3. Share the PIN code or invite link with your partner
4. Partner joins the game and play begins!

### Gameplay
1. **Clue Phase**: The clue giver sees their key card showing which words are agents (green), assassins (black), or bystanders (beige)
2. Select the words you're giving a clue for by tapping them
3. Enter your one-word clue (the number is inferred from selected words)
4. **Guess Phase**: Your partner sees the clue and guesses words
5. Correct guesses (agents) let you keep guessing; wrong guesses (bystanders) end your turn
6. **Winning**: Find all 15 agents before running out of time tokens
7. **Losing**: Hit an assassin OR run out of time and guess a bystander

### Key Rules
- 9 agents per player's key (15 unique total, with 3 shared)
- 3 assassins per player's key (with overlaps per Duet rules)
- Each wrong guess or turn end uses a timer token
- At 0 tokens, you're in "sudden death" - one wrong guess loses!

## Clue Strictness Levels

- **Basic**: Clue cannot exactly match a visible word
- **Strict**: Clue cannot contain or be contained by visible words
- **Very Strict**: Also checks word stems (run/running/ran)

## Project Structure

```
src/
├── app/                 # Next.js app router pages
│   ├── api/            # API routes
│   ├── dashboard/      # Create/join games
│   ├── game/[id]/      # Game play and waiting room
│   ├── history/        # Past games
│   └── join/[pin]/     # Join via invite link
├── components/
│   ├── auth/           # Login/signup
│   ├── game/           # Game UI components
│   ├── shared/         # Header, etc.
│   └── ui/             # shadcn/ui components
└── lib/
    ├── game/           # Game logic, word list, key generator
    ├── store/          # Zustand state management
    ├── supabase/       # Database clients and types
    └── utils/          # Helpers (PIN generation, etc.)
```

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

Remember to update `NEXT_PUBLIC_APP_URL` to your production URL.

## License

MIT
