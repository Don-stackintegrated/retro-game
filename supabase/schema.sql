-- Retro MMO Database Schema

-- 1. Profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  level INTEGER DEFAULT 1,
  energy INTEGER DEFAULT 100,
  max_energy INTEGER DEFAULT 100,
  last_energy_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pos_x INTEGER DEFAULT 10,
  pos_y INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Game Config (stats and base game stats)
CREATE TABLE game_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- 3. World State (changed tiles)
-- For a persistent scalable world, storing chunks or delta tiles.
-- tile_key formatted as 'x,y' (e.g. '10,12')
CREATE TABLE world_state (
  tile_key TEXT PRIMARY KEY,
  tile_type INTEGER NOT NULL,
  placed_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Inventory (many-to-many relationship)
CREATE TABLE inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  UNIQUE(profile_id, item_id)
);

-- Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_state ENABLE ROW LEVEL SECURITY;

-- Allow public read on world_state and profiles (since players see each other and the world)
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Public world_state viewable by everyone." ON world_state FOR SELECT USING (true);

-- Allow users to update their own profile and inventory
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can view own inventory." ON inventory FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can update own inventory." ON inventory FOR ALL USING (auth.uid() = profile_id);

-- Depending on architecture, world_state updates might be validated by database triggers or edge functions.
-- For this prototype, allow authenticated users to modify world state:
CREATE POLICY "Authenticated users can update world." ON world_state FOR ALL USING (auth.uid() IS NOT NULL);
