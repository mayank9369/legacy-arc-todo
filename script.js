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
  // Return local YYYY-MM-DD string for easy comparisons (avoid UTC shift)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function formatLocalDate(date){
  const dt = (date instanceof Date) ? date : new Date(date);
  if (isNaN(dt)) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { appTitle: 'Legacy Arc', title: '', tasks: [], theme: 'light' };
  try { return JSON.parse(raw); } catch { return { appTitle: 'Legacy Arc', title:'', tasks:[], theme:'light'}; }
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

// shorten the date shown in the nav bar (no seconds, compact)
function updateDateTime(){
  const el = document.getElementById('dateTime');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* -------- Main To-Do page logic -------- */
function initTodos(){
  const state = loadState();
  // Normalize any older ISO date strings in tasks to local YYYY-MM-DD
  try {
    (state.tasks || []).forEach(t => {
      if (t.createdAt && t.createdAt.includes('T')) t.createdAt = formatLocalDate(new Date(t.createdAt));
      if (t.completedAt && t.completedAt.includes('T')) t.completedAt = formatLocalDate(new Date(t.completedAt));
    });
  } catch(e){}
  // Elements
  const listTitle = document.getElementById('listTitle');
  const titleForm = document.getElementById('titleForm');
  const taskForm = document.getElementById('taskForm');
  const taskInput = document.getElementById('taskInput');
  const taskList = document.getElementById('taskList');
  const taskCount = document.getElementById('taskCount');
  const progressBar = document.getElementById('progressBar');
  const quoteEl = document.getElementById('quote');
  const appTitle = document.getElementById('appTitle');

  // load saved title
  listTitle.value = state.title || '';
  if (appTitle) appTitle.textContent = state.appTitle || 'Legacy Arc';

  function render(){
    // clear list and only show tasks created for today (daily tasks reset at midnight)
    taskList.innerHTML = '';
    const tasks = (state.tasks || []).filter(t => t.createdAt === todayKey());
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

    // progress bar: percentage of today's tasks completed with percentage display and counter
    const completed = tasks.filter(t => t.completed).length;
    const pct = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
    progressBar.style.width = pct + '%';
    
    // update percentage text and counter
    const progressPercent = document.getElementById('progressPercent');
    const progressCounter = document.getElementById('progressCounter');
    if (progressPercent) progressPercent.textContent = pct + '%';
    if (progressCounter) progressCounter.textContent = `${completed}/${tasks.length}`;

    // add celebration animation when progress reaches 100%
    if (pct === 100 && tasks.length > 0) {
      progressBar.classList.add('complete');
      setTimeout(() => progressBar.classList.remove('complete'), 1200);
    }

    // show "Save Day" button if all tasks are completed and there is at least one task
    const saveDayBtn = document.getElementById('saveDayBtn');
    if (saveDayBtn && tasks.length > 0 && completed === tasks.length) {
      saveDayBtn.style.display = '';
    } else if (saveDayBtn) {
      saveDayBtn.style.display = 'none';
    }
  }

  // schedule a refresh at local midnight so today's list clears automatically
  function scheduleMidnightRefresh(){
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const ms = tomorrow.getTime() - now.getTime() + 50; // a small offset
    setTimeout(()=>{
      // re-render so tasks not from today disappear after 11:59:59
      render();
      // also re-run calendar to update stats if user is on calendar page
      if (document.getElementById('yearGrid')) initCalendar();
      scheduleMidnightRefresh();
    }, ms);
  }

  // simple HTML-escape for safety
  function escapeHtml(s){ return (s+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // events: save title (show small toast "Saved"); hide save button until input changes
  const titleSaveBtn = titleForm.querySelector('button[type="submit"]');
  let toastTimer = null;
  
  // initial visibility of the Save Title button: hide if the loaded value equals saved state
  if (titleSaveBtn) {
    const current = (listTitle.value || '').trim();
    if (current !== (state.title || '')) {
      titleSaveBtn.style.display = '';
      titleSaveBtn.removeAttribute('aria-hidden');
    } else {
      titleSaveBtn.style.display = 'none';
      titleSaveBtn.setAttribute('aria-hidden','true');
    }
  }

  titleForm.addEventListener('submit', e => {
    e.preventDefault();
    e.stopPropagation();

    state.title = listTitle.value.trim();
    saveState(state);

    // show toast at top center
    showToast('Saved');

    // hide the save button from view until input changes
    if (titleSaveBtn) {
      titleSaveBtn.style.display = 'none';
      titleSaveBtn.setAttribute('aria-hidden','true');
    }
  });

  // show save button again when user edits the title (and the value differs from saved state)
  listTitle.addEventListener('input', () => {
    const current = listTitle.value.trim();
    if (!titleSaveBtn) return;
    if (current !== state.title) {
      titleSaveBtn.style.display = '';
      titleSaveBtn.removeAttribute('aria-hidden');
      titleSaveBtn.disabled = false;
    } else {
      titleSaveBtn.style.display = 'none';
      titleSaveBtn.setAttribute('aria-hidden','true');
    }
  });

  // simple toast utility — ensures single toast shown and ARIA live is updated
  function showToast(message = 'Saved', duration = 1400){
    const t = document.getElementById('toast');
    if (!t) return;
    // clear any existing timer
    if (toastTimer) clearTimeout(toastTimer);
    t.textContent = message;
    t.classList.add('visible');
    // update aria-live politely
    t.setAttribute('aria-hidden','false');
    toastTimer = setTimeout(()=>{
      t.classList.remove('visible');
      t.setAttribute('aria-hidden','true');
      toastTimer = null;
    }, duration);
  }

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
      // Don't set completedAt here - only set it when Save Day button is clicked
      saveState(state);
      render();
      return;
    }
  });

  // theme toggle
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Make app title editable - click to edit
  function setupAppTitleEditor() {
    const appTitle = document.getElementById('appTitle');
    if (!appTitle) return;
    
    appTitle.addEventListener('click', () => {
      const currentTitle = state.appTitle || 'Legacy Arc';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentTitle;
      input.className = 'app-title-edit';
      input.style.cssText = 'font-size: 1.2rem; letter-spacing: 0.6px; padding: 6px 10px; border: 2px solid #00ffff; border-radius: 8px; background: rgba(0,255,136,0.1); color: white; font-weight: inherit; font-family: inherit;';
      
      appTitle.replaceWith(input);
      input.focus();
      input.select();

      const saveTitle = () => {
        const newTitle = input.value.trim() || 'Legacy Arc';
        state.appTitle = newTitle;
        saveState(state);
        
        const newTitle_elem = document.createElement('h1');
        newTitle_elem.className = 'app-title';
        newTitle_elem.id = 'appTitle';
        newTitle_elem.title = 'Click to edit title';
        newTitle_elem.textContent = newTitle;
        input.replaceWith(newTitle_elem);
        
        showToast('App title updated');
        setupAppTitleEditor();
      };

      input.addEventListener('blur', saveTitle);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveTitle();
        if (e.key === 'Escape') {
          const restoredTitle = document.createElement('h1');
          restoredTitle.className = 'app-title';
          restoredTitle.id = 'appTitle';
          restoredTitle.title = 'Click to edit title';
          restoredTitle.textContent = state.appTitle || 'Legacy Arc';
          input.replaceWith(restoredTitle);
          setupAppTitleEditor();
        }
      });
    });
  }
  setupAppTitleEditor();

  // Apply theme from saved state
  applyTheme(state.theme || 'light');

  // Save Day button: mark all today's tasks as completed and show celebration
  const saveDayBtn = document.getElementById('saveDayBtn');
  const celebrationModal = document.getElementById('celebrationModal');
  const celebrationClose = document.getElementById('celebrationClose');

  if (saveDayBtn) {
    saveDayBtn.addEventListener('click', () => {
      const todaysTasks = state.tasks.filter(t => t.createdAt === todayKey());
      todaysTasks.forEach(t => {
        if (t.completed) {
          // Only set completedAt when Save Day button is clicked
          t.completedAt = todayKey();
        }
      });
      saveState(state);
      render();
      // Show celebration modal
      if (celebrationModal) {
        celebrationModal.setAttribute('aria-hidden', 'false');
        celebrationModal.classList.add('display');
      }
    });
  }

  if (celebrationClose) {
    celebrationClose.addEventListener('click', () => {
      if (celebrationModal) {
        celebrationModal.classList.remove('display');
        celebrationModal.setAttribute('aria-hidden', 'true');
      }
    });
  }

  // Close celebration on Esc key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && celebrationModal && celebrationModal.classList.contains('display')) {
      celebrationModal.classList.remove('display');
      celebrationModal.setAttribute('aria-hidden', 'true');
    }
  });
  
  // Daily quote selection: pick a quote based on the local date so it changes each day
  try {
    if (quoteEl) {
      const quotes = [
        '“Small steps every day add up to big wins.”',
        '“Progress, not perfection.”',
        '“Consistency is the key to success.”',
        '“Do something today that your future self will thank you for.”',
        '“Start where you are. Use what you have. Do what you can.”'
      ];
      function getDailyQuote(){
        const d = new Date();
        const key = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
        // simple deterministic index from date string
        let sum = 0; for (let i=0;i<key.length;i++) sum += key.charCodeAt(i);
        return quotes[sum % quotes.length];
      }
      quoteEl.textContent = getDailyQuote();
    }
  } catch (e) { /* ignore errors */ }

  // initial render
  render();

  // start midnight refresh to clear today's tasks automatically
  scheduleMidnightRefresh();
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
    const k = formatLocalDate(dateObj);
    return doneDates.has(k);
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
      const key = formatLocalDate(dateObj);
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

  // Make days interactive: open inline panel below clicked day on all devices
  if (!calendarListenersInitialized) {
    yearGrid.addEventListener('click', (e) => {
      const day = e.target.closest('.day');
      if (!day || !day.dataset.date || !day.textContent.trim()) return;
      openInlinePanel(day.dataset.date, day);
    });
    yearGrid.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const day = e.target.closest('.day');
        if (!day || !day.dataset.date || !day.textContent.trim()) return;
        e.preventDefault();
        openInlinePanel(day.dataset.date, day);
      }
    });

    const pop = document.getElementById('datePopover');
    const modal = document.getElementById('dateModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    const closeModalBtn = document.getElementById('closeModal');
    let currentModalDate = null;

    // Inline panel state
    let currentInline = null;
    let currentAnchor = null;
    let inlineClickHandler = null;
    let inlineEscHandler = null;

    function buildTasksHtml(dateKey){
      const state = loadState();
      const tasks = state.tasks.filter(t => t.createdAt === dateKey || t.completedAt === dateKey);
      if (!tasks.length) return '<p class="muted">No tasks for this day.</p>';
      return '<ul class="modal-task-list">' + tasks.map(t => `<li class="modal-task" data-id="${t.id}"><label><input type="checkbox" class="modal-checkbox" data-id="${t.id}" ${t.completed ? 'checked' : ''}> <span class="${t.completed ? 'completed' : ''}">${escapeHtml(t.text)}</span></label> <button class="modal-delete" data-id="${t.id}" aria-label="Delete task">Delete</button></li>`).join('') + '</ul>';
    }

    // Inline expansion panel that inserts directly below clicked day (spans whole month row)

    // overlay panel that sits above the calendar (doesn't reflow the grid)
    function openInlinePanel(dateKey, anchorEl){
      // close any previous overlay
      closeInlinePanel();

      // create overlay anchored near the clicked day but absolutely positioned over the calendar
      currentInline = document.createElement('div');
      currentInline.className = 'inline-overlay';
      currentInline.dataset.date = dateKey;
      const headerLabel = new Date(dateKey).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
      currentInline.innerHTML = `<div class="inline-header"><strong>${headerLabel}</strong><button class="close-overlay" aria-label="Close">✕</button></div>` + buildTasksHtml(dateKey);

      document.body.appendChild(currentInline);

      // Position the overlay near the anchor if possible
      try {
        const anchorRect = anchorEl.getBoundingClientRect();
        const top = Math.max(12, anchorRect.top + window.scrollY - 8);
        currentInline.style.left = '8px';
        currentInline.style.right = '8px';
        currentInline.style.top = `${top}px`;
      } catch (e) {
        // fallback center-top
        currentInline.style.left = '8px';
        currentInline.style.right = '8px';
        currentInline.style.top = '80px';
      }

      // focus management
      const closeBtn = currentInline.querySelector('.close-overlay');
      closeBtn?.addEventListener('click', closeInlinePanel);

      // click outside or Esc closes it
      inlineClickHandler = (ev) => {
        if (!currentInline.contains(ev.target) && !anchorEl.contains(ev.target)) closeInlinePanel();
      };
      inlineEscHandler = (ev) => { if (ev.key === 'Escape') closeInlinePanel(); };
      document.addEventListener('click', inlineClickHandler);
      document.addEventListener('keydown', inlineEscHandler);
    }

    function closeInlinePanel(){
      if (!currentInline) return;
      currentInline.remove();
      currentInline = null;
      currentAnchor = null;
      if (inlineClickHandler) { document.removeEventListener('click', inlineClickHandler); inlineClickHandler = null; }
      if (inlineEscHandler) { document.removeEventListener('keydown', inlineEscHandler); inlineEscHandler = null; }
    }

    // Keep popover code for desktop hover fallback (not used by default)
    function openDatePopup(dateKey, anchorEl){
      // Ensure any existing popover is closed and cleaned up before opening a new one
      try { closePopup(); } catch(e){}
      currentModalDate = dateKey;

      // Desktop: show popover anchored to clicked element
      // Reset pop state
      pop.innerHTML = '';
      pop.classList.remove('flipped');
      pop.style.visibility = 'hidden';
      pop.setAttribute('aria-hidden','false');

      pop.innerHTML = `<div class="popover-header"><strong>${new Date(dateKey).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' })}</strong></div>` + buildTasksHtml(dateKey);
      pop.classList.add('open');

      // place popover near anchor element
      const anchorRect = anchorEl.getBoundingClientRect();
      pop.style.left = '0px'; pop.style.top = '0px'; // reset so size is correct
      document.body.appendChild(pop);
      const popRect = pop.getBoundingClientRect();
      let left = anchorRect.left + window.scrollX;
      let top = anchorRect.bottom + window.scrollY + 8;

      // adjust right overflow
      if (left + popRect.width > window.scrollX + window.innerWidth - 12) {
        left = window.scrollX + window.innerWidth - popRect.width - 12;
      }
      // flip above if bottom overflows
      if (top + popRect.height > window.scrollY + window.innerHeight - 12) {
        top = anchorRect.top + window.scrollY - popRect.height - 8;
        pop.classList.add('flipped');
      } else {
        pop.classList.remove('flipped');
      }

      pop.style.left = `${Math.max(8, left)}px`;
      pop.style.top = `${Math.max(8, top)}px`;
      pop.style.visibility = 'visible';

      // don't force focus (prevent scrolling), but allow keyboard users to close
      // add document listeners to close on outside click / Esc
      setTimeout(()=>{
        const onDocClick = (ev) => {
          if (!pop.contains(ev.target) && !anchorEl.contains(ev.target)) closePopup();
        };
        const onEsc = (ev) => { if (ev.key === 'Escape') closePopup(); };
        document.addEventListener('click', onDocClick);
        document.addEventListener('keydown', onEsc);
        pop._cleanup = ()=>{ document.removeEventListener('click', onDocClick); document.removeEventListener('keydown', onEsc); };
      }, 0);
    }

    function closePopup(){
      const pop = document.getElementById('datePopover');
      pop.classList.remove('open');
      pop.setAttribute('aria-hidden','true');
      if (pop._cleanup) { pop._cleanup(); delete pop._cleanup; }
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
      if (e.key === 'Escape') { closeModal(); closePopup(); }
    });

    // handle actions inside popover/modal (delegate click)
    document.addEventListener('click', (e) => {
      // handle modal buttons
      if (e.target.classList && e.target.classList.contains('modal-delete')) {
        const id = e.target.dataset.id;
        if (!id) return;
        const state = loadState();
        state.tasks = state.tasks.filter(t => t.id !== id);
        saveState(state);
        // refresh modals/popovers
        closePopup(); closeModal(); initCalendar(); return;
      }
      if (e.target.classList && e.target.classList.contains('modal-checkbox')) {
        const id = e.target.dataset.id;
        if (!id) return;
        const state = loadState();
        const t = state.tasks.find(t => t.id === id);
        if (!t) return;
          t.completed = e.target.checked;
          // Attribute completion to the date currently being viewed (overlay or modal)
          const viewDate = (typeof currentInline !== 'undefined' && currentInline && currentInline.dataset && currentInline.dataset.date)
                            || currentModalDate || todayKey();
          // Only set completedAt for past dates; for today, it will be set by Save Day button
          if (viewDate !== todayKey()) {
            t.completedAt = t.completed ? viewDate : null;
          }
        saveState(state);
        closePopup(); closeModal(); initCalendar(); return;
      }
    });

    // close modal via close button and backdrop
    closeModalBtn?.addEventListener('click', closeModal);
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