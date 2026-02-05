/* script.js - all behavior for both pages
   We store everything in localStorage under the key 'todoApp'
   Data shape:
   {
     title: string,
     tasks: [{id, text, completed (bool), createdAt (YYYY-MM-DD), completedAt (YYYY-MM-DD or null)}],
     theme: 'light' | 'dark'
   }
*/

const STORAGE_KEY = 'todoApp';

/* -------- Utility helpers -------- */
function todayKey(date = new Date()){
  // Return YYYY-MM-DD string for easy comparisons
  return date.toISOString().slice(0,10);
}
function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { title: '', tasks: [], theme: 'light' };
  try { return JSON.parse(raw); } catch { return { title:'', tasks:[], theme:'light'}; }
}
function saveState(state){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// small utility: escape HTML to avoid injection when injecting user text into DOM
function escapeHtml(s){ return (s+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* -------- Theme management (shared) -------- */
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  const state = loadState();
  state.theme = theme;
  saveState(state);

  // Update theme icons (sun for light, moon for dark)
  const sunPaths = '<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
  const moonPaths = '<path fill="currentColor" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  const themeIcon = document.getElementById('themeIcon');
  const themeIconCal = document.getElementById('themeIconCal');
  if (themeIcon) themeIcon.innerHTML = theme === 'dark' ? moonPaths : sunPaths;
  if (themeIconCal) themeIconCal.innerHTML = theme === 'dark' ? moonPaths : sunPaths;
}
function toggleTheme(){
  const s = loadState();
  const next = s.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

/* Realtime date/time updater */
let dtInterval = null;
// Ensure calendar listeners only initialized once to avoid duplicate handlers
let calendarListenersInitialized = false;
function updateDateTime(){
  const el = document.getElementById('dateTime');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function startDateTime(){
  updateDateTime();
  if (dtInterval) clearInterval(dtInterval);
  dtInterval = setInterval(updateDateTime, 1000);
}

/* -------- Main To-Do page logic -------- */
function initTodos(){
  const state = loadState();
  // Elements
  const listTitle = document.getElementById('listTitle');
  const titleForm = document.getElementById('titleForm');
  const taskForm = document.getElementById('taskForm');
  const taskInput = document.getElementById('taskInput');
  const taskList = document.getElementById('taskList');
  const taskCount = document.getElementById('taskCount');
  const progressBar = document.getElementById('progressBar');
  const quoteEl = document.getElementById('quote');

  // load saved title
  listTitle.value = state.title || '';

  function render(){
    // clear list
    taskList.innerHTML = '';
    const tasks = state.tasks || [];
    // create DOM items
    tasks.forEach(task => {
      const li = document.createElement('li');
      li.className = 'task';
      li.innerHTML = `
        <label>
          <div class="checkbox ${task.completed ? 'checked' : ''}" data-id="${task.id}">${task.completed ? '✓' : ''}</div>
          <div class="text ${task.completed ? 'completed' : ''}">${escapeHtml(task.text)}</div>
        </label>
        <button class="delete" data-id="${task.id}" title="Delete">🗑</button>
      `;
      taskList.appendChild(li);
    });
    taskCount.textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;

    // progress bar: percentage of tasks completed
    const completed = tasks.filter(t => t.completed).length;
    const pct = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
    progressBar.style.width = pct + '%';

    // Example motivational quote (could randomize)
    quoteEl.textContent = '“Small steps every day add up to big wins.”';
  }

  // simple HTML-escape for safety
  function escapeHtml(s){ return (s+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // events: save title
  titleForm.addEventListener('submit', e => {
    e.preventDefault();
    state.title = listTitle.value.trim();
    saveState(state);
    alert('List title saved'); // friendly feedback
  });

  // add new task
  taskForm.addEventListener('submit', e => {
    e.preventDefault();
    const text = taskInput.value.trim();
    if (!text) return;
    const newTask = {
      id: Date.now().toString(),
      text,
      completed: false,
      createdAt: todayKey(),
      completedAt: null
    };
    state.tasks.unshift(newTask); // newest first
    saveState(state);
    taskInput.value = '';
    render();
  });

  // delegate clicks for checkbox toggle and delete
  taskList.addEventListener('click', e => {
    const id = e.target.dataset.id;
    if (!id) return;
    if (e.target.classList.contains('delete')) {
      // delete
      state.tasks = state.tasks.filter(t => t.id !== id);
      saveState(state);
      render();
      return;
    }
    if (e.target.classList.contains('checkbox')) {
      // toggle complete
      const t = state.tasks.find(t => t.id === id);
      if (!t) return;
      t.completed = !t.completed;
      t.completedAt = t.completed ? todayKey() : null;
      saveState(state);
      render();
      return;
    }
  });

  // theme toggle
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Apply theme from saved state
  applyTheme(state.theme || 'light');

  // initial render
  render();
}

/* -------- Calendar page logic -------- */
function initCalendar(){
  const state = loadState();
  const yearGrid = document.getElementById('yearGrid');
  const daysConsistentEl = document.getElementById('daysConsistent');
  const currentStreakEl = document.getElementById('currentStreak');
  const longestStreakEl = document.getElementById('longestStreak');

  // Build a set of dates (YYYY-MM-DD) where at least one completed task exists
  const doneDates = new Set(state.tasks.filter(t => t.completedAt).map(t => t.completedAt));

  // Stats calculations
  const daysConsistent = doneDates.size;
  daysConsistentEl.textContent = daysConsistent;

  // compute streaks for the current year
  const year = new Date().getFullYear();
  // helper to check if a date exists in doneDates
  function isDone(dateObj){
    return doneDates.has(dateObj.toISOString().slice(0,10));
  }

  // current streak (including today if done)
  let streak = 0;
  let d = new Date(); // today
  while(isDone(d)){
    streak++; d.setDate(d.getDate() - 1);
  }
  currentStreakEl.textContent = streak;

  // longest streak in year: iterate days and count sequences
  let longest = 0;
  let temp = 0;
  const start = new Date(year,0,1);
  const end = new Date(year,11,31);
  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)){
    if (isDone(dt)) { temp++; if (temp > longest) longest = temp; }
    else { temp = 0; }
  }
  longestStreakEl.textContent = longest;

  // Render months (3 columns x 4 rows)
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  yearGrid.innerHTML = '';

  for (let m = 0; m < 12; m++){
    const monthEl = document.createElement('div');
    monthEl.className = 'month';
    monthEl.innerHTML = `<h4>${monthNames[m]}</h4><div class="month-grid"></div>`;
    const grid = monthEl.querySelector('.month-grid');

    // day labels (we'll show 1..n with blank placeholders at start to align weekdays)
    const first = new Date(year, m, 1);
    const startDay = first.getDay(); // 0=Sunday .. 6=Saturday
    const daysInMonth = new Date(year, m+1, 0).getDate();

    // Add blank placeholders for alignment
    for (let i=0;i<startDay;i++){
      const blank = document.createElement('div');
      blank.className = 'day';
      blank.textContent = '';
      grid.appendChild(blank);
    }

    // Add day squares
    for (let d = 1; d <= daysInMonth; d++){
      const dateObj = new Date(year, m, d);
      const dayEl = document.createElement('div');
      dayEl.className = 'day';
      const key = dateObj.toISOString().slice(0,10);
      if (doneDates.has(key)) {
        dayEl.classList.add('done');
      }
      // highlight today's date
      if (key === todayKey()) dayEl.classList.add('today');
      dayEl.textContent = d;
      // make each day keyboard-focusable & accessible and store full date key
      dayEl.dataset.date = key;
      dayEl.setAttribute('role', 'button');
      dayEl.tabIndex = 0;
      grid.appendChild(dayEl);
    }

    yearGrid.appendChild(monthEl);
  }

  // Make days interactive: open modal on click or Enter/Space
  if (!calendarListenersInitialized) {
    yearGrid.addEventListener('click', (e) => {
      const day = e.target.closest('.day');
      if (!day || !day.dataset.date || !day.textContent.trim()) return;
      openDateModal(day.dataset.date);
    });
    yearGrid.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const day = e.target.closest('.day');
        if (!day || !day.dataset.date || !day.textContent.trim()) return;
        e.preventDefault();
        openDateModal(day.dataset.date);
      }
    });

    const modal = document.getElementById('dateModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    const closeModalBtn = document.getElementById('closeModal');
    let currentModalDate = null;

    function openDateModal(dateKey){
      currentModalDate = dateKey;
      const state = loadState();
      const tasks = state.tasks.filter(t => t.createdAt === dateKey || t.completedAt === dateKey);
      modalTitle.textContent = new Date(dateKey).toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric', year:'numeric' });
      if (!tasks.length) {
        modalContent.innerHTML = '<p class="muted">No tasks for this day.</p>';
      } else {
        modalContent.innerHTML = '<ul class="modal-task-list">' + tasks.map(t => `<li class="modal-task" data-id="${t.id}"><label><input type="checkbox" class="modal-checkbox" data-id="${t.id}" ${t.completed ? 'checked' : ''}> <span class="${t.completed ? 'completed' : ''}">${escapeHtml(t.text)}</span></label> <button class="modal-delete" data-id="${t.id}" aria-label="Delete task">Delete</button></li>`).join('') + '</ul>';
      }
      modal.setAttribute('aria-hidden','false');
      modal.classList.add('open');
      // focus close button for accessibility
      closeModalBtn?.focus();
    }

    function closeModal(){
      modal.setAttribute('aria-hidden','true');
      modal.classList.remove('open');
      currentModalDate = null;
    }

    // modal interactions
    modal.addEventListener('click', (e) => {
      if (e.target.dataset.close === 'true' || e.target.id === 'closeModal') { closeModal(); return; }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });

    modalContent?.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      if (!id) return;
      const state = loadState();
      if (e.target.classList.contains('modal-delete')) {
        state.tasks = state.tasks.filter(t => t.id !== id);
        saveState(state);
        openDateModal(currentModalDate);
        initCalendar();
        return;
      }
      if (e.target.classList.contains('modal-checkbox')) {
        const t = state.tasks.find(t => t.id === id);
        if (!t) return;
        t.completed = e.target.checked;
        t.completedAt = t.completed ? (todayKey()) : null;
        saveState(state);
        openDateModal(currentModalDate);
        initCalendar();
        return;
      }
    });

    closeModalBtn?.addEventListener('click', closeModal);
    // click backdrop
    modal.querySelector('.modal-backdrop')?.addEventListener('click', closeModal);

    calendarListenersInitialized = true;
  }

  // theme toggle button on calendar page
  const themeBtn = document.getElementById('themeToggleCal');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Apply theme from saved state
  applyTheme(state.theme || 'light');
}

/* -------- Initialize the right behavior based on page ---- */
document.addEventListener('DOMContentLoaded', () => {
  // Start realtime date/time
  startDateTime();
  // Decide which page we are on by checking elements
  if (document.getElementById('taskList')) {
    initTodos();
  }
  if (document.getElementById('yearGrid')) {
    initCalendar();
  }
});