import { supabase } from './supabase.js';

console.log('[DB] db.js загружается');

// ─── WORDS ───────────────────────────────────────────────

export async function loadWordsOnce(callback) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[DB] ⚠️ loadWordsOnce: нет авторизации');
    callback([]);
    return;
  }

  console.log('[DB] Загрузка слов для user:', user.id);

  const { data, error } = await supabase
    .from('user_words')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[DB] ❌ Ошибка загрузки слов:', error);
    callback([]);
  } else {
    console.log('[DB] ✅ Загружено слов:', data.length);
    // Преобразуем correct_exercise_types из JSON в массив
    const normalizedData = data.map(word => ({
      ...word,
      examplesAudio: word.examples_audio || null, // маппинг snake_case → camelCase
      grammar: word.grammar || null,
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

  // Проверка обязательных полей
  if (!word || !word.en) {
    console.error('[DB] ❌ Ошибка сохранения слова: отсутствует поле en', word);
    throw new Error('Word object or word.en is required');
  }

  const { updatedAt, createdAt, examplesAudio, examples_audio, ...wordRest } =
    word;

  // Берём типы упражнений из stats (учитывая оба формата: camelCase и snake_case)
  const correctExerciseTypes =
    word.stats?.correctExerciseTypes ||
    word.stats?.correct_exercise_types ||
    [];

  // Очищаем stats от полей, которые вынесены в отдельные колонки
  const cleanStats = word.stats
    ? {
        ...word.stats,
        correctExerciseTypes: undefined,
        correct_exercise_types: undefined,
      }
    : undefined;

  // Проверяем существует ли слово (по id)
  const { data: existingWord } = await supabase
    .from('user_words')
    .select('id')
    .eq('id', word.id)
    .eq('user_id', user.id)
    .maybeSingle();

  const wordPayload = {
    ...wordRest,
    user_id: user.id,
    updated_at: new Date().toISOString(),
    examples_audio: examplesAudio || examples_audio || null,
    correct_exercise_types: correctExerciseTypes,
    grammar: word.grammar ?? null,
    stats: cleanStats,
  };

  // Если слово уже существует - используем update (не перезаписываем created_at)
  // Если новое слово - используем upsert с created_at
  if (existingWord) {
    console.log('WORD PAYLOAD (UPDATE)', JSON.stringify(wordPayload, null, 2));
    const { error } = await supabase
      .from('user_words')
      .update(wordPayload)
      .eq('id', word.id)
      .eq('user_id', user.id);
    if (error) throw error;
  } else {
    wordPayload.created_at = createdAt ?? new Date().toISOString();
    console.log('WORD PAYLOAD (INSERT)', JSON.stringify(wordPayload, null, 2));
    const { error } = await supabase
      .from('user_words')
      .upsert(wordPayload, { onConflict: 'id' });
    if (error) throw error;
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

// ─── PROFILES ────────────────────────────────────────────

export async function saveUserData(uid, data) {
  if (!uid) {
    console.warn('[DB] ⚠️ saveUserData: нет uid');
    return;
  }
  console.log('[DB] Сохранение профиля для:', uid);

  const payload = {
    id: uid,
    updated_at: new Date().toISOString(),
    ...data,
  };

  const { error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.error('[DB] ❌ Ошибка сохранения профиля:', error);
    throw error;
  } else {
    console.log('[DB] ✅ Профиль сохранен');
  }
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
    // Восстанавливаем correctExerciseTypes из отдельной колонки в stats
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
    exampleTranslation, // ← camelCase из script.js
    ...idiomRest
  } = idiom;

  // Переносим correctExerciseTypes из stats в отдельную колонку
  const correctExerciseTypes = idiom.stats?.correctExerciseTypes || [];

  const idiomData = {
    ...idiomRest,
    user_id: user.id,
    updated_at: new Date().toISOString(),
    created_at: createdAt ?? new Date().toISOString(),
    examples_audio: examplesAudio || [],
    example_translation: exampleTranslation ?? null, // ← маппинг camelCase → snake_case
    correct_exercise_types: correctExerciseTypes,
    stats: idiom.stats
      ? {
          ...idiom.stats,
          correctExerciseTypes: undefined,
        }
      : undefined,
  };

  // Убираем корневые camelCase поля
  delete idiomData.correctExerciseTypes;
  delete idiomData.exampleTranslation;
  delete idiomData.userId;

  console.log('IDIOM PAYLOAD', JSON.stringify(idiomData, null, 2));

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

// ─── PHRASES ─────────────────────────────────────────────

export async function loadPhrasesOnce(callback) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    callback([]);
    return;
  }

  const { data, error } = await supabase
    .from('user_phrases')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error loading phrases:', error);
    callback([]);
  } else {
    // Восстанавливаем correctExerciseTypes из отдельной колонки в stats
    const normalizedData = data.map(phrase => ({
      ...phrase,
      examplesAudio: phrase.examples_audio || [],
      exampleTranslation: phrase.example_translation || null,
      stats: phrase.stats
        ? {
            ...phrase.stats,
            correctExerciseTypes: phrase.correct_exercise_types || [],
          }
        : undefined,
    }));
    callback(normalizedData);
  }
}

export async function savePhraseToDb(phrase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  if (!phrase || !phrase.phrase || !phrase.translation) {
    throw new Error('Phrase object is invalid');
  }

  const {
    updatedAt,
    createdAt,
    examplesAudio,
    exampleTranslation,
    ...phraseRest
  } = phrase;

  const correctExerciseTypes = phrase.stats?.correctExerciseTypes || [];

  const cleanStats = phrase.stats
    ? { ...phrase.stats, correctExerciseTypes: undefined }
    : undefined;

  const phraseData = {
    ...phraseRest,
    user_id: user.id,
    updated_at: new Date().toISOString(),
    created_at: createdAt ?? new Date().toISOString(),
    examples_audio: examplesAudio ?? null,
    example_translation: exampleTranslation ?? null,
    correct_exercise_types: correctExerciseTypes,
    stats: cleanStats,
  };

  // Преобразуем sourceWordId → source_word_id
  if (phrase.sourceWordId && phraseData.source_word_id === undefined) {
    phraseData.source_word_id = phrase.sourceWordId;
  }
  delete phraseData.sourceWordId;
  delete phraseData.correctExerciseTypes;
  delete phraseData.exampleTranslation;
  delete phraseData.userId;

  if (phraseData.source_word_id === undefined) phraseData.source_word_id = null;

  console.log('🔍 [SAVE_PHRASE] Starting save for phrase:', phraseData.phrase);
  console.log('🔍 [SAVE_PHRASE] source_word_id:', phraseData.source_word_id);
  console.log(
    '🔍 [SAVE_PHRASE] stats.nextReview:',
    phraseData.stats?.nextReview,
  );

  // 1. Ищем существующую фразу по составному ключу
  const { data: existing, error: selectError } = await supabase
    .from('user_phrases')
    .select('id, stats')
    .eq('user_id', user.id)
    .eq('source_word_id', phraseData.source_word_id)
    .eq('phrase', phraseData.phrase)
    .maybeSingle();

  if (selectError) throw selectError;

  console.log('🔍 [SAVE_PHRASE] Existing record found:', !!existing);
  if (existing) {
    console.log('🔍 [SAVE_PHRASE] Existing id:', existing.id);
    console.log(
      '🔍 [SAVE_PHRASE] Existing stats.nextReview:',
      existing.stats?.nextReview,
    );
  }

  let error;
  if (existing) {
    // 2. Обновляем существующую запись (сохраняем старый id)
    console.log(
      '🔍 [SAVE_PHRASE] Updating existing record with id:',
      existing.id,
    );
    const { error: updateError } = await supabase
      .from('user_phrases')
      .update(phraseData)
      .eq('id', existing.id);
    error = updateError;
  } else {
    // 3. Вставляем новую фразу
    console.log('🔍 [SAVE_PHRASE] Inserting new phrase');
    const { error: insertError } = await supabase
      .from('user_phrases')
      .insert(phraseData);
    error = insertError;
  }

  if (error) {
    console.error('savePhraseToDb error:', error, phraseData);
    throw error;
  }
}

export async function deletePhraseFromDb(phraseId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('user_phrases')
    .delete()
    .eq('id', phraseId)
    .eq('user_id', user.id);

  if (error) throw error;
}

// ─── FRIENDSHIPS ───────────────────────────────────────────

/**
 * Поиск пользователей по username или email (исключая себя и уже имеющих связь)
 */
export async function searchUsers(query, currentUserId) {
  if (!query || query.length < 2) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, username, xp, level, streak, laststreakdate, total_words, total_idioms, learned_words',
    )
    .or(`username.ilike.%${query}%,email.ilike.%${query}%`)
    .neq('id', currentUserId)
    .limit(20);

  if (error) {
    console.error('Error searching users:', error);
    return [];
  }

  // Получаем уже существующие связи с этими пользователями
  const { data: existing } = await supabase
    .from('friendships')
    .select('user_id, friend_id, status')
    .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`);

  const existingMap = new Map();
  existing?.forEach(f => {
    const otherId = f.user_id === currentUserId ? f.friend_id : f.user_id;
    existingMap.set(otherId, f.status);
  });

  return data.map(user => ({
    ...user,
    friendshipStatus: existingMap.get(user.id) || null,
  }));
}

/**
 * Отправить запрос в друзья
 */
export async function sendFriendRequest(userId, friendId) {
  const { error } = await supabase
    .from('friendships')
    .insert({ user_id: userId, friend_id: friendId, status: 'pending' });

  if (error) throw error;
}

/**
 * Принять запрос в друзья
 */
export async function acceptFriendRequest(userId, friendId) {
  if (!userId || !friendId) {
    console.error('acceptFriendRequest: userId или friendId отсутствуют', {
      userId,
      friendId,
    });
    throw new Error('Недостаточно данных для принятия заявки');
  }
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('user_id', friendId)
    .eq('friend_id', userId)
    .eq('status', 'pending');

  if (error) throw error;
}

/**
 * Отклонить/удалить запрос (или удалить из друзей)
 */
export async function rejectFriendRequest(userId, friendId) {
  if (!userId || !friendId) {
    console.error('rejectFriendRequest: userId или friendId отсутствуют', {
      userId,
      friendId,
    });
    throw new Error('Недостаточно данных для отклонения заявки');
  }

  // Сначала проверим, есть ли вообще такие записи
  const { data: existingRecords, error: checkError } = await supabase
    .from('friendships')
    .select('*')
    .or(
      `user_id.eq.${userId},friend_id.eq.${friendId},user_id.eq.${friendId},friend_id.eq.${userId}`,
    );

  // Удаляем запись, где текущий пользователь отправитель
  const { error: error1 } = await supabase
    .from('friendships')
    .delete()
    .eq('user_id', userId)
    .eq('friend_id', friendId);

  // Удаляем запись, где текущий пользователь получатель
  const { error: error2 } = await supabase
    .from('friendships')
    .delete()
    .eq('user_id', friendId)
    .eq('friend_id', userId);

  if (error1) {
    console.error('Error in first delete:', error1);
    throw error1;
  }
  if (error2) {
    console.error('Error in second delete:', error2);
    throw error2;
  }
}

/**
 * Получить список друзей (status = accepted)
 */
export async function getFriends(userId) {
  // 1. Получаем все связи со статусом accepted
  const { data: friendships, error } = await supabase
    .from('friendships')
    .select('user_id, friend_id')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (error) {
    console.error('Error getting friends:', error);
    return [];
  }

  if (!friendships.length) return [];

  // 2. Извлекаем ID друзей
  const friendIds = friendships.map(f =>
    f.user_id === userId ? f.friend_id : f.user_id,
  );

  // 3. Получаем профили друзей
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select(
      'id, username, xp, level, streak, laststreakdate, total_words, total_idioms, learned_words',
    )
    .in('id', friendIds);

  if (profileError) {
    console.error('Error fetching friend profiles:', profileError);
    return [];
  }

  return profiles;
}

/**
 * Получить входящие заявки (pending, где friend_id = текущий пользователь)
 */
export async function getIncomingRequests(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('user_id')
    .eq('friend_id', userId)
    .eq('status', 'pending');

  if (error) {
    console.error('Error getting incoming requests:', error);
    return [];
  }

  if (!data.length) return [];

  const senderIds = data.map(req => req.user_id);

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select(
      'id, username, xp, level, streak, total_words, total_idioms, learned_words',
    )
    .in('id', senderIds);

  if (profileError) {
    console.error(
      'Error fetching profiles for incoming requests:',
      profileError,
    );
    return [];
  }

  return profiles;
}

/**
 * Получить исходящие заявки (pending, где user_id = текущий пользователь)
 */
export async function getOutgoingRequests(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (error) {
    console.error('Error getting outgoing requests:', error);
    return [];
  }

  if (!data.length) return [];

  const receiverIds = data.map(req => req.friend_id);

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select(
      'id, username, xp, level, streak, total_words, total_idioms, learned_words',
    )
    .in('id', receiverIds);

  if (profileError) {
    console.error(
      'Error fetching profiles for outgoing requests:',
      profileError,
    );
    return [];
  }

  return profiles;
}

/**
 * Получить рейтинг друзей по XP (сортировка по убыванию)
 */
export async function getFriendsLeaderboard(userId) {
  // Получаем друзей
  const friends = await getFriends(userId);

  // Получаем свой профиль
  const { data: myProfile, error } = await supabase
    .from('profiles')
    .select(
      'id, username, xp, level, streak, total_words, total_idioms, learned_words',
    )
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error(
      'getFriendsLeaderboard — ошибка загрузки своего профиля',
      error,
    );
    return friends.sort((a, b) => (b.xp || 0) - (a.xp || 0));
  }

  // Объединяем себя с друзьями и сортируем по XP
  const all = [myProfile, ...friends];
  return all.sort((a, b) => (b.xp || 0) - (a.xp || 0));
}

// ========== REACTIONS ==========

export async function addReaction(messageId, userId, emoji) {
  const { error } = await supabase
    .from('reactions')
    .insert({ message_id: messageId, user_id: userId, emoji });
  if (error) {
    console.error('Ошибка addReaction:', error);
    throw error;
  }
}

export async function removeReaction(messageId, userId, emoji) {
  const { error } = await supabase
    .from('reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji);
  if (error) {
    console.error('Ошибка removeReaction:', error);
    throw error;
  }
}

/**
 * Получает реакции для списка ID сообщений.
 * Возвращает массив объектов { message_id, user_id, emoji }
 */
export async function getReactionsForMessages(messageIds) {
  if (!messageIds.length) return [];
  const { data, error } = await supabase
    .from('reactions')
    .select('message_id, user_id, emoji')
    .in('message_id', messageIds);
  if (error) throw error;
  return data;
}
