/**
 * TGLCHAT - Telegram-style Chat Module for EngLift
 * Unique prefix: tgl- for all classes
 */

import { supabase } from '../supabase.js';
import { toast, playSound, esc } from './utils.js';

// === STATE ===
let tglCurrentUser = null;
let tglCurrentFriend = null;
let tglOverlay = null;
let tglMessagesContainer = null;
let tglInput = null;
let tglReactionsMap = new Map(); // msgId -> {emoji: [userIds]}
let tglMsgChannel = null;
let tglReactionChannel = null;
let tglPresenceChannel = null;
let tglTypingTimer = null;
let tglIsTyping = false;
let tglIsNearBottom = true;
let tglPollingInterval = null;

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function isSticker(text) {
  return /^\p{Emoji}$/u.test(text) && text.length <= 2;
}

function setTypingStatus(isTyping) {
  const statusEl = document.getElementById('tgl-header-status');
  if (!statusEl) return;

  if (isTyping) {
    statusEl.textContent = 'печатает…';
    statusEl.classList.add('tgl-header-status--typing');
  } else {
    statusEl.textContent = '';
    statusEl.classList.remove('tgl-header-status--typing');
  }
}

async function sendTypingState(isTyping) {
  if (!tglPresenceChannel) return;
  try {
    tglIsTyping = isTyping;
    await tglPresenceChannel.track({
      user_id: tglCurrentUser,
      friend_id: tglCurrentFriend?.id,
      typing: isTyping,
      ts: Date.now(),
    });
  } catch (err) {
    console.warn('Typing state error:', err);
  }
}

// === STICKERS ===
const TGL_STICKERS = [
  '👍',
  '❤️',
  '😂',
  '😮',
  '😢',
  '🔥',
  '👏',
  '🎉',
  '🤔',
  '😡',
  '🥳',
  '😴',
  '🤮',
  '🤡',
  '💩',
  '🙈',
];

// === REACTION EMOJIS ===
const TGL_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '👏', '🎉'];

// === EMOJIS FOR PICKER ===
const TGL_EMOJIS = [
  '😀',
  '😃',
  '😄',
  '😁',
  '😆',
  '😅',
  '🤣',
  '😂',
  '🙂',
  '🙃',
  '😉',
  '😊',
  '😇',
  '🥰',
  '😍',
  '🤩',
  '😘',
  '😗',
  '😚',
  '😙',
  '🥲',
  '😋',
  '😛',
  '😜',
  '🤪',
  '😝',
  '🤑',
  '🤗',
  '🤭',
  '🤫',
  '🤔',
  '🤐',
  '🤨',
  '😐',
  '😑',
  '😶',
  '😏',
  '😒',
  '🙄',
  '😬',
  '🤥',
  '😌',
  '😔',
  '😪',
  '🤤',
  '😴',
  '😷',
  '🤒',
  '🤕',
  '🤢',
  '🤮',
  '🤧',
  '🥵',
  '🥶',
  '🥴',
  '😵',
  '🤯',
  '🤠',
  '🥳',
  '🥸',
  '😎',
  '🤓',
  '🧐',
  '😕',
  '👍',
  '👎',
  '👏',
  '🙌',
  '🤝',
  '👊',
  '✊',
  '🤛',
  '🤜',
  '🤞',
  '✌️',
  '🤟',
  '🤘',
  '👌',
  '🤏',
  '👈',
  '👉',
  '👆',
  '👇',
  '☝️',
  '✋',
  '🤚',
  '🖐️',
  '🖖',
  '👋',
  '🤙',
  '💪',
  '🦾',
  '🖕',
  '✍️',
  '🙏',
  '💅',
  '❤️',
  '🧡',
  '💛',
  '💚',
  '💙',
  '💜',
  '🖤',
  '🤍',
  '🤎',
  '💔',
  '❣️',
  '💕',
  '💞',
  '💓',
  '💗',
  '💖',
  '🔥',
  '⭐',
  '🌟',
  '✨',
  '⚡',
  '💫',
  '🎉',
  '🎊',
  '🎁',
  '🎀',
  '🏆',
  '🎯',
  '🎮',
  '🎲',
  '🎸',
  '🎺',
  '🐶',
  '🐱',
  '🐭',
  '🐹',
  '🐰',
  '🦊',
  '🐻',
  '🐼',
  '🐨',
  '🐯',
  '🦁',
  '🐮',
  '🐷',
  '🐸',
  '🐵',
  '🐔',
  '🍎',
  '🍐',
  '🍊',
  '🍋',
  '🍌',
  '🍉',
  '🍇',
  '🍓',
  '🫐',
  '🍈',
  '🍒',
  '🍑',
  '🍍',
  '🥝',
  '🍅',
  '🥥',
];

