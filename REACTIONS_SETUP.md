# Настройка таблицы реакций

## 1. Создание таблицы

Выполните SQL из файла `database/reactions.sql` в консоли Supabase:

```sql
-- Создание таблицы реакций
CREATE TABLE reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Включаем RLS
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- Политики доступа
CREATE POLICY "Anyone can read reactions" ON reactions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert own reactions" ON reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions" ON reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Индексы для производительности
CREATE INDEX idx_reactions_message_id ON reactions(message_id);
CREATE INDEX idx_reactions_user_id ON reactions(user_id);
```

## 2. Как это работает

1. **Клик по сообщению** - открывает пикер с эмодзи
2. **Выбор эмодзи** - добавляет реакцию (если еще не стоит) или удаляет (если уже стоит)
3. **Real-time обновления** - реакции мгновенно обновляются у всех участников чата
4. **Счетчики** - показывают количество пользователей поставивших реакцию

## 3. Доступные эмодзи

По умолчанию доступны: ❤️, 👍, 😂, 😮, 😢, 🔥, 👏, 🎉

## 4. Функции

- `addReaction(messageId, userId, emoji)` - добавить реакцию
- `removeReaction(messageId, userId, emoji)` - удалить реакцию  
- `toggleReaction(messageId, userId, emoji)` - переключить реакцию
- `getReactionsForMessages(messageIds)` - получить реакции для сообщений
