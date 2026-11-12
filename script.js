/**
 * Virtual Pet - Stage 1-5 Refined Arcade Version (Pet Name: Kitty)
 */

const TICK_INTERVAL = 3000;
const TIMER_INTERVAL = 1000;
const STORAGE_KEY = "virtual_pet_save_v1";

const COOLDOWN_SECONDS = {
  feed: 3,
  play: 4,
  sleep: 5
};

const BASE_LABELS = {
  feed: "Feed",
  play: "Play",
  sleep: "Sleep"
};

let gameState = "idle";
let stats = { hunger: 50, happiness: 50, energy: 50 };
let zeroTickCounts = { hunger: 0, happiness: 0, energy: 0 };
let elapsedSeconds = 0;

let tickTimerId = null;
let timerTimerId = null;
let cooldownTimerId = { feed: null, play: null, sleep: null };
let cooldownActive = { feed: false, play: false, sleep: false };

let feedbackTimerId = null;
let isSleeping = false;
let sleepTimerId = null;
let isEating = false;
let eatTimerId = null;
let mouthAnimationInterval = null;

// DOM Elements
const petNameEl = document.getElementById("pet-name");
const moodTextEl = document.getElementById("mood-text");
const statusTextEl = document.getElementById("status-text");

const hungerBarEl = document.getElementById("hunger-bar");
const happinessBarEl = document.getElementById("happiness-bar");
const energyBarEl = document.getElementById("energy-bar");

const hungerValueEl = document.getElementById("hunger-value");
const happinessValueEl = document.getElementById("happiness-value");
const energyValueEl = document.getElementById("energy-value");

const btnFeed = document.getElementById("btn-feed");
const btnPlay = document.getElementById("btn-play");
const btnSleep = document.getElementById("btn-sleep");

const timerEl = document.getElementById("timer");
const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");
const btnResetData = document.getElementById("btn-reset-data");

const gameOverOverlay = document.getElementById("game-over-overlay");
const gameOverMessageEl = document.getElementById("game-over-message");
const btnSound = document.getElementById("btn-sound");
const particleContainer = document.getElementById("particle-container");

// Web Audio API
let soundMuted = false;
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type) {
  if (soundMuted) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === "feed") {
      [0, 0.1, 0.2, 0.3].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(480, now + delay);
        osc.frequency.exponentialRampToValueAtTime(800, now + delay + 0.08);
        gain.gain.setValueAtTime(0.15, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.08);
      });
    } else if (type === "play") {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        gain.gain.setValueAtTime(0.15, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * 0.07 + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + (i + 1) * 0.07 + 0.05);
      });
    } else if (type === "sleep") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(392, now);
      osc.frequency.linearRampToValueAtTime(329.63, now + 0.35);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === "gameover") {
      const notes = [392, 349.23, 293.66, 220];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now + i * 0.16);
        gain.gain.setValueAtTime(0.12, now + i * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.16);
        osc.stop(now + (i + 1) * 0.16);
      });
    }
  } catch (err) {}
}

function toggleSound() {
  soundMuted = !soundMuted;
  if (btnSound) {
    btnSound.textContent = soundMuted ? "🔇 Sound: OFF" : "🔊 Sound: ON";
    btnSound.setAttribute("aria-label", soundMuted ? "Unmute sound" : "Mute sound");
  }
  if (!soundMuted) getAudioContext();
  saveGameData();
}

function spawnParticles(symbols) {
  if (!particleContainer) return;
  symbols.forEach((sym) => {
    const p = document.createElement("span");
    p.className = "particle";
    p.textContent = sym;
    p.style.left = `${50 + (Math.random() * 40 - 20)}%`;
    p.style.top = `${50 + (Math.random() * 20 - 10)}%`;
    p.style.color = Math.random() > 0.5 ? "#FF2A85" : "#00F0FF";
    p.style.fontSize = `${20 + Math.random() * 10}px`;
    p.style.setProperty("--dx", `${(Math.random() - 0.5) * 80}px`);
    p.style.setProperty("--dy", `-${50 + Math.random() * 50}px`);
    
    particleContainer.appendChild(p);
    setTimeout(() => p.remove(), 1100);
  });
}

