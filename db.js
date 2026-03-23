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
  const { data, error } = await supabase
    .from('friendships')
    .select(
      `
      user_id,
      friend_id,
      user_profile:profiles!friendships_user_id_fkey(id, username, xp, level, streak, laststreakdate, total_words, total_idioms, learned_words),
      friend_profile:profiles!friendships_friend_id_fkey(id, username, xp, level, streak, laststreakdate, total_words, total_idioms, learned_words)
    `,
    )
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (error) {
    console.error('Error getting friends:', error);
    return [];
  }

  // Преобразуем в массив друзей (другой пользователь) с дедупликацией
  const friendsMap = new Map();
  data.forEach(f => {
    const friend = f.user_id === userId ? f.friend_profile : f.user_profile;
    if (friend && !friendsMap.has(friend.id)) {
      friendsMap.set(friend.id, {
        id: friend.id,
        username: friend.username,
        xp: friend.xp,
        level: friend.level,
        streak: friend.streak,
        lastActive: friend.laststreakdate,
        total_words: friend.total_words,
        total_idioms: friend.total_idioms,
        learned_words: friend.learned_words,
      });
    }
  });

  return Array.from(friendsMap.values());
}

/**
 * Получить входящие заявки (pending, где friend_id = текущий пользователь)
 */
export async function getIncomingRequests(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select(
      `
      user_id,
      user_profile:profiles!friendships_user_id_fkey(id, username, xp, level, streak, total_words, total_idioms, learned_words)
    `,
    )
    .eq('friend_id', userId)
    .eq('status', 'pending');

  if (error) {
    console.error('Error getting incoming requests:', error);
    return [];
  }

  return data.map(f => ({
    id: f.user_id,
    username: f.user_profile.username,
    xp: f.user_profile.xp,
    level: f.user_profile.level,
    streak: f.user_profile.streak,
    total_words: f.user_profile.total_words,
    total_idioms: f.user_profile.total_idioms,
    learned_words: f.user_profile.learned_words,
  }));
}

/**
 * Получить исходящие заявки (pending, где user_id = текущий пользователь)
 */
export async function getOutgoingRequests(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select(
      `
      friend_id,
      friend_profile:profiles!friendships_friend_id_fkey(id, username, xp, level, streak, total_words, total_idioms, learned_words)
    `,
    )
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (error) {
    console.error('Error getting outgoing requests:', error);
    return [];
  }

  return data.map(f => ({
    id: f.friend_id,
    username: f.friend_profile.username,
    xp: f.friend_profile.xp,
    level: f.friend_profile.level,
    streak: f.friend_profile.streak,
    total_words: f.friend_profile.total_words,
    total_idioms: f.friend_profile.total_idioms,
    learned_words: f.friend_profile.learned_words,
  }));
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