// === OPEN CHAT ===
export async function openChat(friendId, friendName, friendAvatar) {
  if (tglOverlay) closeChat();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    toast('Необходимо авторизоваться', 'danger');
    return;
  }

  tglCurrentUser = user.id;
  tglCurrentFriend = { id: friendId, name: friendName, avatar: friendAvatar };

  // ✅ Мгновенно обнуляем счётчик для этого друга локально
  const perFriendBadge = document.getElementById(
    `friend-chat-badge-${friendId}`,
  );
  if (perFriendBadge) {
    perFriendBadge.textContent = '';
    perFriendBadge.style.display = 'none';
  }

  // Пересчитываем общий счётчик по всем видимым бейджам без DB
  let totalUnread = 0;
  document.querySelectorAll('[id^="friend-chat-badge-"]').forEach(b => {
    totalUnread += parseInt(b.textContent) || 0;
  });
  window.unreadMessagesCount = totalUnread;
  updateFloatingChatButton();
  if (typeof window.updateFriendsNavBadge === 'function') {
    window.updateFriendsNavBadge();
  }

  // Пишем в БД асинхронно — не блокируем UI
  markMessagesRead(user.id, friendId).catch(console.warn);

  createChatUI(friendName, friendAvatar);
  setupEventListeners();
  await loadHistory();
  subscribeToUpdates();

  tglInput?.focus();
}

// === CREATE UI ===
function createChatUI(name, avatar) {
  tglOverlay = document.createElement('div');
  tglOverlay.className = 'tgl-overlay';

  // Генерируем аватар из первой буквы имени
  const firstLetter = name.charAt(0).toUpperCase();

  tglOverlay.innerHTML = `
    <div class="tgl-window">
      <div class="tgl-header">
        <div class="tgl-header-user">
          <div class="tgl-header-avatar">${firstLetter}</div>
          <div class="tgl-header-info">
            <span class="tgl-header-name">${esc(name)}</span>
            <span class="tgl-header-status" id="tgl-header-status"></span>
          </div>
        </div>
        <div class="tgl-header-actions">
          <button class="tgl-btn-icon tgl-btn-clear" title="Очистить историю">
            <span class="material-symbols-outlined">delete</span>
          </button>
          <button class="tgl-btn-icon tgl-btn-close" title="Закрыть">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>
      <div class="tgl-messages" id="tgl-messages"></div>
      <div class="tgl-input-area">
        <div class="tgl-input-wrap">
          <input type="text" class="tgl-input" placeholder="Сообщение..." maxlength="1000" autocomplete="off" autocorrect="off" autocapitalize="off" name="chat-message">
          <button class="tgl-btn-emoji" title="Эмодзи">
            <span class="material-symbols-outlined">mood</span>
          </button>
        </div>
        <button class="tgl-btn-send" title="Отправить">
          <span class="material-symbols-outlined">send</span>
        </button>
      </div>
      <button class="tgl-scroll-bottom">
        <span class="material-symbols-outlined">keyboard_arrow_down</span>
      </button>
    </div>
  `;

  document.body.appendChild(tglOverlay);
  tglMessagesContainer = tglOverlay.querySelector('#tgl-messages');
  tglInput = tglOverlay.querySelector('.tgl-input');
}

