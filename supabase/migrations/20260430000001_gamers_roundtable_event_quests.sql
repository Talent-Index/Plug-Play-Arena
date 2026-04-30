-- =====================================================
-- Gamers Roundtable with Avalanche Team1
-- Event + 10 Gaming on Avalanche quests
-- =====================================================

-- Add 'gaming' category to quests (drop old inline constraint, re-add with new value)
ALTER TABLE public.quests DROP CONSTRAINT IF EXISTS quests_category_check;
ALTER TABLE public.quests
  ADD CONSTRAINT quests_category_check
  CHECK (category IN ('social','community','wallet','builders_hub','gaming'));

-- ── INSERT EVENT ──────────────────────────────────────────────────────────
INSERT INTO public.events (
  title, description, format, location, status,
  category, tracks, difficulty, reward_pool,
  cover_emoji, agenda, missions, capacity, starts_at, ends_at,
  is_platform_event, leaderboard_visible
) VALUES (
  'Gamers Roundtable with Avalanche Team1',
  E'Welcome to the Gamers Roundtable in Nairobi 🎮🔺\n\n✨ Introduction\n\nCome meet the Avalanche community for an evening of gaming, networking, and ecosystem discovery.\n\nWhether you''re a gamer, game developer, studio, producer, or exploring opportunities in gaming, this meetup is your chance to connect with fellow builders, creators, and community members shaping the future of gaming.\n\nEnjoy drinks, bites, and great energy, alongside directed roundtable sessions focused on the gaming ecosystem, Avalanche opportunities, and how to actively participate and build.\n\nWe''ll close the evening with a Trivia Night & Social Mixer — bringing fun, competition, and meaningful connections all in one space.\n\n🤝 Partners & Sponsors\n\nAvalanche Team1 — A global community of builders driving adoption and supporting developers building on Avalanche.\n\nBlockchain Centre Nairobi — A hub for blockchain innovation and community events, providing the space for collaboration, learning, and ecosystem growth.\n\n🧩 About Team1\nTeam1 is a new global network of builders, developers, creatives, gamers, and community leaders dedicated to growing the Avalanche ecosystem. Operating in over 30 countries, Team1 drives the democratization and global adoption of Avalanche by onboarding new users and projects through local meetups, targeted workshops, exclusive side events, engaging content creation and community-led initiatives.',
  'irl',
  'Blockchain Centre Nairobi',
  'live',
  'Community Meetup',
  ARRAY['student','developer','builder','founder'],
  'beginner',
  'AVAX + Genesis Merch + NFTs',
  '🎮',
  '[{"time":"3:00 PM","title":"Doors open & welcome attendees"},{"time":"3:30 PM","title":"Opening words by Team1 East Africa"},{"time":"3:45 PM","title":"Intro to Avalanche & Gaming Ecosystem"},{"time":"4:15 PM","title":"Directed Gamers Roundtable Sessions (Gamers, Devs, Studios, Producers)"},{"time":"5:30 PM","title":"Insights Sharing & Open Discussion"},{"time":"6:00 PM","title":"Q&A Session"},{"time":"6:30 PM","title":"Trivia Night Kickoff 🎮"},{"time":"7:00 PM","title":"Networking, drinks & bites 🍹"},{"time":"9:00 PM","title":"Closing & goodbye"}]',
  ARRAY['grt-q1-intro-gaming','grt-q2-why-avalanche','grt-q3-off-the-grid','grt-q4-defi-kingdoms','grt-q5-gaming-subnet','grt-q6-game-types','grt-q7-core-wallet','grt-q8-arcad3','grt-q9-play-to-earn','grt-q10-avax-advantage'],
  150,
  '2026-05-10 15:00:00+03',
  '2026-05-10 21:00:00+03',
  true,
  true
);

