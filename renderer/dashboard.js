// DOM Elements
const timerDisplay = document.getElementById('timerDisplay');
const statusLabel = document.getElementById('statusLabel');
const timerProgress = document.getElementById('timerProgress');
const playPauseBtn = document.getElementById('playPauseBtn');
const playPauseIcon = document.getElementById('playPauseIcon');
const playPauseText = document.getElementById('playPauseText');
const breakNowBtn = document.getElementById('breakNowBtn');

// Stats Elements
const statBreaks = document.getElementById('statBreaks');
const statStreak = document.getElementById('statStreak');

// Settings Elements
const intervalInput = document.getElementById('intervalInput');
const intervalValue = document.getElementById('intervalValue');
const tasksListContainer = document.getElementById('tasksListContainer');
const addTaskBtn = document.getElementById('addTaskBtn');

// Tab Elements
const tabTasksBtn = document.getElementById('tabTasksBtn');
const tabSettingsBtn = document.getElementById('tabSettingsBtn');
const tasksTabPanel = document.getElementById('tasksTabPanel');
const settingsTabPanel = document.getElementById('settingsTabPanel');
const resetStatsBtn = document.getElementById('resetStatsBtn');
const resetAllBtn = document.getElementById('resetAllBtn');
const startupInput = document.getElementById('startupInput');

// Modal Elements
const taskModal = document.getElementById('taskModal');
const modalTitle = document.getElementById('modalTitle');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalSaveBtn = document.getElementById('modalSaveBtn');
const editTaskId = document.getElementById('editTaskId');
const taskTitleInput = document.getElementById('taskTitleInput');
const taskDescInput = document.getElementById('taskDescInput');
const colorPickerGrid = document.getElementById('colorPickerGrid');
const iconPickerGrid = document.getElementById('iconPickerGrid');

// Preset Lucide icon names (24 beautiful wellness and activity icons)
const PRESET_ICONS = [
  'dumbbell', 'footprints', 'accessibility', 'eye', 'droplet', 'brain',
  'heart', 'smile', 'timer', 'coffee', 'apple', 'bike',
  'flame', 'wind', 'sun', 'music', 'leaf', 'user-check',
  'armchair', 'sparkles', 'flower', 'award', 'activity', 'refresh-cw'
];

// Preset colors palette (background and text/border accent)
const COLOR_PRESETS = [
  { bg: '#e3f2fd', fg: '#0b57d0' }, // Blue
  { bg: '#e6f4ea', fg: '#137333' }, // Green
  { bg: '#fef7e0', fg: '#b06000' }, // Orange/Yellow
  { bg: '#f3e5f5', fg: '#7b1fa2' }, // Purple
  { bg: '#e0f7fa', fg: '#00838f' }, // Cyan
  { bg: '#fce8e6', fg: '#c5221f' }  // Red
];

let appState = {
  status: 'running',
  secondsRemaining: 1200,
  totalSeconds: 1200
};

let currentTasksList = [];
let selectedColorIdx = 0;
let selectedIconKey = 'stretch';

// SVG Progress Ring Constants
const CIRCUMFERENCE = 2 * Math.PI * 70; // 439.82 (radius = 70)
timerProgress.style.strokeDasharray = CIRCUMFERENCE;