// === EVENT LISTENERS ===
function setupEventListeners() {
  // Close on overlay click
  tglOverlay.addEventListener('click', e => {
    if (e.target === tglOverlay) closeChat();
  });

  // Close button
  tglOverlay
    .querySelector('.tgl-btn-close')
    .addEventListener('click', closeChat);

  // Clear button
  tglOverlay
    .querySelector('.tgl-btn-clear')
    .addEventListener('click', clearHistory);

  // Send button
  tglOverlay
    .querySelector('.tgl-btn-send')
    .addEventListener('click', sendMessage);

  // Enter key
  tglInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
  });

  // Typing indicator
  tglInput.addEventListener('input', async () => {
    if (!tglInput) return;
    const hasText = !!tglInput.value.trim();

    if (hasText && !tglIsTyping) {
      await sendTypingState(true);
    }

    if (tglTypingTimer) clearTimeout(tglTypingTimer);
    tglTypingTimer = setTimeout(() => {
      sendTypingState(false);
    }, 1800);
  });

  // Emoji picker
  tglOverlay
    .querySelector('.tgl-btn-emoji')
    .addEventListener('click', toggleEmojiPicker);

  // Scroll tracking
  tglMessagesContainer.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = tglMessagesContainer;
    tglIsNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    const scrollBtn = tglOverlay.querySelector('.tgl-scroll-bottom');
    scrollBtn.classList.toggle('tgl-scroll-bottom--visible', !tglIsNearBottom);

    // Close reaction picker on scroll
    document.querySelectorAll('.tgl-reaction-panel').forEach(el => el.remove());
    document.querySelectorAll('.tgl-msg--picker-below').forEach(el => {
      el.classList.remove('tgl-msg--picker-below');
    });
  });

  // Scroll to bottom button
  tglOverlay
    .querySelector('.tgl-scroll-bottom')
    .addEventListener('click', () => {
      scrollToBottom();
    });
}

