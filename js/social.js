// js/social.js
import { supabase } from '../supabase.js';
import { toast, gainXP, playSound } from './utils.js'; // gainXP нужно будет импортировать из глобального контекста, но для простоты оставим пока ссылку на window

// ========== Друзья ==========
export async function getFriends(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('friend:profiles!friend_id(*)')
    .eq('user_id', userId)
    .eq('status', 'accepted');
  if (error) throw error;
  return data?.map(f => f.friend) || [];
}

export async function getFriendRequests(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('user:profiles!user_id(*)')
    .eq('friend_id', userId)
    .eq('status', 'pending');
  if (error) throw error;
  return data?.map(f => f.user) || [];
}

export async function getOutgoingRequests(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('friend:profiles!friend_id(*)')
    .eq('user_id', userId)
    .eq('status', 'pending');
  if (error) throw error;
  return data?.map(f => f.friend) || [];
}

export async function sendFriendRequest(senderId, receiverId) {
  const { data, error } = await supabase
    .from('friendships')
    .insert({ user_id: senderId, friend_id: receiverId, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function acceptFriendRequest(userId, friendId) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('user_id', friendId)
    .eq('friend_id', userId);
  if (error) throw error;
}

export async function rejectFriendRequest(userId, friendId) {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('user_id', friendId)
    .eq('friend_id', userId);
  if (error) throw error;

  // Удаляем все сообщения между пользователями при удалении друга
  await supabase
    .from('messages')
    .delete()
    .or(
      `(sender_id.eq.${userId},receiver_id.eq.${friendId}),(sender_id.eq.${friendId},receiver_id.eq.${userId})`,
    );
}

export async function getLeaderboard(period = 'week') {
  // Простая реализация - получаем топ по XP
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, xp, level')
    .order('xp', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
}

// ========== Челленджи ==========
export async function getAllActiveChallenges(userId) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('challenges')
    .select(
      `
      *,
      participants:challenge_participants(user_id, progress)
    `,
    )
    .gte('end_date', today);
  if (error) throw error;

  // Добавляем информацию о том, участвует ли пользователь
  return data.map(ch => ({
    ...ch,
    isParticipant: ch.participants.some(p => p.user_id === userId),
    userProgress:
      ch.participants.find(p => p.user_id === userId)?.progress || 0,
    participantsCount: ch.participants.length,
  }));
}

// Обновить прогресс пользователя во всех его активных челленджах
export async function updateAllChallengesProgress(userId, type, increment = 1) {
  // Получаем все активные челленджи, в которых участвует пользователь
  const today = new Date().toISOString().split('T')[0];
  const { data: challenges } = await supabase
    .from('challenges')
    .select(
      `
      id,
      type,
      target,
      title,
      participants:challenge_participants!inner(progress, user_id)
    `,
    )
    .eq('participants.user_id', userId)
    .gte('end_date', today);

  if (!challenges) return;

  for (const ch of challenges) {
    if (ch.type !== type) continue;
    const currentProgress = ch.participants[0].progress;
    const newProgress = Math.min(ch.target, currentProgress + increment);
    if (newProgress !== currentProgress) {
      await updateChallengeProgress(ch.id, userId, newProgress);
      if (newProgress >= ch.target) {
        // Достигнута цель челленджа — награда
        await completeChallenge(ch.id, userId, ch);
      }
    }
  }
}

// Выполнение челленджа (награда)
async function completeChallenge(challengeId, userId, challenge) {
  // Награда: например, XP = target * 2
  const xpReward = challenge.target * 2;
  if (window.gainXP) {
    await window.gainXP(xpReward, `Челлендж "${challenge.title}" завершён!`);
  }
  toast(
    `🏆 Челлендж "${challenge.title}" завершён! +${xpReward} XP`,
    'success',
  );
}

export async function createChallenge(creatorId, title, type, target, endDate) {
  const { data, error } = await supabase
    .from('challenges')
    .insert({ creator_id: creatorId, title, type, target, end_date: endDate })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function joinChallenge(challengeId, userId) {
  const { error } = await supabase
    .from('challenge_participants')
    .insert({ challenge_id: challengeId, user_id: userId });
  if (error) throw error;
}

export async function updateChallengeProgress(challengeId, userId, progress) {
  const { error } = await supabase
    .from('challenge_participants')
    .update({ progress })
    .eq('challenge_id', challengeId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ========== Подарки ==========
export async function sendGift(senderId, receiverId, amount, message) {
  const { data, error } = await supabase
    .from('gifts')
    .insert({ sender_id: senderId, receiver_id: receiverId, amount, message })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getGiftsReceived(userId) {
  const { data, error } = await supabase
    .from('gifts')
    .select('*, sender:profiles!sender_id(username)')
    .eq('receiver_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

// ========== Сообщения ==========
export async function sendMessage(senderId, receiverId, text) {
  console.log('🔥 sendMessage called:', { senderId, receiverId, text });

  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, text })
    .select()
    .single();

  console.log('🔥 sendMessage result:', { data, error });

  if (error) {
    console.error('🔥 sendMessage error:', error);
    throw error;
  }

  console.log('🔥 sendMessage success:', data);

  // Звук отправки сообщения
  playSound('sound/send.mp3');

  return data;
}

export async function getMessages(userId, friendId, limit = 50) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`,
    )
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function markMessagesRead(userId, friendId) {
  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('receiver_id', userId)
    .eq('sender_id', friendId)
    .eq('read', false);
  if (error) throw error;
}

// ========== Сравнение словарей ==========
export async function compareDictionaries(userId, friendId) {
  console.log('compareDictionaries called with:', { userId, friendId });

  // Загружаем слова и идиомы
  const { data: userWords, error: userWordsError } = await supabase
    .from('user_words')
    .select('*')
    .eq('user_id', userId);
  if (userWordsError) console.error('userWordsError:', userWordsError);
  console.log('User words count:', userWords?.length, userWords?.slice(0, 3));

  const { data: friendWords, error: friendWordsError } = await supabase
    .from('user_words')
    .select('*')
    .eq('user_id', friendId);
  if (friendWordsError) console.error('friendWordsError:', friendWordsError);
  console.log(
    'Friend words count:',
    friendWords?.length,
    friendWords?.slice(0, 3),
  );

  const { data: userIdioms, error: userIdiomsError } = await supabase
    .from('user_idioms')
    .select('*')
    .eq('user_id', userId);
  if (userIdiomsError) console.error('userIdiomsError:', userIdiomsError);
  console.log('User idioms count:', userIdioms?.length);

  const { data: friendIdioms, error: friendIdiomsError } = await supabase
    .from('user_idioms')
    .select('*')
    .eq('user_id', friendId);
  if (friendIdiomsError) console.error('friendIdiomsError:', friendIdiomsError);
  console.log('Friend idioms count:', friendIdioms?.length);

  // Формируем множества и карты
  const userWordSet = new Set(userWords.map(w => w.en.toLowerCase()));
  const friendWordSet = new Set(friendWords.map(w => w.en.toLowerCase()));
  const userWordMap = new Map(userWords.map(w => [w.en.toLowerCase(), w]));
  const friendWordMap = new Map(friendWords.map(w => [w.en.toLowerCase(), w]));

  const userIdiomSet = new Set(userIdioms.map(i => i.idiom.toLowerCase()));
  const friendIdiomSet = new Set(friendIdioms.map(i => i.idiom.toLowerCase()));
  const userIdiomMap = new Map(userIdioms.map(i => [i.idiom.toLowerCase(), i]));
  const friendIdiomMap = new Map(
    friendIdioms.map(i => [i.idiom.toLowerCase(), i]),
  );

  const commonWords = [...friendWordSet]
    .filter(w => userWordSet.has(w))
    .map(w => {
      const word = friendWordMap.get(w);
      return { ...word, examplesAudio: word.examples_audio || [] }; // Маппинг
    });
  const missingWords = [...friendWordSet]
    .filter(w => !userWordSet.has(w))
    .map(w => {
      const word = friendWordMap.get(w);
      return { ...word, examplesAudio: word.examples_audio || [] }; // Маппинг
    });
  const uniqueWords = [...userWordSet]
    .filter(w => !friendWordSet.has(w))
    .map(w => userWordMap.get(w));

  const commonIdioms = [...friendIdiomSet]
    .filter(i => userIdiomSet.has(i))
    .map(i => friendIdiomMap.get(i));
  const missingIdioms = [...friendIdiomSet]
    .filter(i => !userIdiomSet.has(i))
    .map(i => friendIdiomMap.get(i));
  const uniqueIdioms = [...userIdiomSet]
    .filter(i => !friendIdiomSet.has(i))
    .map(i => userIdiomMap.get(i));

  return {
    words: { common: commonWords, missing: missingWords, unique: uniqueWords },
    idioms: {
      common: commonIdioms,
      missing: missingIdioms,
      unique: uniqueIdioms,
    },
  };
}
