const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Common
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getStatus: () => ipcRenderer.invoke('get-status'),
  
  // Dashboard controls
  startTimer: () => ipcRenderer.send('start-timer'),
  pauseTimer: () => ipcRenderer.send('pause-timer'),
  triggerBreak: () => ipcRenderer.send('trigger-break'),
  
  // Dashboard listeners
  onTimerTick: (callback) => ipcRenderer.on('timer-tick', (event, data) => callback(data)),
  onStatusChange: (callback) => ipcRenderer.on('status-change', (event, data) => callback(data)),
  onStatsUpdate: (callback) => ipcRenderer.on('stats-update', (event, data) => callback(data)),
  onSettingsUpdate: (callback) => ipcRenderer.on('settings-update', (event, data) => callback(data)),
  
  // Task Management
  addTask: (task) => ipcRenderer.invoke('add-task', task),
  updateTask: (task) => ipcRenderer.invoke('update-task', task),
  deleteTask: (taskId) => ipcRenderer.invoke('delete-task', taskId),
  
  // Popup controls
  getBreakTask: () => ipcRenderer.invoke('get-break-task'),
  completeBreak: () => ipcRenderer.send('complete-break'),
  skipBreak: () => ipcRenderer.send('skip-break'),
  postponeBreak: () => ipcRenderer.send('postpone-break'),
  
  // Popup listeners
  onBreakTick: (callback) => ipcRenderer.on('break-tick', (event, timeLeft) => callback(timeLeft)),

  // Settings & Customization
  updateThemeAccent: (accentColor) => ipcRenderer.send('update-theme-accent', accentColor),
  deleteAllData: () => ipcRenderer.invoke('delete-all-data'),
  deleteStatsOnly: () => ipcRenderer.invoke('delete-stats-only'),
  updateTrayIcon: (dataUrl) => ipcRenderer.send('update-tray-icon', dataUrl),
  saveLogoPng: (dataUrl) => ipcRenderer.send('save-logo-png', dataUrl)
});
