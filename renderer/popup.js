// DOM Elements
const taskIllustration = document.getElementById('taskIllustration');
const breakTimerText = document.getElementById('breakTimerText');
const breakTimerProgress = document.getElementById('breakTimerProgress');
const taskBadge = document.getElementById('taskBadge');
const taskTitle = document.getElementById('taskTitle');
const taskDescription = document.getElementById('taskDescription');
const breakCard = document.getElementById('breakCard');

// Buttons
const completeBtn = document.getElementById('completeBtn');
const postponeBtn = document.getElementById('postponeBtn');
const skipBtn = document.getElementById('skipBtn');

// Preset Lucide illustrations used by task keys
// (Icons are loaded dynamically from the copied lucide.min.js on startup)

let totalDuration = 120; // Hardcoded default duration of 2 minutes
const CIRCUMFERENCE = 2 * Math.PI * 38; // 238.76 (radius = 38)
breakTimerProgress.style.strokeDasharray = CIRCUMFERENCE;

// Load Audio Synthesizer Chime
function playChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const playNote = (frequency, startTime, duration) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, startTime);
      
      gainNode.gain.setValueAtTime(0.12, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    
    const now = audioCtx.currentTime;
    // Peaceful rising chime (C5 -> E5 -> G5)
    playNote(523.25, now, 0.4);      // C5
    playNote(659.25, now + 0.12, 0.4); // E5
    playNote(783.99, now + 0.24, 0.6); // G5
  } catch (e) {
    console.error('Audio chime failed', e);
  }
}

// Format seconds to MM:SS
function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function init() {
  // Play chime immediately to alert user
  playChime();

  // Load settings to apply theme variables
  try {
    const settings = await window.api.getSettings();
    const themeName = settings.theme || 'blue';
    const THEMES = {
      blue: { color: '#0b57d0', hover: '#0842a0', light: '#e8f0fe', lightHover: '#d2e3fc' },
      green: { color: '#137333', hover: '#0b5120', light: '#e6f4ea', lightHover: '#d2e9d9' },
      peach: { color: '#d96525', hover: '#b24a13', light: '#fdf2e9', lightHover: '#fadbc8' },
      purple: { color: '#7c3aed', hover: '#6d28d9', light: '#f5f3ff', lightHover: '#e0d8ff' },
      rose: { color: '#b4637a', hover: '#944b5f', light: '#fdf0f3', lightHover: '#f7dbdf' }
    };
    const theme = THEMES[themeName] || THEMES.blue;
    const root = document.documentElement;
    root.style.setProperty('--accent-color', theme.color);
    root.style.setProperty('--accent-hover', theme.hover);
    root.style.setProperty('--accent-light', theme.light);
    root.style.setProperty('--accent-light-hover', theme.lightHover);
  } catch (e) {
    console.error('Failed to load settings in popup window', e);
  }

  // Load break task details
  const task = await window.api.getBreakTask();
  
  // Render task
  taskTitle.textContent = task.title;
  if (task.description && task.description.trim()) {
    taskDescription.textContent = task.description;
    taskDescription.style.display = 'block';
  } else {
    taskDescription.textContent = '';
    taskDescription.style.display = 'none';
  }
  
  // Custom theme coloring
  taskBadge.style.backgroundColor = task.color;
  taskBadge.style.color = task.iconColor;
  taskIllustration.style.backgroundColor = task.color;
  taskIllustration.style.color = task.iconColor;
  breakTimerProgress.style.stroke = task.iconColor;

  // Dynamically set selected SVG illustration
  taskIllustration.innerHTML = `<i data-lucide="${task.icon || 'accessibility'}" style="stroke-width: 2px;"></i>`;

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Initial countdown render
  updateTimerDisplay(totalDuration);

  // Button Listeners
  completeBtn.addEventListener('click', () => {
    window.api.completeBreak();
  });

  postponeBtn.addEventListener('click', () => {
    window.api.postponeBreak();
  });

  skipBtn.addEventListener('click', () => {
    window.api.skipBreak();
  });

  // Listen for timer ticks from Main Process
  window.api.onBreakTick((timeLeft) => {
    updateTimerDisplay(timeLeft);

    if (timeLeft <= 0) {
      breakTimerText.textContent = "Time!";
      completeBtn.classList.add('pulse-glow');
    }
  });
}

function updateTimerDisplay(timeLeft) {
  breakTimerText.textContent = formatTime(timeLeft);
  
  // Progress Ring
  const ratio = Math.max(0, Math.min(1, timeLeft / totalDuration));
  const offset = CIRCUMFERENCE * (1 - ratio);
  breakTimerProgress.style.strokeDashoffset = offset;
}

// Run initializer
init();
