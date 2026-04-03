import { supabase } from './supabase.js';
import { saveUserData, loadWordsOnce } from './db.js';

console.log('[AUTH] auth.js загружается');

// DOM элементы для основного приложения
const dropdownEmail = document.getElementById('dropdown-email');
const userAvatar = document.getElementById('user-avatar');
const dropdownLogout = document.getElementById('dropdown-logout');

// Флаг для отслеживания явного выхода
let isExplicitLogoutPending = false;

// Глобальный флаг
let profileLoaded = false;
let wordsLoaded = false;
let profileLoadPromise = null;
let lastProfileLoadTime = 0;

// Функция загрузки профиля
async function loadUserProfile(user) {
  if (!user) {
    console.warn('[AUTH] ⚠️ loadUserProfile вызван без user');
    return;
  }
  console.log('[AUTH] Загрузка профиля для user:', user.id);
  const savedUsername = localStorage.getItem('englift_pending_username');

  if (window._profileLoadInProgress) {
    return;
  }
  window._profileLoadInProgress = true;
  window.currentUserId = user.id;

  try {
    if (typeof window.applyProfileData !== 'function') {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const { data: serverProfile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    // КЕЙС 1: Сервер вернул ошибку (упал, нет сети, временная недоступность)
    // → используем локальные данные, НЕ создаём новый профиль
    if (error && error.code !== 'PGRST116') {
      console.warn(
        '[AUTH] ⚠️ Ошибка сервера, пробуем локальные данные:',
        error.message,
      );
      const saved = localStorage.getItem('englift_lastknown_progress');
      if (saved) {
        try {
          const local = JSON.parse(saved);
          window.applyProfileData(local);
          return;
        } catch (e) {
          console.error('Ошибка парсинга локальных данных:', e);
        }
      }
      // Локальных данных нет — прокидываем ошибку, НЕ создаём новый профиль
      throw error;
    }

    // КЕЙС 2: Профиль не найден на сервере (serverProfile === null)
    if (!serverProfile) {
      const saved = localStorage.getItem('englift_lastknown_progress');

      if (saved) {
        try {
          const local = JSON.parse(saved);
          await saveUserData(user.id, local);
          window.applyProfileData(local);
          return;
        } catch (e) {
          console.error('Ошибка парсинга локальных данных:', e);
        }
      }

      // КЕЙС 2б: Нет ни серверных, ни локальных данных → точно новый пользователь
      const today = new Date().toISOString().split('T')[0];
      const username =
        savedUsername ||
        user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') +
          Math.floor(Math.random() * 1000);
      localStorage.removeItem('englift_pending_username');

      const defaultProfile = {
        username,
        xp: 0,
        level: 1,
        badges: [],
        streak: 0,
        laststreakdate: null,
        dailyprogress: {
          add_new: 0,
          review: 0,
          practice_time: 0,
          completed: false,
          lastReset: today,
        },
        dailyreviewcount: 0,
        lastreviewreset: today,
        usersettings: {
          has_seen_tour: false,
          voice: 'female',
          reviewLimit: 100,
          showPhonetic: true,
          baseTheme: 'lavender',
          dark: false,
        },
        darktheme: false,
      };

      await saveUserData(user.id, defaultProfile);
      console.log('[AUTH] ✅ Создан новый профиль:', username);
      window.applyProfileData(defaultProfile);

      const pendingInvite = localStorage.getItem('englift_pending_invite');
      if (pendingInvite) {
        const { data: invite } = await supabase
          .from('invites')
          .select('inviter_id')
          .eq('id', pendingInvite)
          .maybeSingle();
        if (invite && invite.inviter_id !== user.id) {
          await supabase
            .from('profiles')
            .update({ invited_by: invite.inviter_id })
            .eq('id', user.id);
        }
        localStorage.removeItem('englift_pending_invite');
      }
    } else {
      // КЕЙС 3: Серверный профиль найден — просто применяем
      if (savedUsername && savedUsername !== serverProfile.username) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ username: savedUsername })
          .eq('id', user.id);
        if (!updateError) serverProfile.username = savedUsername;
        localStorage.removeItem('englift_pending_username');
      }
      window.applyProfileData(serverProfile);
      console.log('[AUTH] ✅ Профиль загружен с сервера');
    }
  } catch (err) {
    console.error('[AUTH] ❌ Ошибка загрузки профиля:', err);
    window.toast?.(
      'Не удалось загрузить профиль: ' + (err.message || err),
      'danger',
    );
    if (typeof window.onProfileFullyLoaded === 'function') {
      window.onProfileFullyLoaded();
    }
  } finally {
    window._profileLoadInProgress = false;
    if (typeof window.onProfileFullyLoaded === 'function') {
      window.onProfileFullyLoaded();
    }
  }
}
// Применение инвайта (для друзей)
async function applyInvite(inviteId, newUserId) {
  try {
    const { data: invite, error } = await supabase
      .from('invites')
      .select('inviter_id, uses')
      .eq('id', inviteId)
      .maybeSingle();
    if (error || !invite) return;
    if (invite.inviter_id === newUserId) return;

    const { data: existing } = await supabase
      .from('friendships')
      .select('id')
      .or(
        `user_id.eq.${invite.inviter_id},friend_id.eq.${invite.inviter_id},user_id.eq.${newUserId},friend_id.eq.${newUserId}`,
      )
      .maybeSingle();
    if (existing) return;

    await supabase.from('friendships').insert([
      { user_id: invite.inviter_id, friend_id: newUserId, status: 'accepted' },
      { user_id: newUserId, friend_id: invite.inviter_id, status: 'accepted' },
    ]);

    await supabase
      .from('invites')
      .update({ uses: (invite.uses || 0) + 1 })
      .eq('id', inviteId);

    if (window.currentUserId) {
      if (typeof loadLeaderboard === 'function') loadLeaderboard('week');
      if (typeof loadFriendActivity === 'function') loadFriendActivity();
      if (typeof loadFriendsDataNew === 'function') loadFriendsDataNew();
    }
  } catch (e) {
    console.warn('applyInvite error:', e);
  }
}

