const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let dashboardWindow = null;
let popupWindow = null;
let tray = null;
let checkTimer = null;

// Application State
let state = {
  status: 'running', // 'running', 'paused', 'break'
  secondsRemaining: 1200, // 20 minutes default (20 * 60)
  currentTask: null,
  stats: {
    breaksTaken: 0,
    streakDays: 1,
    lastActiveDate: ''
  }
};

// Default Tasks definition (Only pushups, hydration, rest your eyes by default)
const defaultTasks = [
  {
    id: 'pushups',
    title: 'Time for 10 Pushups!',
    description: 'Get down and give us 10 slow, controlled pushups. This activates your chest, core, and arms, boosting circulation instantly.',
    color: '#e3f2fd',
    iconColor: '#0b57d0',
    icon: 'dumbbell',
    enabled: true
  },
  {
    id: 'eyes',
    title: 'Rest Your Eyes (20-20-20)',
    description: 'Look away from your screen at an object at least 20 feet away for 20 seconds. This relieves eye strain and fatigue.',
    color: '#f3e5f5',
    iconColor: '#7b1fa2',
    icon: 'eye',
    enabled: true
  },
  {
    id: 'water',
    title: 'Hydration Refresh',
    description: 'Drink a glass of fresh water. Hydration improves concentration, regulates body temperature, and keeps you alert.',
    color: '#e0f7fa',
    iconColor: '#00838f',
    icon: 'droplet',
    enabled: true
  }
];

// Default Settings
let settings = {
  intervalMinutes: 20,
  tasks: defaultTasks,
  theme: 'blue',
  runAtStartup: false
};

// Paths
const settingsPath = path.join(app.getPath('userData'), 'settings-activebreak.json');
const statsPath = path.join(app.getPath('userData'), 'stats-activebreak.json');

const oldSettingsPath = path.join(app.getPath('userData'), 'settings-fitbreak.json');
const oldStatsPath = path.join(app.getPath('userData'), 'stats-fitbreak.json');

// Load Data
function loadData() {
  // Migrate settings-fitbreak.json to settings-activebreak.json
  try {
    if (!fs.existsSync(settingsPath) && fs.existsSync(oldSettingsPath)) {
      fs.renameSync(oldSettingsPath, settingsPath);
    }
  } catch (e) {
    console.error('Failed to migrate settings file', e);
  }

  // Migrate stats-fitbreak.json to stats-activebreak.json
  try {
    if (!fs.existsSync(statsPath) && fs.existsSync(oldStatsPath)) {
      fs.renameSync(oldStatsPath, statsPath);
    }
  } catch (e) {
    console.error('Failed to migrate stats file', e);
  }

  try {
    if (fs.existsSync(settingsPath)) {
      const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      // Ensure tasks are merged/migrated if old settings format existed
      settings = { ...settings, ...data };
      if (!settings.tasks || settings.tasks.length === 0) {
        settings.tasks = defaultTasks;
      } else {
        if (!settings.theme) {
          settings.theme = 'blue';
        }
        if (typeof settings.runAtStartup === 'undefined') {
          settings.runAtStartup = false;
        }
        // Migrate old icon names to standard Lucide names
        const iconMigration = {
          pushups: 'dumbbell',
          walk: 'footprints',
          stretch: 'accessibility',
          eyes: 'eye',
          water: 'droplet',
          mind: 'brain'
        };
        settings.tasks.forEach(t => {
          if (iconMigration[t.icon]) {
            t.icon = iconMigration[t.icon];
          }
        });
      }
    } else {
      settings.tasks = defaultTasks;
    }
  } catch (e) {
    console.error('Failed to load settings', e);
    settings.tasks = defaultTasks;
  }

  try {
    if (fs.existsSync(statsPath)) {
      const data = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
      state.stats = { ...state.stats, ...data };
      
      // Check streak and date
      const today = new Date().toDateString();
      if (state.stats.lastActiveDate && state.stats.lastActiveDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (state.stats.lastActiveDate === yesterday.toDateString()) {
          // Streak continues
        } else {
          // Streak broken
          state.stats.streakDays = 1;
        }
      }
    } else {
      state.stats.lastActiveDate = new Date().toDateString();
    }
  } catch (e) {
    console.error('Failed to load stats', e);
  }
  
  // Apply startup login item settings
  try {
    app.setLoginItemSettings({
      openAtLogin: settings.runAtStartup || false,
      path: app.getPath('exe')
    });
  } catch (e) {
    console.error('Failed to set login item settings on load', e);
  }

  // Set initial countdown
  if (state.status === 'running') {
    state.secondsRemaining = settings.intervalMinutes * 60;
  }
}

// Save Data
function saveSettings() {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}