-- ── INSERT 10 GAMING ON AVALANCHE QUESTS ─────────────────────────────────
INSERT INTO public.quests (id, title, description, emoji, category, evidence_kind, placeholder, xp_reward, sort_order) VALUES

  ('grt-q1-intro-gaming',
   'What is Gaming on Avalanche?',
   'Visit https://www.gamingonavax.com/ and explore the home page. Gaming on Avalanche is backed by the best tech and built by a community of game developers, content creators, and gamers. Type "AVAX GAMING" below to confirm you have read the intro.',
   '🎮', 'gaming', 'code', 'AVAX GAMING', 20, 10),

  ('grt-q2-why-avalanche',
   'Why do game developers choose Avalanche?',
   'Developers choose Avalanche because it gives complete creative freedom, is highly scalable, and provides a low-latency gaming experience. Which of these is NOT a reason? A) Creative freedom  B) High fees  C) Scalability  D) Low latency. Type the letter of the wrong answer.',
   '⚡', 'gaming', 'code', 'B', 25, 11),

  ('grt-q3-off-the-grid',
   'Who built "Off the Grid" on Avalanche?',
   '"Off the Grid" is a futuristic battle royale game built by a major studio on Avalanche. It showcases how AAA game studios are leveraging the chain. Name the studio that built it.',
   '🔫', 'gaming', 'code', 'Gunzilla', 25, 12),

  ('grt-q4-defi-kingdoms',
   'What type of game is DeFi Kingdoms?',
   'DeFi Kingdoms is one of the most popular games on Avalanche. It combines decentralized finance (DeFi) mechanics with RPG gameplay. What genre is it? (e.g. RPG, FPS, RTS)',
   '⚔️', 'gaming', 'code', 'RPG', 25, 13),

  ('grt-q5-gaming-subnet',
   'What is an Avalanche Subnet?',
   'Avalanche Subnets allow game studios to launch their own customized blockchain tailored to their game. This means lower fees, custom rules, and dedicated throughput. Type "SUBNET" to confirm you understand this concept.',
   '🌐', 'gaming', 'code', 'SUBNET', 20, 14),

  ('grt-q6-game-types',
   'Name 3 games available on gamingonavax.com',
   'Go to https://www.gamingonavax.com/ and browse the featured games. Examples include: Off the Grid, DeFi Kingdoms, Spellborne, Castle, Domi Online, Megaweapon, Bloodloop, RKL, MapleStory, Hatchyverse, Portal Fantasy and more. Type the names of any 3 games you found.',
   '🕹️', 'gaming', 'code', 'e.g. Off the Grid, DeFi Kingdoms, Spellborne', 30, 15),

  ('grt-q7-core-wallet',
   'Set up Core Wallet for Avalanche Gaming',
   'Core is the official Avalanche wallet and your gateway to all games on the ecosystem. Download it from core.app, create an account, and paste your wallet address below to complete this quest.',
   '🦊', 'gaming', 'wallet', '0x...', 50, 16),

  ('grt-q8-arcad3',
   'What is Arcad3?',
   'Arcad3 is the gaming community hub within the Avalanche ecosystem, built by gamers for gamers. It connects players, developers, and studios. Type "ARCAD3" to confirm you know about this platform.',
   '🕹️', 'gaming', 'code', 'ARCAD3', 20, 17),

  ('grt-q9-play-to-earn',
   'What does Play-to-Earn mean in Web3 gaming?',
   'Play-to-Earn (P2E) means players can earn real digital assets (tokens, NFTs) while playing games. On Avalanche, these assets are truly owned by the player and tradeable. Which asset type do P2E games reward? A) In-game credits that expire  B) Blockchain tokens and NFTs  C) Gift cards  D) None. Type the correct letter.',
   '💰', 'gaming', 'code', 'B', 25, 18),

  ('grt-q10-avax-advantage',
   'The Avalanche Gaming Advantage',
   'You have completed the Gamers Roundtable quest line! Avalanche''s gaming advantage comes from 3 pillars: 1) Subnets for dedicated game chains, 2) Sub-second finality for real-time gameplay, 3) A thriving community of devs and players. Type "TEAM1 AVAX" to claim your completion badge.',
   '🏆', 'gaming', 'code', 'TEAM1 AVAX', 50, 19)

ON CONFLICT (id) DO NOTHING;
