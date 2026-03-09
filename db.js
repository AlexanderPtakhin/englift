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

// Сохранить одно слово (вставка или обновление)
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

  // Сначала пробуем вставить
  const { data, error } = await supabase
    .from('user_words')
    .insert(wordData)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: updateData, error: updateError } = await supabase
        .from('user_words')
        .update(wordData)
        .eq('user_id', user.id)
        .eq('en', word.en)
        .select()
        .single();
      if (updateError) throw updateError;
    } else {
      throw error;
    }
  }
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