// Следим за состоянием аутентификации
supabase.auth.onAuthStateChange(async (event, session) => {
  window.currentAccessToken = session?.access_token || null;
  const user = session?.user;

  const shouldLoadProfile =
    user && user.email_confirmed_at && !profileLoaded && !profileLoadPromise;

  if (shouldLoadProfile) {
    if (!profileLoadPromise) {
      profileLoadPromise = loadUserProfile(user).finally(() => {
        profileLoaded = true;
        profileLoadPromise = null;
        lastProfileLoadTime = Date.now();
      });
    }
  } else if (event === 'TOKEN_REFRESHED' && user) {
    // TOKEN_REFRESHED — профиль не перезагружаем
  } else if (event === 'SIGNED_IN') {
    if (profileLoaded && Date.now() - lastProfileLoadTime < 5000) {
      return;
    }
  }

  if (user && user.email_confirmed_at) {
    document.body.classList.add('authenticated');
    dropdownEmail.textContent = user.email;
    userAvatar.innerHTML =
      '<span class="material-symbols-outlined">person</span>';

    window.renderBadges?.();

    setTimeout(() => checkPendingInviteFromUrl(), 1000);

    if (profileLoaded && !wordsLoaded) {
      wordsLoaded = true;
      window.authExports?.loadWordsOnce(remoteWords => {
        const localWords = window.words || [];
        const merged = window.mergeWords
          ? window.mergeWords(localWords, remoteWords)
          : remoteWords;
        window.words = merged.map(word =>
          typeof word === 'object'
            ? window.normalizeWord?.(word) || word
            : word,
        );
        localStorage.setItem('englift_words', JSON.stringify(window.words));
        if (window.refreshUI) window.refreshUI();
      });
    }
  } else if (user && !user.email_confirmed_at) {
    // Неподтверждённый email — редирект на страницу входа, где будет показан соответствующий блок
    if (window.location.pathname !== '/login.html') {
      window.location.href = '/login.html';
    }
  } else if (event === 'SIGNED_OUT') {
    const wasExplicit = isExplicitLogoutPending;
    isExplicitLogoutPending = false;

    profileLoaded = false;
    wordsLoaded = false;

    // Сброс данных
    window.clearUserData?.(wasExplicit);

    // Редирект на страницу входа
    if (window.location.pathname !== '/login.html') {
      window.location.href = '/login.html';
    }
  } else {
    // Нет пользователя — редирект
    if (window.location.pathname !== '/login.html') {
      window.location.href = '/login.html';
    }
  }
});

// Обработка инвайта после входа
async function checkPendingInviteFromUrl() {
  const inviteId = new URLSearchParams(location.search).get('invite');
  if (!inviteId || !window.currentUserId) return;

  const cleanUrl = location.origin + location.pathname;
  window.history.replaceState({}, '', cleanUrl);

  try {
    const { data: invite, error } = await supabase
      .from('invites')
      .select('inviter_id, profiles(username)')
      .eq('id', inviteId)
      .maybeSingle();
    if (error || !invite) return;
    if (invite.inviter_id === window.currentUserId) return;

    const { data: existing } = await supabase
      .from('friendships')
      .select('id')
      .or(
        `user_id.eq.${window.currentUserId},friend_id.eq.${window.currentUserId},user_id.eq.${invite.inviter_id},friend_id.eq.${invite.inviter_id}`,
      )
      .maybeSingle();
    if (existing) {
      window.toast?.('Вы уже друзья с этим пользователем 😄', 'warning');
      return;
    }

    const inviterName = invite.profiles?.username || 'Пользователь';
    showInviteConfirmModal(inviterName, invite.inviter_id, inviteId);
  } catch (e) {
    console.warn('checkPendingInviteFromUrl error:', e);
  }
}