function saveStats() {
  try {
    state.stats.lastActiveDate = new Date().toDateString();
    fs.writeFileSync(statsPath, JSON.stringify(state.stats, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save stats', e);
  }
}

// Create Main Dashboard Window
function createDashboardWindow() {
  if (dashboardWindow) {
    dashboardWindow.show();
    dashboardWindow.focus();
    return;
  }

  const pngPath = path.join(__dirname, 'renderer', 'logo.png');
  const logoPath = path.join(__dirname, 'renderer', 'logo.svg');
  const iconPath = fs.existsSync(pngPath) ? pngPath : (fs.existsSync(logoPath) ? logoPath : undefined);
  dashboardWindow = new BrowserWindow({
    width: 720,
    height: 600,
    minWidth: 600,
    minHeight: 450,
    resizable: true,
    maximizable: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',
      symbolColor: '#1f2937',
      height: 48
    },
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  dashboardWindow.loadFile(path.join(__dirname, 'renderer', 'dashboard.html'));

  dashboardWindow.once('ready-to-show', () => {
    dashboardWindow.show();
  });

  dashboardWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      dashboardWindow.hide();
    }
  });

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });
}

// Trigger Break Popup
function triggerBreak() {
  if (state.status === 'break' && popupWindow) {
    return; // Already in break
  }

  state.status = 'break';
  notifyStatusChange();

  // Select a random active task
  const activeTasks = settings.tasks.filter(t => t.enabled);
  let selectedTask = defaultTasks[0]; // fallback
  if (activeTasks.length > 0) {
    selectedTask = activeTasks[Math.floor(Math.random() * activeTasks.length)];
  }
  state.currentTask = selectedTask;
  state.secondsRemaining = 120; // Hardcoded default duration of 2 minutes (120s)

  // Create Popup Window (Fullscreen overlay on active display)
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  popupWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Windows-specific overlay properties
  popupWindow.setAlwaysOnTop(true, 'screen-saver');
  popupWindow.setVisibleOnAllWorkspaces(true);

  popupWindow.loadFile(path.join(__dirname, 'renderer', 'popup.html'));

  popupWindow.on('closed', () => {
    popupWindow = null;
  });
}