// Initialize
async function init() {
  // Load Settings
  const settings = await window.api.getSettings();
  currentTasksList = settings.tasks || [];
  updateIntervalUI(settings.intervalMinutes);
  renderTasksList(currentTasksList);
  
  // Set launch-at-startup checkbox state
  startupInput.checked = settings.runAtStartup || false;

  // Load Initial Status & Stats
  const status = await window.api.getStatus();
  updateStatus(status);
  updateStats(status.stats);

  // Setup Interval Slider listener
  intervalInput.addEventListener('input', (e) => {
    intervalValue.textContent = `${e.target.value} mins`;
    saveIntervalSetting();
  });

  // Setup Startup Checkbox listener
  startupInput.addEventListener('change', async () => {
    const currentSettings = await window.api.getSettings();
    currentSettings.runAtStartup = startupInput.checked;
    await window.api.saveSettings(currentSettings);
  });

  // Setup Button Click Listeners
  playPauseBtn.addEventListener('click', () => {
    if (appState.status === 'running') {
      window.api.pauseTimer();
    } else if (appState.status === 'paused') {
      window.api.startTimer();
    }
  });

  breakNowBtn.addEventListener('click', () => {
    window.api.triggerBreak();
  });

  // Modal setups
  addTaskBtn.addEventListener('click', openAddModal);
  modalCloseBtn.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);
  modalSaveBtn.addEventListener('click', handleSaveTask);

  // Build picker selectors
  buildColorPickers();
  buildIconPickers();

  // Setup IPC Listeners
  window.api.onTimerTick((data) => {
    appState.secondsRemaining = data.secondsRemaining;
    appState.totalSeconds = data.totalSeconds;
    updateTimerDisplay();
    updateDynamicTrayIcon();
  });

  window.api.onStatusChange((data) => {
    appState.status = data.status;
    appState.secondsRemaining = data.secondsRemaining;
    updateStatusUI();
    updateDynamicTrayIcon();
  });

  window.api.onStatsUpdate((stats) => {
    updateStats(stats);
  });

  window.api.onSettingsUpdate((settings) => {
    currentTasksList = settings.tasks || [];
    renderTasksList(currentTasksList);
    applyTheme(settings.theme || 'blue');
    startupInput.checked = settings.runAtStartup || false;
    updateDynamicTrayIcon();
  });

  // Set theme active and load theme listeners
  const activeTheme = settings.theme || 'blue';
  applyTheme(activeTheme);
  updateDynamicTrayIcon();
  document.querySelectorAll('.theme-swatch-btn').forEach(btn => {
    if (btn.dataset.theme === activeTheme) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
    btn.addEventListener('click', async () => {
      const selectedTheme = btn.dataset.theme;
      document.querySelectorAll('.theme-swatch-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      applyTheme(selectedTheme);
      
      const currentSettings = await window.api.getSettings();
      currentSettings.theme = selectedTheme;
      await window.api.saveSettings(currentSettings);
    });
  });

  // Tab switcher click handlers
  tabTasksBtn.addEventListener('click', () => {
    tabTasksBtn.classList.add('active');
    tabSettingsBtn.classList.remove('active');
    tasksTabPanel.classList.add('active');
    settingsTabPanel.classList.remove('active');
  });

  tabSettingsBtn.addEventListener('click', () => {
    tabSettingsBtn.classList.add('active');
    tabTasksBtn.classList.remove('active');
    settingsTabPanel.classList.add('active');
    tasksTabPanel.classList.remove('active');
  });

  // Data reset actions
  resetStatsBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all active break statistics and streaks? This action cannot be undone.')) {
      const res = await window.api.deleteStatsOnly();
      if (res && res.success) {
        alert('Statistics have been successfully reset.');
      } else {
        alert('Failed to reset statistics: ' + (res.error || 'Unknown error'));
      }
    }
  });

  resetAllBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete ALL data and custom settings? The app will restore all defaults and restart. This action cannot be undone.')) {
      const res = await window.api.deleteAllData();
      if (!res || !res.success) {
        alert('Failed to delete data: ' + (res.error || 'Unknown error'));
      }
    }
  });

  // Generate and save logo.png for taskbar/window icon
  generateLogoPng();

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Build Color Selectors in Modal
function buildColorPickers() {
  colorPickerGrid.innerHTML = '';
  COLOR_PRESETS.forEach((preset, idx) => {
    const swatch = document.createElement('div');
    swatch.className = `color-swatch ${idx === selectedColorIdx ? 'selected' : ''}`;
    swatch.style.backgroundColor = preset.bg;
    swatch.style.borderColor = preset.fg;
    swatch.dataset.index = idx;
    swatch.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      selectedColorIdx = idx;
    });
    colorPickerGrid.appendChild(swatch);
  });
}