// === LOAD HISTORY ===
async function loadHistory() {
  tglMessagesContainer.innerHTML =
    '<div style="text-align:center;padding:40px;color:#888">Загрузка...</div>';

  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${tglCurrentUser},receiver_id.eq.${tglCurrentFriend.id}),and(sender_id.eq.${tglCurrentFriend.id},receiver_id.eq.${tglCurrentUser})`,
      )
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;

    // Load reactions (graceful fallback if table doesn't exist)
    const msgIds = messages?.map(m => m.id) || [];
    if (msgIds.length) {
      try {
        const { data: reactions } = await supabase
          .from('reactions')
          .select('*')
          .in('message_id', msgIds);

        tglReactionsMap.clear();
        reactions?.forEach(r => {
          if (!tglReactionsMap.has(r.message_id)) {
            tglReactionsMap.set(r.message_id, {});
          }
          const map = tglReactionsMap.get(r.message_id);
          if (!map[r.emoji]) map[r.emoji] = [];
          map[r.emoji].push(r.user_id);
        });
      } catch (e) {
        // Table doesn't exist, ignore
        tglReactionsMap.clear();
      }
    }

    tglMessagesContainer.innerHTML = '';
    for (const msg of messages || []) {
      await renderMessage(msg);
    }
    scrollToBottom();
    markMessagesAsRead();
  } catch (err) {
    console.error('Load error:', err);
    tglMessagesContainer.innerHTML =
      '<div style="text-align:center;padding:40px;color:#e74c3c">Ошибка загрузки</div>';
  }
}

// === RENDER MESSAGE ===
function renderMessage(msg) {
  const isOwn = msg.sender_id === tglCurrentUser;
  const sticker = isSticker(msg.text);
  const reactions = tglReactionsMap.get(msg.id) || {};
  const time = new Date(msg.created_at).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const msgEl = document.createElement('div');
  msgEl.className = `tgl-msg ${isOwn ? 'tgl-msg--own' : 'tgl-msg--other'} ${sticker ? 'tgl-msg--sticker' : ''}`;
  msgEl.dataset.id = msg.id;

  let html = '<div class="tgl-msg-bubble">';

  if (sticker) {
    html += `<span class="tgl-sticker">${msg.text}</span>`;
  } else {
    html += `<div class="tgl-msg-text">${esc(msg.text)}</div>`;
    html += `<div class="tgl-msg-meta">`;
    html += `<span class="tgl-msg-time">${time}</span>`;

    if (isOwn) {
      const readIcon = msg.read ? 'done_all' : 'done';
      const readClass = msg.read ? 'tgl-read--read' : 'tgl-read--sent';
      html += `
        <span class="material-symbols-outlined tgl-read-status ${readClass}">
          ${readIcon}
        </span>
      `;
    }

    html += `</div>`;
  }

  // Reactions
  if (Object.keys(reactions).length) {
    html += '<div class="tgl-reactions">';
    Object.entries(reactions).forEach(([emoji, users]) => {
      html += `<span class="tgl-reaction ${users.includes(tglCurrentUser) ? 'tgl-reaction--active' : ''}" data-emoji="${emoji}">${emoji}</span>`;
    });
    html += '</div>';
  }

  html += '</div>';
  msgEl.innerHTML = html;

  // Click to add reaction
  msgEl.addEventListener('click', e => {
    if (e.target.closest('.tgl-reaction')) return;
    // Используем актуальный ID из DOM (может быть обновлен после отправки)
    const currentMsgId = msgEl.dataset.id;
    showReactionPicker(currentMsgId, msgEl);
  });

  // Reaction click handlers
  msgEl.querySelectorAll('.tgl-reaction').forEach(reaction => {
    reaction.addEventListener('click', e => {
      e.stopPropagation();
      const currentMsgId = msgEl.dataset.id;
      toggleReaction(currentMsgId, reaction.dataset.emoji);
    });
  });

  tglMessagesContainer.appendChild(msgEl);
  return msgEl;
}

// === UPDATE TEMP MESSAGE ===
function updateTempMessage(tempId, realMsg) {
  const el = tglMessagesContainer.querySelector(`[data-id="${tempId}"]`);
  if (!el) return false;

  el.dataset.id = realMsg.id;
  el.classList.remove('tgl-msg--pending');

  const timeEl = el.querySelector('.tgl-msg-meta span');
  if (timeEl) {
    timeEl.textContent = new Date(realMsg.created_at).toLocaleTimeString(
      'ru-RU',
      {
        hour: '2-digit',
        minute: '2-digit',
      },
    );
  }

  const readEl = el.querySelector('.tgl-read-status');
  if (readEl) {
    if (realMsg.read) {
      readEl.textContent = 'done_all';
      readEl.classList.remove('tgl-read--sent');
      readEl.classList.add('tgl-read--read');
    } else {
      readEl.textContent = 'done';
      readEl.classList.remove('tgl-read--read');
      readEl.classList.add('tgl-read--sent');
    }
  }

  return true;
}

// === SEND MESSAGE ===
async function sendMessage() {
  const text = tglInput.value.trim();
  if (!text) return;

  const sticker = isSticker(text);
  const tempId = `temp-${Date.now()}`;
  const tempMsg = {
    id: tempId,
    sender_id: tglCurrentUser,
    receiver_id: tglCurrentFriend.id,
    text: text,
    created_at: new Date().toISOString(),
    read: false,
  };
  renderMessage(tempMsg);
  tglInput.value = '';
  scrollToBottom();
  playSound('sound/send.mp3');

  if (tglTypingTimer) clearTimeout(tglTypingTimer);
  await sendTypingState(false);

  try {
    const { data: realMsg, error } = await supabase
      .from('messages')
      .insert({
        sender_id: tglCurrentUser,
        receiver_id: tglCurrentFriend.id,
        text: text,
        read: false,
      })
      .select()
      .single();

    if (error) throw error;

    // Обновляем временное сообщение вместо удаления и повторного рендера
    const updated = updateTempMessage(tempId, realMsg);
    if (!updated) {
      renderMessage(realMsg);
    }
    scrollToBottom();
  } catch (err) {
    console.error('Send error:', err);
    toast('Ошибка отправки', 'danger');
    const tempElement = tglMessagesContainer.querySelector(
      `[data-id="${tempId}"]`,
    );
    if (tempElement) tempElement.remove();
  }
}

// === TOGGLE REACTION ===
async function toggleReaction(msgId, emoji) {
  const msgEl = tglMessagesContainer.querySelector(`[data-id="${msgId}"]`);
  const existing = msgEl?.querySelector(`.tgl-reaction[data-emoji="${emoji}"]`);
  const isAdding = !existing;

  // Optimistic update
  updateReactionUI(msgId, emoji, isAdding ? 1 : -1);

  try {
    if (isAdding) {
      await supabase.from('reactions').insert({
        message_id: msgId,
        user_id: tglCurrentUser,
        emoji: emoji,
      });
      playSound('sound/send.mp3');
    } else {
      await supabase
        .from('reactions')
        .delete()
        .eq('message_id', msgId)
        .eq('user_id', tglCurrentUser)
        .eq('emoji', emoji);
    }
  } catch (err) {
    console.error('Reaction error:', err);
    updateReactionUI(msgId, emoji, isAdding ? -1 : 1); // Rollback
    toast('Ошибка', 'danger');
  }
}

// === UPDATE REACTION UI ===
function updateReactionUI(msgId, emoji, delta) {
  const msgEl = tglMessagesContainer.querySelector(`[data-id="${msgId}"]`);
  if (!msgEl) return;

  let container = msgEl.querySelector('.tgl-reactions');
  if (!container) {
    container = document.createElement('div');
    container.className = 'tgl-reactions';
    msgEl.querySelector('.tgl-msg-bubble').appendChild(container);
  }

  let reaction = container.querySelector(`[data-emoji="${emoji}"]`);

  if (delta === 1 && !reaction) {
    reaction = document.createElement('span');
    reaction.className = 'tgl-reaction tgl-reaction--active';
    reaction.dataset.emoji = emoji;

    reaction.textContent = emoji;

    container.appendChild(reaction);
    reaction.addEventListener('click', e => {
      e.stopPropagation();
      toggleReaction(msgId, emoji);
    });
  } else if (delta === -1 && reaction) {
    reaction.remove();
  } else if (reaction && delta === 1) {
    reaction.classList.add('tgl-reaction--active');
  } else if (reaction && delta === -1) {
    reaction.classList.remove('tgl-reaction--active');
    reaction.remove();
  }
}

// === SHOW REACTION PICKER ===
function showReactionPicker(msgId, msgEl) {
  document.querySelectorAll('.tgl-reaction-panel').forEach(el => el.remove());
  document.querySelectorAll('.tgl-msg--picker-below').forEach(el => {
    el.classList.remove('tgl-msg--picker-below');
  });

  const bubble = msgEl.querySelector('.tgl-msg-bubble');
  const list = tglMessagesContainer;
  if (!bubble || !list) return;

  const panel = document.createElement('div');
  panel.className = 'tgl-reaction-panel';
  panel.innerHTML = TGL_REACTIONS.map(
    e => `<span class="tgl-reaction-option" data-emoji="${e}">${e}</span>`,
  ).join('');

  msgEl.appendChild(panel);

  const msgRect = msgEl.getBoundingClientRect();
  const listRect = list.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();

  const spaceAbove = msgRect.top - listRect.top;
  const spaceBelow = listRect.bottom - msgRect.bottom;

  if (spaceAbove < panelRect.height + 8 && spaceBelow > panelRect.height + 8) {
    msgEl.classList.add('tgl-msg--picker-below');
  }

  panel.querySelectorAll('.tgl-reaction-option').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      toggleReaction(msgId, item.dataset.emoji);
      panel.remove();
      msgEl.classList.remove('tgl-msg--picker-below');
    });
  });

  setTimeout(() => {
    const closeHandler = e => {
      if (!panel.contains(e.target) && !msgEl.contains(e.target)) {
        panel.remove();
        msgEl.classList.remove('tgl-msg--picker-below');
        document.removeEventListener('click', closeHandler, true);
      }
    };
    document.addEventListener('click', closeHandler, true);
  }, 0);
}

// === TOGGLE EMOJI PICKER ===
function toggleEmojiPicker() {
  const existing = document.querySelector('.tgl-emoji-panel');
  if (existing) {
    existing.remove();
    return;
  }

  const panel = document.createElement('div');
  panel.className = 'tgl-emoji-panel';
  panel.innerHTML = `<div class="tgl-emoji-grid">${TGL_EMOJIS.map(
    e => `<span class="tgl-emoji-item">${e}</span>`,
  ).join('')}</div>`;

  const btn = tglOverlay.querySelector('.tgl-btn-emoji');
  const winRect = tglOverlay
    .querySelector('.tgl-window')
    .getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();

  tglOverlay.querySelector('.tgl-window').appendChild(panel);

  // Position above button
  let top = btnRect.top - winRect.top - panel.offsetHeight - 8;
  let left = btnRect.left - winRect.left - panel.offsetWidth + btnRect.width;

  if (top < 8) top = btnRect.bottom - winRect.top + 8;
  if (left < 8) left = 8;
  if (left + panel.offsetWidth > winRect.width - 8) {
    left = winRect.width - panel.offsetWidth - 8;
  }

  panel.style.top = `${top}px`;
  panel.style.left = `${left}px`;

  panel.querySelectorAll('.tgl-emoji-item').forEach(item => {
    item.addEventListener('click', () => {
      tglInput.value += item.textContent;
      tglInput.focus();
    });
  });

  // Close on outside
  setTimeout(() => {
    const closeHandler = e => {
      if (!panel.contains(e.target) && !btn.contains(e.target)) {
        panel.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 0);
}

// === CLEAR HISTORY ===
async function clearHistory() {
  if (!confirm('Удалить всю историю переписки? Это нельзя отменить.')) return;

  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .or(
        `and(sender_id.eq.${tglCurrentUser},receiver_id.eq.${tglCurrentFriend.id}),and(sender_id.eq.${tglCurrentFriend.id},receiver_id.eq.${tglCurrentUser})`,
      );

    if (error) throw error;

    tglMessagesContainer.innerHTML = '';
    toast('История удалена', 'success');
  } catch (err) {
    console.error('Clear error:', err);
    toast('Ошибка удаления', 'danger');
  }
}

// === MARK MESSAGES AS READ ===
async function markMessagesAsRead() {
  if (!tglCurrentUser || !tglCurrentFriend) return;

  try {
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('receiver_id', tglCurrentUser)
      .eq('sender_id', tglCurrentFriend.id)
      .eq('read', false);

    // Сразу обновляем UI
    if (typeof window.updateFriendsBadges === 'function') {
      window.updateFriendsBadges();
    }
    if (typeof window.refreshChatBadges === 'function') {
      window.refreshChatBadges();
    }
  } catch (err) {
    console.error('Mark read error:', err);
  }
}

// === SCROLL TO BOTTOM ===
function scrollToBottom() {
  tglMessagesContainer.scrollTo({
    top: tglMessagesContainer.scrollHeight,
    behavior: 'smooth',
  });
}

// === SUBSCRIBE TO REALTIME ===
function subscribeToUpdates() {
  // Простой фильтр — ТОЛЬКО входящие тебе. Работает на всех планах Supabase.
  // Свои сообщения ты видишь сразу через renderMessage в sendMessage().
  tglMsgChannel = supabase
    .channel(`tgl-msg-${tglCurrentUser}-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${tglCurrentUser}`,
      },
      payload => {
        const msg = payload.new;
        // Показываем только от текущего друга
        if (msg.sender_id !== tglCurrentFriend?.id) return;
        const exists = tglMessagesContainer?.querySelector(
          `[data-id="${msg.id}"]`,
        );
        if (exists) return;
        renderMessage(msg);
        if (tglIsNearBottom) scrollToBottom();
        playSound('sound/notification.mp3');
        markMessagesAsRead();
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${tglCurrentUser}`,
      },
      payload => {
        const msg = payload.new;
        if (msg.sender_id !== tglCurrentFriend?.id) return;
        const msgEl = tglMessagesContainer?.querySelector(
          `[data-id="${msg.id}"]`,
        );
        if (!msgEl) return;

        const readEl = msgEl.querySelector('.tgl-read-status');
        if (!readEl) return;

        if (msg.read) {
          readEl.textContent = 'done_all';
          readEl.classList.remove('tgl-read--sent');
          readEl.classList.add('tgl-read--read');
        } else {
          readEl.textContent = 'done';
          readEl.classList.remove('tgl-read--read');
          readEl.classList.add('tgl-read--sent');
        }
      },
    )
    .on('system', {}, ({ status }) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[TGL Chat] WS упал, переподключение...');
        setTimeout(() => {
          tglMsgChannel?.unsubscribe();
          subscribeToUpdates();
        }, 3000);
      }
    })
    .subscribe();

  // Presence для typing — отдельный канал
  const presenceKey = [tglCurrentUser, tglCurrentFriend.id].sort().join('-');
  tglPresenceChannel = supabase
    .channel(`tgl-presence-${presenceKey}`, {
      config: { presence: { key: String(tglCurrentUser) } },
    })
    .on('presence', { event: 'sync' }, () => {
      const state = tglPresenceChannel.presenceState();
      let friendTyping = false;
      Object.values(state).forEach(entries => {
        entries.forEach(entry => {
          if (
            String(entry.user_id) === String(tglCurrentFriend.id) &&
            entry.typing
          ) {
            friendTyping = true;
          }
        });
      });
      setTypingStatus(friendTyping);
    })
    .subscribe(async status => {
      if (status === 'SUBSCRIBED') await sendTypingState(false);
    });

  // Реакции
  tglReactionChannel = supabase
    .channel(`tgl-reactions-${tglCurrentUser}-${tglCurrentFriend.id}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reactions' },
      ({ eventType, new: r, old: o }) => {
        const msgId = eventType === 'DELETE' ? o.message_id : r.message_id;
        const userId = eventType === 'DELETE' ? o.user_id : r.user_id;
        const emoji = eventType === 'DELETE' ? o.emoji : r.emoji;

        // Своя реакция — уже обновлена оптимистично, пропускаем
        if (userId === tglCurrentUser) return;

        updateReactionUI(msgId, emoji, eventType === 'DELETE' ? -1 : 1);
      },
    )
    .subscribe();

  // Polling-страховка каждые 3 секунды
  tglPollingInterval = setInterval(pollNewMessages, 3000);
}

// === POLLING NEW MESSAGES ===
async function pollNewMessages() {
  if (!tglCurrentUser || !tglCurrentFriend || !tglMessagesContainer) return;

  // Собираем ID сообщений, которые уже есть в DOM (кроме temp-)
  const existingIds = new Set(
    [...tglMessagesContainer.querySelectorAll('[data-id]')]
      .map(el => el.dataset.id)
      .filter(id => !id.startsWith('temp-')),
  );

  if (existingIds.size === 0) return;

  // Берём последние 10 записей из БД чтобы поймать новые
  const { data: recent } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${tglCurrentUser},receiver_id.eq.${tglCurrentFriend.id}),` +
        `and(sender_id.eq.${tglCurrentFriend.id},receiver_id.eq.${tglCurrentUser})`,
    )
    .order('created_at', { ascending: false })
    .limit(10);

  if (!recent) return;

  const newMsgs = recent.filter(m => !existingIds.has(m.id)).reverse();

  if (newMsgs.length === 0) return;

  for (const msg of newMsgs) {
    renderMessage(msg);
  }

  if (tglIsNearBottom) scrollToBottom();
  markMessagesAsRead();
}