// Helper for formatting tooltip time
function formatTooltipTime(seconds) {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Update tray tooltip dynamically
function updateTrayTooltip() {
  if (!tray) return;
  try {
    tray.setToolTip(formatTooltipTime(state.secondsRemaining));
  } catch (e) {
    console.error('Failed to update tray tooltip', e);
  }
}

// Timer tick handler (runs every second)
function runTimerTick() {
  if (state.status === 'paused') return;

  if (state.status === 'running') {
    state.secondsRemaining--;
    
    // Notify Dashboard
    if (dashboardWindow) {
      dashboardWindow.webContents.send('timer-tick', {
        secondsRemaining: state.secondsRemaining,
        totalSeconds: settings.intervalMinutes * 60
      });
    }

    if (state.secondsRemaining <= 0) {
      triggerBreak();
    }
  } else if (state.status === 'break') {
    state.secondsRemaining--;
    
    // Notify Popup Window
    if (popupWindow) {
      popupWindow.webContents.send('break-tick', state.secondsRemaining);
    }
    
    // Notify Dashboard to sync dynamic tray progress ring
    if (dashboardWindow) {
      dashboardWindow.webContents.send('timer-tick', {
        secondsRemaining: state.secondsRemaining,
        totalSeconds: 120
      });
    }

    if (state.secondsRemaining <= 0) {
      // Break timer finished, keep window open until action taken
    }
  }
  
  updateTrayTooltip();
}

// IPC Handlers
ipcMain.handle('get-settings', () => {
  return settings;
});

ipcMain.handle('save-settings', (event, newSettings) => {
  const oldInterval = settings.intervalMinutes;
  const oldStartup = settings.runAtStartup;
  settings = { ...settings, ...newSettings };
  saveSettings();

  // If interval changed, adjust remaining time
  if (state.status === 'running' && oldInterval !== settings.intervalMinutes) {
    state.secondsRemaining = settings.intervalMinutes * 60;
  }

  // Update login item settings
  if (oldStartup !== settings.runAtStartup) {
    try {
      app.setLoginItemSettings({
        openAtLogin: settings.runAtStartup || false,
        path: app.getPath('exe')
      });
    } catch (e) {
      console.error('Failed to update login item settings', e);
    }
  }
  return { success: true };
});

ipcMain.handle('get-status', () => {
  return {
    status: state.status,
    secondsRemaining: state.secondsRemaining,
    totalSeconds: state.status === 'running' ? settings.intervalMinutes * 60 : 120, // 120s default break
    stats: state.stats
  };
});

ipcMain.on('start-timer', () => {
  if (state.status === 'paused') {
    state.status = 'running';
    notifyStatusChange();
  }
});

ipcMain.on('pause-timer', () => {
  if (state.status === 'running') {
    state.status = 'paused';
    notifyStatusChange();
  }
});

ipcMain.on('trigger-break', () => {
  triggerBreak();
});

ipcMain.handle('get-break-task', () => {
  return state.currentTask;
});

// Custom Task CRUD IPCs
ipcMain.handle('add-task', (event, task) => {
  const newTask = {
    ...task,
    id: 'task_' + Date.now(),
    enabled: true
  };
  settings.tasks.push(newTask);
  saveSettings();
  if (dashboardWindow) notifySettingsUpdate();
  return { success: true, task: newTask };
});

ipcMain.handle('update-task', (event, updatedTask) => {
  const index = settings.tasks.findIndex(t => t.id === updatedTask.id);
  if (index !== -1) {
    settings.tasks[index] = { ...settings.tasks[index], ...updatedTask };
    saveSettings();
    if (dashboardWindow) notifySettingsUpdate();
    return { success: true };
  }
  return { success: false, error: 'Task not found' };
});

ipcMain.handle('delete-task', (event, taskId) => {
  const oldTasksCount = settings.tasks.length;
  settings.tasks = settings.tasks.filter(t => t.id !== taskId);
  if (settings.tasks.length !== oldTasksCount) {
    saveSettings();
    if (dashboardWindow) notifySettingsUpdate();
    return { success: true };
  }
  return { success: false, error: 'Task not found' };
});

ipcMain.on('complete-break', () => {
  if (popupWindow) {
    popupWindow.close();
  }
  
  // Update stats
  state.stats.breaksTaken++;
  
  // Streak calculation
  const today = new Date().toDateString();
  if (state.stats.lastActiveDate !== today) {
    state.stats.streakDays++;
  }
  saveStats();
  
  // Reset Timer to Normal Interval
  state.status = 'running';
  state.secondsRemaining = settings.intervalMinutes * 60;
  state.currentTask = null;
  
  notifyStatusChange();
  notifyStatsUpdate();
});

ipcMain.on('skip-break', () => {
  if (popupWindow) {
    popupWindow.close();
  }

  // Reset Timer
  state.status = 'running';
  state.secondsRemaining = settings.intervalMinutes * 60;
  state.currentTask = null;

  notifyStatusChange();
});

ipcMain.on('postpone-break', () => {
  if (popupWindow) {
    popupWindow.close();
  }

  // Postpone for 5 minutes (300 seconds)
  state.status = 'running';
  state.secondsRemaining = 300;
  state.currentTask = null;

  notifyStatusChange();
});

// Dynamic title bar symbol overlay color IPC
ipcMain.on('update-theme-accent', (event, accentColor) => {
  if (dashboardWindow) {
    try {
      dashboardWindow.setTitleBarOverlay({
        color: '#ffffff',
        symbolColor: accentColor
      });
    } catch (e) {
      console.error('Failed to set title bar overlay', e);
    }
  }
});

// Dynamic tray icon image update IPC
ipcMain.on('update-tray-icon', (event, dataUrl) => {
  if (tray) {
    try {
      const img = nativeImage.createFromDataURL(dataUrl);
      tray.setImage(img);
    } catch (e) {
      console.error('Failed to update tray icon image', e);
    }
  }
});

// Save logo PNG on startup and apply it as the window icon
ipcMain.on('save-logo-png', (event, dataUrl) => {
  try {
    const pngPath = path.join(__dirname, 'renderer', 'logo.png');
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(pngPath, base64Data, 'base64');
    
    // Update window icon dynamically
    const img = nativeImage.createFromPath(pngPath);
    if (dashboardWindow) {
      dashboardWindow.setIcon(img);
    }
  } catch (e) {
    console.error('Failed to save logo PNG', e);
  }
});

// Delete Data & Reset Settings IPC Handlers
ipcMain.handle('delete-all-data', (event) => {
  try {
    if (fs.existsSync(settingsPath)) {
      fs.unlinkSync(settingsPath);
    }
    if (fs.existsSync(statsPath)) {
      fs.unlinkSync(statsPath);
    }
    
    settings = {
      intervalMinutes: 20,
      tasks: defaultTasks,
      theme: 'blue',
      runAtStartup: false
    };
    
    try {
      app.setLoginItemSettings({
        openAtLogin: false,
        path: app.getPath('exe')
      });
    } catch (e) {
      console.error('Failed to clear login item settings', e);
    }
    
    state.status = 'running';
    state.secondsRemaining = 1200;
    state.currentTask = null;
    state.stats = {
      breaksTaken: 0,
      streakDays: 1,
      lastActiveDate: new Date().toDateString()
    };
    
    saveSettings();
    saveStats();
    
    if (dashboardWindow) {
      dashboardWindow.webContents.reload();
    }
    return { success: true };
  } catch (e) {
    console.error('Failed to delete all data', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('delete-stats-only', (event) => {
  try {
    state.stats = {
      breaksTaken: 0,
      streakDays: 1,
      lastActiveDate: new Date().toDateString()
    };
    saveStats();
    notifyStatsUpdate();
    return { success: true };
  } catch (e) {
    console.error('Failed to reset stats', e);
    return { success: false, error: e.message };
  }
});

function notifyStatusChange() {
  if (dashboardWindow) {
    dashboardWindow.webContents.send('status-change', {
      status: state.status,
      secondsRemaining: state.secondsRemaining
    });
  }
  updateTrayTooltip();
}

function notifyStatsUpdate() {
  if (dashboardWindow) {
    dashboardWindow.webContents.send('stats-update', state.stats);
  }
}

function notifySettingsUpdate() {
  if (dashboardWindow) {
    dashboardWindow.webContents.send('settings-update', settings);
  }
}

// System Tray Setup
function setupTray() {
  const pngPath = path.join(__dirname, 'renderer', 'logo.png');
  const svgPath = path.join(__dirname, 'renderer', 'logo.svg');
  let icon;
  try {
    if (fs.existsSync(pngPath)) {
      icon = nativeImage.createFromPath(pngPath).resize({ width: 16, height: 16 });
    } else if (fs.existsSync(svgPath)) {
      icon = nativeImage.createFromPath(svgPath).resize({ width: 16, height: 16 });
    } else {
      const trayIconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAwUlEQVQ4T62Tuw3CQBBEH2chIhIi0gEVwAdUgIaoADogIqQDChAlUIEIEZGAiOxD5DszPuxIsiWcbG/v7c3O3hG+2Ekv7kRmaQA0gA1w9G5gA8wNqEq8A5Y6nAIoQWfVd6g9mACzVbW3Cqw00A405Ld8B3LgDHR76m924BtoAr2qYQ/g2E0sR/u2k7WbAHcDsR24p96p9rZArU9g4+V5C9B3WqA3VqH2cADm8gM2V3t5+gU6mI+L3wX+AJQ2OhG7V48FAAAAAElFTkSuQmCC';
      icon = nativeImage.createFromBuffer(Buffer.from(trayIconBase64, 'base64'));
    }
  } catch (err) {
    const trayIconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAwUlEQVQ4T62Tuw3CQBBEH2chIhIi0gEVwAdUgIaoADogIqQDChAlUIEIEZGAiOxD5DszPuxIsiWcbG/v7c3O3hG+2Ekv7kRmaQA0gA1w9G5gA8wNqEq8A5Y6nAIoQWfVd6g9mACzVbW3Cqw00A405Ld8B3LgDHR76m924BtoAr2qYQ/g2E0sR/u2k7WbAHcDsR24p96p9rZArU9g4+V5C9B3WqA3VqH2cADm8gM2V3t5+gU6mI+L3wX+AJQ2OhG7V48FAAAAAElFTkSuQmCC';
    icon = nativeImage.createFromBuffer(Buffer.from(trayIconBase64, 'base64'));
  }
  
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Active Break Dashboard', click: createDashboardWindow },
    { type: 'separator' },
    { label: 'Trigger Break Now', click: triggerBreak },
    { label: 'Pause Breaks', click: () => {
        state.status = 'paused';
        notifyStatusChange();
      }
    },
    { label: 'Resume Breaks', click: () => {
        state.status = 'running';
        state.secondsRemaining = settings.intervalMinutes * 60;
        notifyStatusChange();
      }
    },
    { type: 'separator' },
    { label: 'Exit App', click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Active Break');
  updateTrayTooltip();
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    createDashboardWindow();
  });
}

// App Initialization
app.whenReady().then(() => {
  // Extract and copy lucide.min.js
  try {
    const sourcePath = 'C:\\Users\\kiman\\.gemini\\antigravity\\brain\\9688b080-7c0b-4d4d-aa42-0f6032c5c294\\.system_generated\\steps\\224\\content.md';
    const destPath = path.join(__dirname, 'renderer', 'lucide.min.js');
    if (fs.existsSync(sourcePath)) {
      const content = fs.readFileSync(sourcePath, 'utf8');
      const separatorIdx = content.indexOf('---');
      if (separatorIdx !== -1) {
        fs.writeFileSync(destPath, content.substring(separatorIdx + 3).trim(), 'utf8');
      }
    }
  } catch (e) {
    console.error('Failed to copy lucide.min.js', e);
  }

  loadData();
  setupTray();
  createDashboardWindow();

  // Start the timer loop
  checkTimer = setInterval(runTimerTick, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createDashboardWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !app.isQuitting) {
    // Keep running in tray
  } else {
    clearInterval(checkTimer);
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
