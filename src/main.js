import './style.css';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db, isConfigured } from './firebase.js';

const START = '2026-10-01';
const END = '2027-01-15';
const appEl = document.querySelector('#app');

let currentUser = null;
let currentMonth = new Date(2026, 9, 1);
let selectedDate = '2026-10-11';
let tasks = [];
let unsubscribeTasks = null;
let authMode = 'login';
let notificationTimer = null;

const isWithinRange = (date) => date >= START && date <= END;
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const prettyDate = (key, options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) =>
  new Date(`${key}T12:00:00`).toLocaleDateString(undefined, options);
const monthTitle = (d) => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const tasksFor = (date) => tasks.filter(t => t.date === date);
const isOverdue = (t) => !t.completed && t.date < dateKey(new Date());
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

function render() {
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const firstWeekday = (monthStart.getDay() + 6) % 7; // Monday first
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= monthEnd.getDate(); day++) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const key = dateKey(date);
    if (key >= START && key <= END) cells.push(key);
    else cells.push({ outside: true, day });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const dayHeaders = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const completedCount = tasks.filter(t => t.completed).length;
  const overdueCount = tasks.filter(isOverdue).length;
  const totalCount = tasks.length;
  const today = dateKey(new Date());

  appEl.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="brand-lockup">
          <div class="brand-mark">DZ</div>
          <div><div class="brand-name">DAYZERO</div><div class="brand-sub">YOUR DAYS. YOUR CALL.</div></div>
        </div>
        <div class="account-area">
          ${currentUser ? `<span class="user-email">${escapeHtml(currentUser.email || 'Signed in')}</span><button class="quiet-btn" id="signout">Sign out</button>` : ''}
          <span class="sync-state ${currentUser ? 'online' : ''}"><i></i>${currentUser ? 'SYNC ENABLED' : 'LOCAL PREVIEW'}</span>
        </div>
      </header>

      ${!isConfigured ? `
        <section class="setup-banner">
          <strong>Firebase setup required</strong>
          <span>Add your Firebase web app values in <code>src/firebase-config.js</code> and enable Email/Password Authentication + Firestore.</span>
        </section>` : ''}

      ${isConfigured && !currentUser ? authPanel() : ''}

      <section class="hero">
        <div>
          <div class="eyebrow">THE PLAN IS THE PLAN</div>
          <h1>Make the days <span>count.</span></h1>
          <p class="hero-copy">A focused calendar from October 2026 to January 15, 2027.</p>
        </div>
        <div class="stats">
          <div class="stat"><span class="stat-label">TOTAL TASKS</span><strong>${totalCount}</strong></div>
          <div class="stat"><span class="stat-label">COMPLETED</span><strong>${completedCount}</strong></div>
          <div class="stat"><span class="stat-label">OVERDUE</span><strong class="${overdueCount ? 'danger-text' : ''}">${overdueCount}</strong></div>
        </div>
      </section>

      <main class="layout">
        <section class="calendar-card">
          <div class="calendar-heading">
            <div><div class="eyebrow">YOUR TIMELINE</div><h2>${monthTitle(currentMonth)}</h2></div>
            <div class="month-controls">
              <button class="icon-btn" id="prev-month" aria-label="Previous month" ${currentMonth.getFullYear() === 2026 && currentMonth.getMonth() === 9 ? 'disabled' : ''}>‹</button>
              <button class="icon-btn" id="next-month" aria-label="Next month" ${currentMonth.getFullYear() === 2027 && currentMonth.getMonth() === 0 ? 'disabled' : ''}>›</button>
            </div>
          </div>
          <div class="weekday-row">${dayHeaders.map(d => `<div>${d}</div>`).join('')}</div>
          <div class="calendar-grid">
            ${cells.map((cell) => {
              if (!cell) return '<div class="day-cell empty"></div>';
              if (typeof cell === 'object') return `<div class="day-cell outside"><span>${cell.day}</span></div>`;
              const dayTasks = tasksFor(cell);
              const done = dayTasks.filter(t => t.completed).length;
              const pending = dayTasks.some(t => !t.completed);
              const overdue = dayTasks.some(isOverdue);
              const classes = [
                'day-cell',
                cell === selectedDate ? 'selected' : '',
                cell === today ? 'today' : '',
                dayTasks.length ? 'has-tasks' : '',
                overdue ? 'has-overdue' : '',
                cell < START || cell > END ? 'outside' : ''
              ].filter(Boolean).join(' ');
              return `<button class="${classes}" data-date="${cell}" ${isWithinRange(cell) ? '' : 'disabled'}>
                <span class="day-number">${Number(cell.slice(-2))}</span>
                ${dayTasks.length ? `<span class="task-count">${done}/${dayTasks.length}</span>` : ''}
                ${pending ? '<span class="day-dot"></span>' : ''}
              </button>`;
            }).join('')}
          </div>
          <div class="calendar-legend"><span><i class="legend-dot pending"></i> Pending</span><span><i class="legend-dot done"></i> Completed</span><span><i class="legend-dot overdue"></i> Overdue</span></div>
        </section>

        <aside class="tasks-card">
          <div class="task-panel-heading">
            <div><div class="eyebrow">DAILY BRIEF</div><h2>${prettyDate(selectedDate, { weekday: 'short', month: 'short', day: 'numeric' })}</h2></div>
            <div class="day-progress">${tasksFor(selectedDate).filter(t => t.completed).length}/${tasksFor(selectedDate).length}</div>
          </div>
          <div class="selected-date-full">${prettyDate(selectedDate)}</div>
          <form id="add-task-form" class="add-task-form">
            <input id="task-input" type="text" maxlength="180" placeholder="Add a task for this day…" autocomplete="off" required />
            <button type="submit" aria-label="Add task">+</button>
          </form>
          <div class="task-list" id="task-list">
            ${renderTaskList()}
          </div>
          <div class="task-footer">
            <span>${tasksFor(selectedDate).filter(t => !t.completed).length} remaining</span>
            <button id="daily-notify" class="quiet-btn">Remind me today</button>
          </div>
        </aside>
      </main>

      <section class="overdue-strip">
        <div><div class="eyebrow">CARRY FORWARD</div><h3>Unfinished from previous days</h3></div>
        <span class="overdue-total">${overdueCount} OPEN</span>
        <div class="overdue-list">${renderOverdue()}</div>
      </section>
      <footer><span>DAYZERO / 2026—2027</span><span>Changes save automatically when signed in.</span></footer>
    </div>
  `;

  wireEvents();
}

function authPanel() {
  return `<section class="auth-card">
    <div><div class="eyebrow">CROSS-DEVICE SYNC</div><h2>${authMode === 'login' ? 'Sign in to sync' : 'Create your account'}</h2>
    <p>Use the same account on your PC and phone to share tasks.</p></div>
    <form id="auth-form">
      <input id="auth-email" type="email" placeholder="Email address" autocomplete="email" required />
      <input id="auth-password" type="password" placeholder="Password (6+ characters)" minlength="6" autocomplete="${authMode === 'login' ? 'current-password' : 'new-password'}" required />
      <button type="submit" class="primary-btn">${authMode === 'login' ? 'Sign in' : 'Create account'}</button>
      <button type="button" class="text-btn" id="toggle-auth">${authMode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button>
      <div id="auth-error" class="form-error" role="status"></div>
    </form>
  </section>`;
}

function renderTaskList() {
  const dayTasks = tasksFor(selectedDate);
  if (!dayTasks.length) return `<div class="empty-tasks"><div class="empty-icon">—</div><strong>Nothing scheduled.</strong><span>Add a task above and make today count.</span></div>`;
  return dayTasks.map(t => `<div class="task-row ${t.completed ? 'completed' : ''}" data-task="${t.id}">
    <label class="check-wrap"><input type="checkbox" data-toggle="${t.id}" ${t.completed ? 'checked' : ''} aria-label="Mark ${escapeHtml(t.title)} complete"><span class="custom-check"></span></label>
    <span class="task-title">${escapeHtml(t.title)}</span>
    <button class="delete-task" data-delete="${t.id}" aria-label="Delete task">×</button>
  </div>`).join('');
}

function renderOverdue() {
  const overdue = tasks.filter(isOverdue).sort((a, b) => a.date.localeCompare(b.date));
  if (!overdue.length) return `<div class="no-overdue">You're clear. No unfinished tasks from previous days.</div>`;
  return overdue.slice(0, 12).map(t => `<div class="overdue-item">
    <label class="check-wrap"><input type="checkbox" data-toggle="${t.id}" aria-label="Complete overdue task ${escapeHtml(t.title)}"><span class="custom-check"></span></label>
    <div class="overdue-text"><span>${escapeHtml(t.title)}</span><small>${prettyDate(t.date, { month: 'short', day: 'numeric' })}</small></div>
    <button class="jump-date" data-jump="${t.date}">OPEN DAY ↗</button>
  </div>`).join('') + (overdue.length > 12 ? `<div class="more-overdue">+ ${overdue.length - 12} more overdue tasks</div>` : '');
}