// === CLOSE CHAT ===
function closeChat() {
  if (!tglOverlay) return;

  // Стоп polling
  if (tglPollingInterval) {
    clearInterval(tglPollingInterval);
    tglPollingInterval = null;
  }

  // Стоп typing timer
  if (tglTypingTimer) {
    clearTimeout(tglTypingTimer);
    tglTypingTimer = null;
  }
  tglIsTyping = false;

  setTypingStatus(false);

  tglOverlay.style.opacity = '0';
  setTimeout(() => {
    tglOverlay?.remove();
    tglOverlay = null;
    tglCurrentUser = null;
    tglCurrentFriend = null;
    tglReactionsMap.clear();

    tglMsgChannel?.unsubscribe();
    tglReactionChannel?.unsubscribe();
    tglPresenceChannel?.unsubscribe();

    tglMsgChannel = null;
    tglReactionChannel = null;
    tglPresenceChannel = null;

    if (tglTypingTimer) {
      clearTimeout(tglTypingTimer);
      tglTypingTimer = null;
    }
    tglIsTyping = false;
  }, 200);
}

// === INIT ===
export function initChat() {
  // Global access for friends list
  window.tglOpenChat = openChat;
}

// === COMPATIBILITY EXPORTS ===
export const openChatWithFriend = openChat;

export function refreshChatBadges() {
  // Placeholder for compatibility
}
