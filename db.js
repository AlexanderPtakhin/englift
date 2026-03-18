import { supabase } from './supabase.js';

// ─── WORDS ───────────────────────────────────────────────

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
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error loading words:', error);
    callback([]);
  } else {
    // Преобразуем correct_exercise_types из JSON в массив
    const normalizedData = data.map(word => ({
      ...word,
      stats: word.stats
        ? {
            ...word.stats,
            correctExerciseTypes: word.correct_exercise_types || [],
          }
        : undefined,
    }));
    callback(normalizedData);
  }
}

export async function saveWordToDb(word) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { updatedAt, createdAt, examplesAudio, ...wordRest } = word;

  const { error } = await supabase.from('user_words').upsert(
    {
      ...wordRest,
      user_id: user.id,
      updated_at: new Date().toISOString(),
      created_at: createdAt ?? new Date().toISOString(),
      examples_audio: examplesAudio ?? null,
      // Сохраняем correctExerciseTypes как JSON
      correct_exercise_types: word.stats?.correctExerciseTypes ?? null,
    },
    { onConflict: 'id' },
  );

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

// ─── PROFILES ────────────────────────────────────────────

export async function saveUserData(uid, data) {
  if (!uid) {
    console.warn('saveUserData: нет uid');
    return;
  }

  const payload = {
    id: uid, // ← ОБЯЗАТЕЛЬНО для upsert
    updated_at: new Date().toISOString(),
    ...data, // xp, level, badges, streak, dailyprogress и т.д.
  };

  console.log('📤 saveUserData → upsert профиля:', {
    uid,
    keys: Object.keys(payload),
    xp: payload.xp,
    level: payload.level,
  });

  const { error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' }); // ← ВОТ ЗДЕСЬ МАГИЯ

  if (error) {
    console.error('❌ Ошибка сохранения профиля:', error);
    throw error;
  }

  console.log("✅ Профиль успешно upsert'нут в Supabase");
}

// ─── IDIOMS ──────────────────────────────────────────────

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
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error loading idioms:', error);
    callback([]);
  } else {
    // Преобразуем correct_exercise_types из JSON в массив
    const normalizedData = data.map(idiom => ({
      ...idiom,
      stats: idiom.stats
        ? {
            ...idiom.stats,
            correctExerciseTypes: idiom.correct_exercise_types || [],
          }
        : undefined,
    }));
    callback(normalizedData);
  }
}

export async function saveIdiomToDb(idiom) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Вытаскиваем все camelCase поля которых нет в DB
  const {
    updatedAt,
    createdAt,
    examplesAudio,
    example_translation, // исправлено: в DB это example_translation
    ...idiomRest
  } = idiom;

  const idiomData = {
    ...idiomRest,
    user_id: user.id,
    updated_at: new Date().toISOString(),
    created_at: createdAt ?? new Date().toISOString(),
    examples_audio: examplesAudio || [], // исправлено: всегда массив
    example_translation: example_translation ?? null, // ← маппинг
    // Сохраняем correctExerciseTypes как JSON
    correct_exercise_types: idiom.stats?.correctExerciseTypes ?? null,
  };

  // Детальное логирование для отладки
  console.log('📤 Отправка идиомы в Supabase:', {
    data: idiomData,
    keys: Object.keys(idiomData),
    examples_audio_type: Array.isArray(idiomData.examples_audio),
    examples_audio_value: idiomData.examples_audio,
    example_translation_type: typeof idiomData.example_translation,
    example_translation_value: idiomData.example_translation,
  });

  const { error } = await supabase
    .from('user_idioms')
    .upsert(idiomData, { onConflict: 'id' });

  if (error) {
    console.error('❌ Ошибка сохранения идиомы в Supabase:', error);
    throw error;
  }
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
