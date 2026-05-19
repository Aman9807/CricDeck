# 🏏 CricDeck — Live Cricket Scoring & Broadcasting Platform

CricDeck is a state-of-the-art, tournament-oriented live cricket scoring and broadcasting application. It is designed with a **Local-First Architecture** combined with a **Supabase Cloud Sync Backend** to guarantee zero-latency scorer actions (0ms UI responsiveness) and real-time millisecond-accurate broadcasts even in volatile network environments.

## 🚀 Key Features

1. **Local-First scoring engine**: Full ICC scoring rules run on local memory/IndexedDB.
2. **Dynamic Live Sync & Broadcasting**: Instantly syncs scorer state to Supabase PostgreSQL and broadcasts updates to OBS graphic overlays/spectator portals in real-time.
3. **Advanced Tournament & Team Setup**: Build tournaments, define formats (T20, ODI, etc.), customize rules, upload team logos and player profile pictures.
4. **Intuitive Custom Overlay Designer**: A drag-and-drop overlay editor to build, customize, and preview OBS broadcast feeds (batter scores, bowlers, partnerships, run rates).
5. **Detailed commentary & ledger log**: Delivery ledger with run-by-run breakdown, stumped/keeper catches details, run out runs, and visual "Who is Out?" modal selection cards.
6. **ICC Analytics & Awards**: Automated suggestions for **Player of the Match** and **Player of the Tournament (MVP)** based on computed impact scores (runs, strike rates, wickets, economy, maidens).

---

## 🛠️ Step 1: Database Setup in Supabase

1. Go to your **Supabase Dashboard** and create a new project.
2. Open the **SQL Editor** tab from the left sidebar.
3. Click **New Query**, copy the contents of the [supabase_setup.sql](./supabase_setup.sql) file, paste it into the editor, and click **Run**.
4. This script will automatically:
   - Enable the UUID extension.
   - Create tables for `tournaments`, `teams`, `players`, `matches`, `live_scores`, `ball_by_ball` ledger, and `custom_layouts`.
   - Set up all Row Level Security (RLS) policies.
   - Create a public `overlays` storage bucket for team logos & player avatars.

---

## 🔑 Step 2: Environment Configuration

Create a `.env` file in the root of the project to enable automated out-of-the-box Supabase connectivity:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

*Note: You can find these values under Project Settings > API inside your Supabase project dashboard.*

---

## ⚡ Step 3: Local Development

Run the following commands inside the workspace:

```bash
# Install dependencies
npm install

# Run the development server
npm run dev

# Build the project for production
npm run build
```

---

## 🌐 Step 4: Publish to GitHub & Vercel

### 1. Upload to GitHub
Initialize your Git repository, commit the changes, and push to GitHub:
```bash
git init
git add .
git commit -m "Initialize CricDeck with consolidated Supabase schema"
git branch -M main
git remote add origin https://github.com/your-username/cricdeck.git
git push -u origin main
```

### 2. Connect and Deploy to Vercel
1. Log in to your **Vercel** dashboard.
2. Click **Add New** > **Project** and select your `cricdeck` GitHub repository.
3. Under **Environment Variables**, add:
   - Name: `VITE_SUPABASE_URL` | Value: *[Your Supabase URL]*
   - Name: `VITE_SUPABASE_ANON_KEY` | Value: *[Your Supabase Anon Key]*
4. Click **Deploy**.
5. Once deployed, configure your custom subdomain to point to **`cricdeck.flynx.site`** in your Vercel project settings under Settings > Domains.
