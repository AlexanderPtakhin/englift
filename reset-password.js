import { createClient } from '@supabase/supabase-js';

// Прямой клиент Supabase для обработки сброса пароля (чтобы токен от прямого домена работал)
const supabase = createClient(
  'https://mlkrswxakzpbbzwtvzeh.supabase.co',
  'sb_publishable_sX7-Yj4LLnQweRdf3txECA_7GUrRsNu'
);

// Функция тоста
function toast(msg, type = '', icon = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  if (icon) {
    el.innerHTML = `<span class="material-symbols-outlined" style="font-size: 1.2em; vertical-align: middle; margin-right: 8px;">${icon}</span>${msg}`;
  } else {
    el.textContent = msg;
  }
  const toastBox = document.getElementById('toast-box');
  if (!toastBox) return;
  toastBox.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 320);
  }, 4000);
}

// Инициализация темы на основе системных настроек
function initResetTheme() {
  const saved = JSON.parse(localStorage.getItem('englift_user_settings') || '{}');
  // Если пользователь выбирал тему вручную, используем её, иначе системную
  const dark = saved._themeManuallySet ? saved.dark : window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
  // Инициализируем тему перед всем остальным
  initResetTheme();
  // DOM элементы
  const resetForm = document.getElementById('reset-password-form');
  const newPassword = document.getElementById('reset-new-password');
  const confirmPassword = document.getElementById('reset-confirm-password');
  const errorEl = document.getElementById('reset-error');
  const successEl = document.getElementById('reset-success');
  const submitBtn = document.getElementById('reset-submit-btn');

  if (!resetForm || !newPassword || !confirmPassword || !errorEl || !successEl || !submitBtn) {
    console.error('Required DOM elements not found');
    return;
  }

  // Глазики для паролей
  document.addEventListener('click', e => {
    const passwordToggle = e.target.closest('.password-toggle');
    if (passwordToggle) {
      const inputId = passwordToggle.id.replace('-toggle', '');
      const passwordInput = document.getElementById(inputId);
      if (passwordInput) {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        const icon = passwordToggle.querySelector('.material-symbols-outlined');
        icon.textContent = type === 'password' ? 'visibility' : 'visibility_off';
      }
    }
  });

  // Обработчик отправки формы
  if (resetForm) {
    resetForm.addEventListener('submit', async e => {
      e.preventDefault();
    
      const newPass = newPassword.value;
      const confirmPass = confirmPassword.value;
      
      if (newPass !== confirmPass) {
        errorEl.textContent = 'Пароли не совпадают';
        successEl.textContent = '';
        return;
      }
      
      if (newPass.length < 8) {
        errorEl.textContent = 'Пароль должен быть минимум 8 символов';
        successEl.textContent = '';
        return;
      }
      
      errorEl.textContent = '';
      successEl.textContent = '';
      
      submitBtn.disabled = true;
      submitBtn.textContent = '...';
      
      try {
        // Проверяем текущую сессию
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;
        
        if (!session) {
          throw new Error('Сессия не найдена. Возможно, ссылка устарела. Запросите новый сброс пароля.');
        }
        
        // Обновляем пароль
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPass
        });
        
        if (updateError) throw updateError;
        
        successEl.textContent = 'Пароль успешно изменён! Перенаправляем на страницу входа...';
        toast('Пароль успешно изменён!', 'success', 'check');
        
        // Ждём немного и редиректим
        setTimeout(() => {
          window.location.href = '/login.html';
        }, 2000);
        
      } catch (err) {
        errorEl.textContent = err.message || 'Ошибка при смене пароля';
        successEl.textContent = '';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined" style="margin-right: 8px">check</span>Сохранить пароль';
      }
    });
  }

  // Enter в полях ввода
  if (newPassword) {
    newPassword.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmPassword.focus();
      }
    });
  }

  if (confirmPassword) {
    confirmPassword.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        resetForm.dispatchEvent(new Event('submit'));
      }
    });
  }

  // Убираем loading класс
  document.body.classList.remove('loading');
});
