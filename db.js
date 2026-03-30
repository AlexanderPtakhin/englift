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

  // ─── ЗАЩИТА ОТ СБРОСА СТАТИСТИКИ ──────────────────────────────────────
  // Перед записью читаем сервер и берём максимум по критичным полям.
  // Даже если кто-то вызовет saveUserData(uid, {xp:0}) — на сервер
  // никогда не уйдёт значение ниже того, что там уже лежит.
  try {
    const { data: existing } = await supabase
      .from('profiles')
      .select('xp, level, streak, badges')
      .eq('id', uid)
      .maybeSingle();

    if (existing) {
      data = {
        ...data,
        xp: Math.max(data.xp ?? 0, existing.xp ?? 0),
        level: Math.max(data.level ?? 1, existing.level ?? 1),
        streak: Math.max(data.streak ?? 0, existing.streak ?? 0),
      };
      // Бейджи объединяем — не выбрасываем старые
      const myBadges = Array.isArray(data.badges) ? data.badges : [];
      const oldBadges = Array.isArray(existing.badges) ? existing.badges : [];
      data.badges = [...new Set([...myBadges, ...oldBadges])];

      console.log(
        '🛡️ saveUserData: merge с сервером → xp:',
        data.xp,
        'level:',
        data.level,
        'streak:',
        data.streak,
      );
    }
  } catch (e) {
    console.warn(
      '⚠️ saveUserData: не смогли прочитать сервер перед записью:',
      e.message,
    );
  }
  // ────────────────────────────────────────────────────────────────────────

  const payload = {
    id: uid,
    updated_at: new Date().toISOString(),
    ...data,
  };

  console.log('📤 saveUserData → upsert профиля:', {
    uid,
    keys: Object.keys(payload),
    xp: payload.xp,
    level: payload.level,
  });

  const { error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' });

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
  console.log('rejectFriendRequest called with:', { userId, friendId });

  // Сначала проверим, есть ли вообще такие записи
  const { data: existingRecords, error: checkError } = await supabase
    .from('friendships')
    .select('*')
    .or(
      `user_id.eq.${userId},friend_id.eq.${friendId},user_id.eq.${friendId},friend_id.eq.${userId}`,
    );

  console.log('Existing records before delete:', existingRecords);
  console.log('Check error:', checkError);

  // Удаляем запись, где текущий пользователь отправитель
  const { error: error1 } = await supabase
    .from('friendships')
    .delete()
    .eq('user_id', userId)
    .eq('friend_id', friendId);

  console.log('First delete error:', error1);

  // Удаляем запись, где текущий пользователь получатель
  const { error: error2 } = await supabase
    .from('friendships')
    .delete()
    .eq('user_id', friendId)
    .eq('friend_id', userId);

  console.log('Second delete error:', error2);

  if (error1) {
    console.error('Error in first delete:', error1);
    throw error1;
  }
  if (error2) {
    console.error('Error in second delete:', error2);
    throw error2;
  }

  console.log('Friend request rejected successfully');
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
  console.log('🔥 addReaction в db.js:', { messageId, userId, emoji });
  const { error } = await supabase
    .from('reactions')
    .insert({ message_id: messageId, user_id: userId, emoji });
  if (error) {
    console.error('🔥 Ошибка addReaction:', error);
    throw error;
  }
  console.log('🔥 addReaction успешен');
}

export async function removeReaction(messageId, userId, emoji) {
  console.log('🔥 removeReaction в db.js:', { messageId, userId, emoji });
  const { error } = await supabase
    .from('reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji);
  if (error) {
    console.error('🔥 Ошибка removeReaction:', error);
    throw error;
  }
  console.log('🔥 removeReaction успешен');
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
