import { supabase } from './supabase.js';

// Загрузить все слова пользователя (однократно)
export async function loadWordsOnce(callback) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    callback([]);
    return;
  }
  const { data, error } = await supabase
    .from('user_words')
    .select('*')
    .eq('user_id', user.id)
    .order('updatedAt', { ascending: false });

  if (error) {
    console.error('Error loading words:', error);
    callback([]);
  } else {
    callback(data);
  }
}

// Сохранить одно слово (upsert по id)
export async function saveWordToDb(word) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const wordData = {
    ...word,
    user_id: user.id,
    updatedAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('user_words')
    .upsert(wordData, { onConflict: 'id' });

  if (error) throw error;
}

// Удалить слово
export async function deleteWordFromDb(wordId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('user_words')
    .delete()
    .eq('id', wordId)
    .eq('user_id', user.id);
  if (error) throw error;
}

// Сохранить данные пользователя (профиль)
export async function saveUserData(uid, data) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: uid, ...data, updated_at: new Date().toISOString() });
  if (error) console.error('Error saving user data:', error);
}

// Загрузить все идиомы пользователя (однократно)
export async function loadIdiomsOnce(callback) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    callback([]);
    return;
  }
  const { data, error } = await supabase
    .from('user_idioms')
    .select('*')
    .eq('user_id', user.id)
    .order('updatedAt', { ascending: false });

  if (error) {
    console.error('Error loading idioms:', error);
    callback([]);
  } else {
    callback(data);
  }
}

// Сохранить одну идиому (upsert по id)
export async function saveIdiomToDb(idiom) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const idiomData = {
    ...idiom,
    user_id: user.id,
    updatedAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('user_idioms')
    .upsert(idiomData, { onConflict: 'id' });

  if (error) throw error;
}

// Удалить идиому
export async function deleteIdiomFromDb(idiomId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('user_idioms')
    .delete()
    .eq('id', idiomId)
    .eq('user_id', user.id);
  if (error) throw error;
}
