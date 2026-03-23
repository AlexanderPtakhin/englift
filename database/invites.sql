-- Создание таблицы инвайтов
CREATE TABLE invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inviter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  uses INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Включаем RLS
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Политики доступа
CREATE POLICY "anyone can read invites" ON invites FOR SELECT USING (true);
CREATE POLICY "owner can insert" ON invites FOR INSERT WITH CHECK (auth.uid() = inviter_id);
CREATE POLICY "anyone can update uses" ON invites FOR UPDATE USING (true);