function showInviteConfirmModal(inviterName, inviterId, inviteId) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop open';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:380px;text-align:center">
      <div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;margin-bottom:0.75rem">
        <span class="material-symbols-outlined" style="font-size:2rem">person_add</span>
        <span style="font-size:1.2rem;color:var(--text)">Заявка в друзья</span>
      </div>
      <p style="color:var(--muted);margin-bottom:1.5rem">
        <b style="color:var(--text)">${inviterName}</b> хочет добавить тебя в друзья!
      </p>
      <div style="display:flex;gap:0.75rem">
        <button class="btn-pill btn-pill--secondary" style="flex:1" id="invite-accept-btn">
          <span class="material-symbols-outlined">check</span>
          Принять
        </button>
        <button class="btn-pill btn-pill--secondary" style="flex:1" id="invite-decline-btn">
          <span class="material-symbols-outlined">close</span>
          Отклонить
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Блокируем скролл на backdrop
  initModalScrollLock(modal);

  document.getElementById('invite-accept-btn').onclick = async () => {
    await acceptInviteFriendship(inviterId, inviteId);
    modal.remove();
  };

  document.getElementById('invite-decline-btn').onclick = () => {
    modal.remove();
    window.toast?.('Заявка отклонена', 'warning');
  };
}

async function acceptInviteFriendship(inviterId, inviteId) {
  try {
    await supabase.from('friendships').insert([
      {
        user_id: inviterId,
        friend_id: window.currentUserId,
        status: 'accepted',
      },
      {
        user_id: window.currentUserId,
        friend_id: inviterId,
        status: 'accepted',
      },
    ]);
    const { data: inv } = await supabase
      .from('invites')
      .select('uses')
      .eq('id', inviteId)
      .maybeSingle();
    window.toast?.('Вы теперь друзья! 🎉', 'success');
    await loadFriendsDataNew();
  } catch (e) {
    window.toast?.('Ошибка: ' + e.message, 'danger');
  }
}

// Немедленная проверка сессии при загрузке
(async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user && session.user.email_confirmed_at) {
    // Если авторизован но на странице входа - редирект на главную
    if (window.location.pathname === '/login.html') {
      window.location.href = '/';
    } else {
      document.body.classList.add('authenticated');
    }
  } else {
    if (window.location.pathname !== '/login.html') {
      window.location.href = '/login.html';
    }
  }
})();

// Обработчики для меню профиля
let dropdownTimeout = null;

// Определяем мобильное устройство
function isMobile() {
  return window.innerWidth <= 768 || 'ontouchstart' in window;
}

function showDropdown() {
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) {
    clearTimeout(dropdownTimeout);
    dropdown.style.display = 'block';
    dropdown.style.opacity = '1';
    dropdown.style.transform = 'translateY(0)';
  }
}

function hideDropdown() {
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) {
    dropdownTimeout = setTimeout(() => {
      dropdown.style.display = 'none';
    }, 150);
  }
}

// Клик по аватару - toggle меню
userAvatar?.addEventListener('click', e => {
  e.stopPropagation();
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) {
    const isVisible = dropdown.style.display !== 'none';
    if (isMobile()) {
      // На мобильных: первый клик открывает, второй закрывает
      if (isVisible) {
        hideDropdown();
      } else {
        showDropdown();
      }
    } else {
      // На десктопе toggle как обычно
      if (isVisible) {
        hideDropdown();
      } else {
        showDropdown();
      }
    }
  }
});

// Для десктопа: наведение на аватар - показать меню
if (!isMobile()) {
  userAvatar?.addEventListener('mouseenter', showDropdown);

  // Уход с аватара - скрыть меню с задержкой
  userAvatar?.addEventListener('mouseleave', hideDropdown);

  // Наведение на меню - отменить скрытие
  const userDropdown = document.getElementById('user-dropdown');
  userDropdown?.addEventListener('mouseenter', () => {
    clearTimeout(dropdownTimeout);
  });

  // Уход с меню - скрыть
  userDropdown?.addEventListener('mouseleave', hideDropdown);
}

// Клик вне меню - скрыть
document.addEventListener('click', e => {
  const dropdown = document.getElementById('user-dropdown');
  if (
    dropdown &&
    !userAvatar.contains(e.target) &&
    !dropdown.contains(e.target)
  ) {
    dropdown.style.display = 'none';
  }
});

// Для мобильных: скролл - скрыть меню
if (isMobile()) {
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown && dropdown.style.display !== 'none') {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        dropdown.style.display = 'none';
      }, 100);
    }
  });
}

// Обработчик запуска тура
document
  .getElementById('dropdown-start-tour')
  ?.addEventListener('click', () => {
    if (window.startTour) {
      window.startTour();
    }
  });

// Обработчик выхода
dropdownLogout?.addEventListener('click', async () => {
  isExplicitLogoutPending = true;

  // Синхронизируем данные перед выходом
  try {
    await window.syncSaveProfile?.();
    await window.syncPendingWords?.();
    await window.syncPendingIdioms?.();
  } catch (e) {
    console.error('Ошибка синхронизации при выходе:', e);
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Ошибка выхода:', error);
    window.toast?.('Ошибка выхода', 'danger');
  } else {
    window.toast?.('Вы вышли из аккаунта', 'success');
    window.location.href = '/login.html';
  }
});

// Делаем loadUserProfile глобальной
window.loadUserProfile = loadUserProfile;