function wireEvents() {
  document.querySelector('#prev-month')?.addEventListener('click', () => changeMonth(-1));
  document.querySelector('#next-month')?.addEventListener('click', () => changeMonth(1));
  document.querySelectorAll('[data-date]').forEach(el => el.addEventListener('click', () => {
    selectedDate = el.dataset.date;
    render();
  }));
  document.querySelector('#add-task-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.querySelector('#task-input');
    const title = input.value.trim();
    if (!title) return;
    try {
      await createTask(selectedDate, title);
      input.value = '';
    } catch (err) { showToast(`Couldn't save task: ${err.message}`); }
  });
  document.querySelectorAll('[data-toggle]').forEach(el => el.addEventListener('change', async () => {
    const task = tasks.find(t => t.id === el.dataset.toggle);
    if (task) {
      try { await updateTask(task.id, { completed: el.checked }); }
      catch (err) { showToast(`Couldn't update task: ${err.message}`); }
    }
  }));
  document.querySelectorAll('[data-delete]').forEach(el => el.addEventListener('click', async () => {
    try { await removeTask(el.dataset.delete); }
    catch (err) { showToast(`Couldn't delete task: ${err.message}`); }
  }));
  document.querySelectorAll('[data-jump]').forEach(el => el.addEventListener('click', () => {
    selectedDate = el.dataset.jump;
    currentMonth = new Date(Number(selectedDate.slice(0, 4)), Number(selectedDate.slice(5, 7)) - 1, 1);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  document.querySelector('#toggle-auth')?.addEventListener('click', () => {
    authMode = authMode === 'login' ? 'register' : 'login';
    render();
  });
  document.querySelector('#auth-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.querySelector('#auth-email').value.trim();
    const password = document.querySelector('#auth-password').value;
    const errorEl = document.querySelector('#auth-error');
    try {
      if (authMode === 'login') await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      errorEl.textContent = friendlyAuthError(err.code);
    }
  });
  document.querySelector('#signout')?.addEventListener('click', async () => {
    if (auth) await signOut(auth);
  });
  document.querySelector('#daily-notify')?.addEventListener('click', requestDailyReminder);
}

function friendlyAuthError(code) {
  const messages = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Choose a password with at least 6 characters.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/network-request-failed': 'Network error. Check your internet connection.'
  };
  return messages[code] || `Sign-in failed (${code || 'unknown error'}). Check Firebase Authentication setup.`;
}