function triggerAnimation(animClass) {
  const petSvg = document.getElementById("pet-svg");
  if (!petSvg) return;
  petSvg.classList.remove("anim-chew", "anim-play-bounce", "anim-breathe");
  void petSvg.offsetWidth;
  petSvg.classList.add(animClass);
  
  if (animClass !== "anim-breathe") {
    setTimeout(() => petSvg.classList.remove(animClass), 850);
  }
}

// Storage
function saveGameData() {
  try {
    const saveData = { stats, elapsedSeconds, soundMuted };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
  } catch (err) {}
}

function loadGameData() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (!rawData) return;
    const parsed = JSON.parse(rawData);
    if (parsed && typeof parsed === "object") {
      if (parsed.stats && typeof parsed.stats === "object") {
        if (typeof parsed.stats.hunger === "number") stats.hunger = clamp(parsed.stats.hunger, 0, 100);
        if (typeof parsed.stats.happiness === "number") stats.happiness = clamp(parsed.stats.happiness, 0, 100);
        if (typeof parsed.stats.energy === "number") stats.energy = clamp(parsed.stats.energy, 0, 100);
      }
      if (typeof parsed.elapsedSeconds === "number" && parsed.elapsedSeconds >= 0) {
        elapsedSeconds = parsed.elapsedSeconds;
        if (timerEl) timerEl.textContent = formatTime(elapsedSeconds);
      }
      if (typeof parsed.soundMuted === "boolean") {
        soundMuted = parsed.soundMuted;
        if (btnSound) btnSound.textContent = soundMuted ? "🔇 Sound: OFF" : "🔊 Sound: ON";
      }
    }
  } catch (err) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function resetStoredData() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (err) {}
  if (tickTimerId !== null) { clearInterval(tickTimerId); tickTimerId = null; }
  if (timerTimerId !== null) { clearInterval(timerTimerId); timerTimerId = null; }
  clearAllCooldowns();

  gameState = "idle";
  stats = { hunger: 50, happiness: 50, energy: 50 };
  zeroTickCounts = { hunger: 0, happiness: 0, energy: 0 };
  elapsedSeconds = 0;
  soundMuted = false;

  if (btnSound) btnSound.textContent = "🔊 Sound: ON";
  gameOverOverlay.classList.add("hidden");
  btnStart.classList.remove("hidden");
  btnRestart.classList.add("hidden");

  btnFeed.disabled = true;
  btnPlay.disabled = true;
  btnSleep.disabled = true;

  timerEl.textContent = "00:00";
  updateUI();
  showFeedback("🔄 All game data has been reset.");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins < 10 ? "0" + mins : mins}:${secs < 10 ? "0" + secs : secs}`;
}

function getMoodText() {
  const avg = Math.floor((stats.hunger + stats.happiness + stats.energy) / 3);
  if (avg >= 70) return "😊 Your pet is thriving!";
  if (avg >= 40) return "🙂 Your pet is doing okay.";
  if (avg >= 15) return "😟 Your pet needs attention!";
  return "😢 Your pet is in critical condition!";
}

function getBarColor(value) {
  if (value >= 70) return "linear-gradient(90deg, #FF2A85, #FF6BB5)";
  if (value >= 40) return "linear-gradient(90deg, #00F0FF, #38BDF8)";
  if (value >= 15) return "linear-gradient(90deg, #A855F7, #C084FC)";
  return "linear-gradient(90deg, #F43F5E, #FB7185)";
}

function getDefaultStatusLine() {
  let lowestStat = "hunger";
  let lowestVal = stats.hunger;

  if (stats.energy < lowestVal) { lowestStat = "energy"; lowestVal = stats.energy; }
  if (stats.happiness < lowestVal) { lowestStat = "happiness"; lowestVal = stats.happiness; }

  if (lowestVal >= 26) return "";
  if (lowestStat === "hunger") return lowestVal <= 10 ? "🍽️ Starving! Feed Kitty!" : "🍽️ Kitty is getting hungry.";
  if (lowestStat === "energy") return lowestVal <= 10 ? "💤 Exhausted! Kitty needs sleep!" : "💤 Kitty is getting sleepy.";
  if (lowestStat === "happiness") return lowestVal <= 10 ? "🎾 Miserable! Play with Kitty!" : "🎾 Kitty is getting bored.";
  return "";
}

function updatePetExpression() {
  const petSvg = document.getElementById("pet-svg");
  const mouth = document.getElementById("pet-mouth");
  const leftEyeWhite = document.getElementById("pet-left-eye");
  const rightEyeWhite = document.getElementById("pet-right-eye");
  const leftX = document.getElementById("pet-left-x");
  const rightX = document.getElementById("pet-right-x");
  const sleepingEyes = document.getElementById("pet-sleeping-eyes");

  if (!petSvg || !mouth) return;

  petSvg.classList.remove("mood-thriving", "mood-okay", "mood-warning", "mood-critical", "mood-dead");

  if (gameState === "gameover") {
    isSleeping = false;
    isEating = false;
    petSvg.classList.add("mood-dead");
    mouth.setAttribute("d", "M 80 140 Q 87 136 94 140 Q 100 144 106 140 Q 113 136 120 140");
    if (leftEyeWhite) leftEyeWhite.style.display = "none";
    if (rightEyeWhite) rightEyeWhite.style.display = "none";
    if (sleepingEyes) sleepingEyes.style.display = "none";
    if (leftX) leftX.style.display = "block";
    if (rightX) rightX.style.display = "block";
    return;
  }

  if (isEating && gameState === "running") {
    petSvg.classList.add("mood-thriving");
    if (leftEyeWhite) leftEyeWhite.style.display = "";
    if (rightEyeWhite) rightEyeWhite.style.display = "";
    if (sleepingEyes) sleepingEyes.style.display = "none";
    if (leftX) leftX.style.display = "none";
    if (rightX) rightX.style.display = "none";
    return;
  }

  if (isSleeping && gameState === "running") {
    petSvg.classList.add("mood-okay");
    mouth.setAttribute("d", "M 88 136 Q 100 144 112 136");
    if (leftEyeWhite) leftEyeWhite.style.display = "none";
    if (rightEyeWhite) rightEyeWhite.style.display = "none";
    if (leftX) leftX.style.display = "none";
    if (rightX) rightX.style.display = "none";
    if (sleepingEyes) sleepingEyes.style.display = "block";
    return;
  }

  if (leftEyeWhite) leftEyeWhite.style.display = "";
  if (rightEyeWhite) rightEyeWhite.style.display = "";
  if (sleepingEyes) sleepingEyes.style.display = "none";
  if (leftX) leftX.style.display = "none";
  if (rightX) rightX.style.display = "none";

  const avg = Math.floor((stats.hunger + stats.happiness + stats.energy) / 3);

  if (avg >= 70) {
    petSvg.classList.add("mood-thriving");
    mouth.setAttribute("d", "M 80 138 Q 100 158 120 138");
  } else if (avg >= 40) {
    petSvg.classList.add("mood-okay");
    mouth.setAttribute("d", "M 85 135 Q 100 148 115 135");
  } else if (avg >= 15) {
    petSvg.classList.add("mood-warning");
    mouth.setAttribute("d", "M 85 138 L 115 138");
  } else {
    petSvg.classList.add("mood-critical");
    mouth.setAttribute("d", "M 80 145 Q 100 132 120 145");
  }
}

function updateUI() {
  hungerValueEl.textContent = `${stats.hunger} / 100`;
  happinessValueEl.textContent = `${stats.happiness} / 100`;
  energyValueEl.textContent = `${stats.energy} / 100`;

  hungerBarEl.style.width = `${stats.hunger}%`;
  happinessBarEl.style.width = `${stats.happiness}%`;
  energyBarEl.style.width = `${stats.energy}%`;

  hungerBarEl.style.background = getBarColor(stats.hunger);
  happinessBarEl.style.background = getBarColor(stats.happiness);
  energyBarEl.style.background = getBarColor(stats.energy);

  updatePetExpression();
  moodTextEl.textContent = getMoodText();

  if (!feedbackTimerId) {
    statusTextEl.textContent = getDefaultStatusLine();
  }
}

function showFeedback(message) {
  if (feedbackTimerId !== null) { clearTimeout(feedbackTimerId); feedbackTimerId = null; }
  statusTextEl.textContent = message;
  feedbackTimerId = setTimeout(() => {
    feedbackTimerId = null;
    statusTextEl.textContent = getDefaultStatusLine();
  }, 2000);
}

function startCooldown(action, buttonEl) {
  cooldownActive[action] = true;
  buttonEl.disabled = true;

  let remainingSeconds = COOLDOWN_SECONDS[action];
  const labelSpan = buttonEl.querySelector('.btn-label');
  if (labelSpan) labelSpan.textContent = `${BASE_LABELS[action]} (${remainingSeconds}s)`;

  cooldownTimerId[action] = setInterval(() => {
    remainingSeconds -= 1;
    if (remainingSeconds <= 0) {
      clearInterval(cooldownTimerId[action]);
      cooldownTimerId[action] = null;
      cooldownActive[action] = false;
      if (labelSpan) labelSpan.textContent = BASE_LABELS[action];
      if (gameState === "running") buttonEl.disabled = false;
    } else {
      if (labelSpan) labelSpan.textContent = `${BASE_LABELS[action]} (${remainingSeconds}s)`;
    }
  }, 1000);
}

function clearAllCooldowns() {
  [
    { key: "feed", btn: btnFeed },
    { key: "play", btn: btnPlay },
    { key: "sleep", btn: btnSleep }
  ].forEach(({ key, btn }) => {
    if (cooldownTimerId[key] !== null) {
      clearInterval(cooldownTimerId[key]);
      cooldownTimerId[key] = null;
    }
    cooldownActive[key] = false;
    const labelSpan = btn.querySelector('.btn-label');
    if (labelSpan) labelSpan.textContent = BASE_LABELS[key];
  });
}

function feed() {
  if (gameState !== "running" || cooldownActive.feed) return;
  if (isSleeping) isSleeping = false;

  stats.hunger = clamp(stats.hunger + 20, 0, 100);
  if (stats.hunger > 0) zeroTickCounts.hunger = 0;

  startCooldown("feed", btnFeed);
  triggerAnimation("anim-chew");
  spawnParticles(["🍖", "✨", "😋", "💖"]);

  // Rapid Open/Close Mouth Eating Motion
  isEating = true;
  const mouth = document.getElementById("pet-mouth");
  let open = false;
  if (mouthAnimationInterval !== null) clearInterval(mouthAnimationInterval);

  mouthAnimationInterval = setInterval(() => {
    open = !open;
    if (mouth) {
      if (open) {
        mouth.setAttribute("d", "M 88 135 A 12 14 0 0 0 112 135 Z");
      } else {
        mouth.setAttribute("d", "M 80 138 Q 100 158 120 138");
      }
    }
  }, 140);

  if (eatTimerId !== null) clearTimeout(eatTimerId);
  eatTimerId = setTimeout(() => {
    isEating = false;
    eatTimerId = null;
    if (mouthAnimationInterval !== null) {
      clearInterval(mouthAnimationInterval);
      mouthAnimationInterval = null;
    }
    updateUI();
  }, 1400);

  updateUI();
  showFeedback("🍖 Yum! Kitty eats happily.");
  playSound("feed");
  saveGameData();
}

function play() {
  if (gameState !== "running" || cooldownActive.play) return;
  if (stats.energy < 10) {
    showFeedback("😴 Kitty is too tired to play!");
    return;
  }
  if (isSleeping) isSleeping = false;

  stats.happiness = clamp(stats.happiness + 15, 0, 100);
  stats.energy = clamp(stats.energy - 10, 0, 100);
  stats.hunger = clamp(stats.hunger - 5, 0, 100);

  if (stats.happiness > 0) zeroTickCounts.happiness = 0;
  if (stats.energy > 0) zeroTickCounts.energy = 0;
  if (stats.hunger > 0) zeroTickCounts.hunger = 0;

  startCooldown("play", btnPlay);
  triggerAnimation("anim-play-bounce");
  spawnParticles(["⚽", "🎾", "🎵", "⭐", "🎉"]);
  updateUI();
  showFeedback("🎾 Kitty jumps and plays happily!");
  playSound("play");
  saveGameData();
}

function sleep() {
  if (gameState !== "running" || cooldownActive.sleep) return;

  stats.energy = clamp(stats.energy + 25, 0, 100);
  stats.hunger = clamp(stats.hunger - 5, 0, 100);

  if (stats.energy > 0) zeroTickCounts.energy = 0;
  if (stats.hunger > 0) zeroTickCounts.hunger = 0;

  isSleeping = true;
  if (sleepTimerId !== null) clearTimeout(sleepTimerId);

  triggerAnimation("anim-breathe");
  spawnParticles(["💤", "🌙", "✨"]);

  sleepTimerId = setTimeout(() => {
    isSleeping = false;
    sleepTimerId = null;
    const petSvg = document.getElementById("pet-svg");
    if (petSvg) petSvg.classList.remove("anim-breathe");
    updateUI();
  }, 2500);

  startCooldown("sleep", btnSleep);
  updateUI();
  showFeedback("💤 Zzz… Kitty takes a cozy nap.");
  playSound("sleep");
  saveGameData();
}

function checkLoseCondition() {
  return zeroTickCounts.hunger >= 2 || zeroTickCounts.happiness >= 2 || zeroTickCounts.energy >= 2;
}

function tick() {
  stats.hunger = clamp(stats.hunger - 3, 0, 100);
  stats.happiness = clamp(stats.happiness - 2, 0, 100);
  stats.energy = clamp(stats.energy - 1, 0, 100);

  ["hunger", "happiness", "energy"].forEach((key) => {
    if (stats[key] === 0) zeroTickCounts[key] += 1;
    else zeroTickCounts[key] = 0;
  });

  if (checkLoseCondition()) {
    endGame();
    return;
  }

  updateUI();
  saveGameData();
}

function timerTick() {
  if (elapsedSeconds < 5999) {
    elapsedSeconds += 1;
    timerEl.textContent = formatTime(elapsedSeconds);
    saveGameData();
  }
}

function startGame() {
  if (gameState !== "idle") return;
  getAudioContext();
  gameState = "running";

  btnStart.classList.add("hidden");
  btnRestart.classList.remove("hidden");

  btnFeed.disabled = false;
  btnPlay.disabled = false;
  btnSleep.disabled = false;

  updateUI();

  if (tickTimerId !== null) clearInterval(tickTimerId);
  if (timerTimerId !== null) clearInterval(timerTimerId);

  tickTimerId = setInterval(tick, TICK_INTERVAL);
  timerTimerId = setInterval(timerTick, TIMER_INTERVAL);
  saveGameData();
}

function endGame() {
  gameState = "gameover";
  isSleeping = false;
  isEating = false;

  if (tickTimerId !== null) clearInterval(tickTimerId);
  if (timerTimerId !== null) clearInterval(timerTimerId);

  clearAllCooldowns();
  btnFeed.disabled = true;
  btnPlay.disabled = true;
  btnSleep.disabled = true;

  gameOverMessageEl.textContent = `Kitty ran away! You survived for ${formatTime(elapsedSeconds)}.`;
  gameOverOverlay.classList.remove("hidden");
  playSound("gameover");

  updateUI();
  saveGameData();
}

function restartGame() {
  isSleeping = false;
  isEating = false;

  if (tickTimerId !== null) clearInterval(tickTimerId);
  if (timerTimerId !== null) clearInterval(timerTimerId);

  clearAllCooldowns();

  stats = { hunger: 50, happiness: 50, energy: 50 };
  zeroTickCounts = { hunger: 0, happiness: 0, energy: 0 };
  elapsedSeconds = 0;
  timerEl.textContent = "00:00";

  btnFeed.disabled = false;
  btnPlay.disabled = false;
  btnSleep.disabled = false;

  gameOverOverlay.classList.add("hidden");
  updateUI();

  gameState = "running";
  btnStart.classList.add("hidden");
  btnRestart.classList.remove("hidden");

  tickTimerId = setInterval(tick, TICK_INTERVAL);
  timerTimerId = setInterval(timerTick, TIMER_INTERVAL);
  saveGameData();
}

btnFeed.addEventListener("click", feed);
btnPlay.addEventListener("click", play);
btnSleep.addEventListener("click", sleep);
btnStart.addEventListener("click", startGame);
btnRestart.addEventListener("click", restartGame);
if (btnResetData) btnResetData.addEventListener("click", resetStoredData);
if (btnSound) btnSound.addEventListener("click", toggleSound);

loadGameData();
updateUI();