// Build Icon Grid in Modal
function buildIconPickers() {
  iconPickerGrid.innerHTML = '';
  PRESET_ICONS.forEach(key => {
    const option = document.createElement('div');
    option.className = `icon-option ${key === selectedIconKey ? 'selected' : ''}`;
    option.innerHTML = `<i data-lucide="${key}"></i>`;
    option.dataset.key = key;
    option.addEventListener('click', () => {
      document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      selectedIconKey = key;
    });
    iconPickerGrid.appendChild(option);
  });
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Render dynamic task items
function renderTasksList(tasks) {
  tasksListContainer.innerHTML = '';
  
  if (tasks.length === 0) {
    tasksListContainer.innerHTML = '<div class="task-row" style="justify-content: center; color: var(--text-secondary); font-size: 13px;">No tasks. Add some active breaks!</div>';
    return;
  }

  tasks.forEach(task => {
    const row = document.createElement('div');
    row.className = 'task-row';

    // Toggle switch
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'switch';
    toggleLabel.innerHTML = `
      <input type="checkbox" id="check-${task.id}" ${task.enabled ? 'checked' : ''}>
      <span class="switch-slider"></span>
    `;
    const checkInput = toggleLabel.querySelector('input');
    checkInput.addEventListener('change', () => {
      // Prevent disabling all tasks
      const enabledTasks = currentTasksList.filter(t => t.id === task.id ? checkInput.checked : t.enabled);
      if (enabledTasks.length === 0) {
        checkInput.checked = true; // reset
        alert('You must keep at least one break task selected!');
        return;
      }
      task.enabled = checkInput.checked;
      saveTasksState();
    });

    // Icon Preview Bubble
    const iconBubble = document.createElement('div');
    iconBubble.className = 'task-row-icon';
    iconBubble.style.backgroundColor = task.color;
    iconBubble.style.color = task.iconColor;
    iconBubble.innerHTML = `<i data-lucide="${task.icon || 'accessibility'}"></i>`;

    // Details Column
    const details = document.createElement('div');
    details.className = 'task-row-details';
    details.innerHTML = `
      <strong>${escapeHtml(task.title)}</strong>
      ${task.description ? `<span>${escapeHtml(task.description)}</span>` : ''}
    `;

    // Action buttons (Pencil & Trash)
    const actions = document.createElement('div');
    actions.className = 'task-row-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'task-action-icon-btn';
    editBtn.title = 'Edit this task';
    editBtn.innerHTML = `<i data-lucide="edit-2" style="width: 12px; height: 12px; stroke-width: 2.5px;"></i>`;
    editBtn.addEventListener('click', () => openEditModal(task));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'task-action-icon-btn delete';
    deleteBtn.title = 'Delete this task';
    deleteBtn.innerHTML = `<i data-lucide="trash-2" style="width: 12px; height: 12px; stroke-width: 2.5px;"></i>`;
    deleteBtn.addEventListener('click', () => handleDeleteTask(task.id));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(toggleLabel);
    row.appendChild(iconBubble);
    row.appendChild(details);
    row.appendChild(actions);

    tasksListContainer.appendChild(row);
  });

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Open modal to create a new task
function openAddModal() {
  editTaskId.value = '';
  taskTitleInput.value = '';
  taskDescInput.value = '';
  modalTitle.textContent = 'Add Custom Task';
  
  selectedColorIdx = 0;
  selectedIconKey = 'stretch';
  updatePickerSelections();
  
  taskModal.style.display = 'flex';
  taskTitleInput.focus();
}

// Open modal to edit an existing task
function openEditModal(task) {
  editTaskId.value = task.id;
  taskTitleInput.value = task.title;
  taskDescInput.value = task.description;
  modalTitle.textContent = 'Edit Task Details';
  
  // Find color index matching task
  const colorIdx = COLOR_PRESETS.findIndex(preset => preset.bg === task.color);
  selectedColorIdx = colorIdx !== -1 ? colorIdx : 0;
  selectedIconKey = task.icon || 'stretch';
  updatePickerSelections();
  
  taskModal.style.display = 'flex';
  taskTitleInput.focus();
}

function updatePickerSelections() {
  buildColorPickers();
  buildIconPickers();
}

function closeModal() {
  taskModal.style.display = 'none';
}

// Handle Save Task Click
async function handleSaveTask() {
  const title = taskTitleInput.value.trim();
  const desc = taskDescInput.value.trim();
  
  if (!title) {
    alert('Please fill out the Task Name!');
    return;
  }

  const selectedPreset = COLOR_PRESETS[selectedColorIdx];
  const taskData = {
    title: title,
    description: desc,
    color: selectedPreset.bg,
    iconColor: selectedPreset.fg,
    icon: selectedIconKey
  };

  const id = editTaskId.value;
  
  if (id) {
    // Update Mode
    taskData.id = id;
    const task = currentTasksList.find(t => t.id === id);
    if (task) {
      taskData.enabled = task.enabled; // Keep enabled state
    }
    await window.api.updateTask(taskData);
  } else {
    // Create Mode
    await window.api.addTask(taskData);
  }
  
  closeModal();
}

// Handle Delete Task Click
async function handleDeleteTask(taskId) {
  // Prevent deleting if it's the last remaining task
  if (currentTasksList.length <= 1) {
    alert('You must keep at least one break task in your list!');
    return;
  }

  if (confirm('Are you sure you want to delete this break task?')) {
    await window.api.deleteTask(taskId);
  }
}

// Save all settings after checkbox changes
async function saveTasksState() {
  const currentSettings = await window.api.getSettings();
  currentSettings.tasks = currentTasksList;
  await window.api.saveSettings(currentSettings);
}

// Save Interval slider value
async function saveIntervalSetting() {
  const currentSettings = await window.api.getSettings();
  currentSettings.intervalMinutes = parseInt(intervalInput.value, 10);
  await window.api.saveSettings(currentSettings);
}

// Format seconds into MM:SS
function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Sync interval configurations
function updateIntervalUI(minutes) {
  intervalInput.value = minutes;
  intervalValue.textContent = `${minutes} mins`;
}

// Update complete status object
function updateStatus(status) {
  appState.status = status.status;
  appState.secondsRemaining = status.secondsRemaining;
  appState.totalSeconds = status.totalSeconds;
  updateStatusUI();
  updateTimerDisplay();
}

// Update Status UI (Play/Pause states)
function updateStatusUI() {
  document.body.classList.remove('paused-state', 'break-state');
  
  const oldIcon = playPauseBtn.querySelector('#playPauseIcon');
  if (oldIcon) {
    const newIcon = document.createElement('i');
    newIcon.id = 'playPauseIcon';
    newIcon.setAttribute('data-lucide', appState.status === 'paused' ? 'play' : 'pause');
    newIcon.style.width = '16px';
    newIcon.style.height = '16px';
    newIcon.style.strokeWidth = '2.5px';
    oldIcon.replaceWith(newIcon);
  }

  if (appState.status === 'paused') {
    document.body.classList.add('paused-state');
    statusLabel.textContent = 'Paused';
    playPauseText.textContent = 'Resume';
    timerProgress.style.stroke = '#5e6c84';
  } else if (appState.status === 'break') {
    document.body.classList.add('break-state');
    statusLabel.textContent = 'Active Break';
    playPauseText.textContent = 'Pause';
    timerProgress.style.stroke = '#b06000';
  } else {
    statusLabel.textContent = 'Next Break';
    playPauseText.textContent = 'Pause';
    timerProgress.style.stroke = 'var(--accent-color)';
  }

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Update Timer Display & SVG ring
function updateTimerDisplay() {
  timerDisplay.textContent = formatTime(appState.secondsRemaining);
  const ratio = Math.max(0, Math.min(1, appState.secondsRemaining / appState.totalSeconds));
  const offset = CIRCUMFERENCE * (1 - ratio);
  timerProgress.style.strokeDashoffset = offset;
}

// Update Stats Cards
function updateStats(stats) {
  if (!stats) return;
  statBreaks.textContent = stats.breaksTaken;
  statStreak.textContent = `${stats.streakDays}d`;
}

// Simple HTML escaping helper to prevent XSS
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Custom theme definitions matching dashboard and popup
const THEMES = {
  blue: {
    color: '#0b57d0',
    hover: '#0842a0',
    light: '#e8f0fe',
    lightHover: '#d2e3fc'
  },
  green: {
    color: '#137333',
    hover: '#0b5120',
    light: '#e6f4ea',
    lightHover: '#d2e9d9'
  },
  peach: {
    color: '#d96525',
    hover: '#b24a13',
    light: '#fdf2e9',
    lightHover: '#fadbc8'
  },
  purple: {
    color: '#7c3aed',
    hover: '#6d28d9',
    light: '#f5f3ff',
    lightHover: '#e0d8ff'
  },
  rose: {
    color: '#b4637a',
    hover: '#944b5f',
    light: '#fdf0f3',
    lightHover: '#f7dbdf'
  }
};

function applyTheme(themeName) {
  const theme = THEMES[themeName] || THEMES.blue;
  const root = document.documentElement;
  root.style.setProperty('--accent-color', theme.color);
  root.style.setProperty('--accent-hover', theme.hover);
  root.style.setProperty('--accent-light', theme.light);
  root.style.setProperty('--accent-light-hover', theme.lightHover);
  
  // Update Electron title bar dynamic color
  window.api.updateThemeAccent(theme.color);
}

function updateDynamicTrayIcon() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    const ratio = Math.max(0, Math.min(1, appState.secondsRemaining / appState.totalSeconds));
    
    let strokeColor = '#0b57d0';
    if (appState.status === 'paused') {
      strokeColor = '#5e6c84'; // Grey when paused
    } else if (appState.status === 'break') {
      strokeColor = '#b06000'; // Orange on break
    } else {
      // Get active accent color from CSS variables dynamically
      strokeColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#0b57d0';
    }
    
    ctx.clearRect(0, 0, 32, 32);
    
    // Draw background ring (translucent black)
    ctx.beginPath();
    ctx.arc(16, 16, 12, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    
    // Draw progress arc
    if (ratio > 0) {
      ctx.beginPath();
      // Start from top (-0.5 * PI)
      ctx.arc(16, 16, 12, -0.5 * Math.PI, -0.5 * Math.PI + ratio * 2 * Math.PI);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    
    const dataUrl = canvas.toDataURL('image/png');
    window.api.updateTrayIcon(dataUrl);
  } catch (e) {
    console.error('Failed to render dynamic tray icon', e);
  }
}

// Generate and save logo.png from logo.svg on startup
function generateLogoPng() {
  try {
    const img = new Image();
    img.src = 'logo.svg';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 256, 256);
      try {
        const dataUrl = canvas.toDataURL('image/png');
        window.api.saveLogoPng(dataUrl);
      } catch (e) {
        console.error('Failed to export logo PNG data URL', e);
      }
    };
    img.onerror = (err) => {
      console.error('Failed to load logo.svg for PNG generation', err);
    };
  } catch (err) {
    console.error('Failed to generate logo PNG', err);
  }
}

// Run init
init();