function changeMonth(delta) {
  const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1);
  const min = new Date(2026, 9, 1);
  const max = new Date(2027, 0, 1);
  if (next < min || next > max) return;
  currentMonth = next;
  const monthDate = new Date(selectedDate + 'T12:00:00');
  if (monthDate.getMonth() !== next.getMonth() || monthDate.getFullYear() !== next.getFullYear()) {
    selectedDate = dateKey(next);
    if (!isWithinRange(selectedDate)) selectedDate = next.getFullYear() === 2027 ? '2027-01-15' : dateKey(next);
  }
  render();
}

async function createTask(date, title) {
  const task = { id: crypto.randomUUID(), date, title, completed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  if (currentUser && db) {
    await addDoc(collection(db, 'users', currentUser.uid, 'tasks'), {
      date, title, completed: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  } else {
    tasks.push(task);
    saveLocal();
    render();
  }
}

async function updateTask(id, changes) {
  if (currentUser && db) {
    await updateDoc(doc(db, 'users', currentUser.uid, 'tasks', id), { ...changes, updatedAt: serverTimestamp() });
  } else {
    tasks = tasks.map(t => t.id === id ? { ...t, ...changes, updatedAt: new Date().toISOString() } : t);
    saveLocal();
    render();
  }
}

async function removeTask(id) {
  if (currentUser && db) {
    await deleteDoc(doc(db, 'users', currentUser.uid, 'tasks', id));
  } else {
    tasks = tasks.filter(t => t.id !== id);
    saveLocal();
    render();
  }
}

function saveLocal() {
  try { localStorage.setItem('dayzero-local-tasks', JSON.stringify(tasks)); } catch {}
}

function loadLocal() {
  try { tasks = JSON.parse(localStorage.getItem('dayzero-local-tasks') || '[]'); } catch { tasks = []; }
}

function startTaskSync(user) {
  if (unsubscribeTasks) unsubscribeTasks();
  if (!user || !db) {
    loadLocal();
    render();
    return;
  }
  unsubscribeTasks = onSnapshot(
    query(collection(db, 'users', user.uid, 'tasks'), orderBy('date', 'asc')),
    (snapshot) => {
      tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
      scheduleDailyReminder();
    },
    (error) => {
      console.error(error);
      showToast('Sync error. Check your Firestore rules and connection.');
    }
  );
}

async function requestDailyReminder() {
  const granted = await requestNotificationPermission();
  if (!granted) {
    showToast('Allow notifications in device settings to receive reminders.');
    return;
  }
  await notifyNow();
  scheduleDailyReminder();
  showToast('Reminder preview sent. Daily reminder is scheduled while supported by the device.');
}

async function requestNotificationPermission() {
  try {
    if (Capacitor.isNativePlatform()) {
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
      return perm.display === 'granted';
    }
    if (window.dayzeroDesktop) return true;
    if ('Notification' in window) {
      if (Notification.permission === 'granted') return true;
      return (await Notification.requestPermission()) === 'granted';
    }
  } catch (e) { console.warn(e); }
  return false;
}

async function sendNotification(title, body, id = 1001) {
  try {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [{ id, title, body, schedule: { at: new Date(Date.now() + 1500) }, smallIcon: 'ic_stat_icon_config_sample' }]
      });
    } else if (window.dayzeroDesktop) {
      await window.dayzeroDesktop.notify({ title, body });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch (e) { console.warn('Notification failed', e); }
}

async function notifyNow() {
  const today = dateKey(new Date());
  const todays = tasks.filter(t => t.date === today && !t.completed);
  const overdue = tasks.filter(isOverdue);
  const lines = [];
  if (todays.length) lines.push(`Today: ${todays.slice(0, 4).map(t => t.title).join(', ')}`);
  else lines.push('No pending tasks scheduled for today.');
  if (overdue.length) lines.push(`${overdue.length} unfinished task(s) from previous days.`);
  await sendNotification('DayZero — Daily Briefing', lines.join(' '), 1001);
}

function scheduleDailyReminder() {
  if (notificationTimer) clearTimeout(notificationTimer);
  // Schedule the next 07:00 reminder while this app is running. A reminder is also
  // refreshed whenever task data syncs. Native background scheduling can be extended later.
  const now = new Date();
  const next = new Date();
  next.setHours(7, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  notificationTimer = setTimeout(async () => {
    await notifyNow();
    scheduleDailyReminder();
  }, next.getTime() - now.getTime());
}

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3200);
}

function initAuth() {
  if (!isConfigured) {
    loadLocal();
    render();
    return;
  }
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    startTaskSync(user);
  });
}

if (!isConfigured) {
  loadLocal();
  render();
} else {
  render();
  initAuth();
}
