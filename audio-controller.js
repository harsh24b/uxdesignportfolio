/**
 * Portfolio Audio Controller
 * Inspired by Orano Innovation Experience (Sound Design by Mooders)
 * - Automatic background ambient music on page open (with robust autoplay unlock)
 * - Continuous playback across page navigation (does not restart)
 * - Stops completely on project / case study pages
 * - Interactive button hover sound effect (with specific nav and section exclusions)
 * - Modern Web Audio API + HTML5 Audio fallback for zero-latency polyphony
 * - Floating Sound Controller UI with animated equalizer bars
 * - Tab visibility detection (auto-pauses when switching tabs)
 * - State and playback timestamp persistence across pages
 */

(function () {
  'use strict';

  // 1. Check if current page is an individual project case study page
  const pathname = window.location.pathname.toLowerCase();
  const isProjectPage = /(transportation|kamo-ai|kamoai|savw|design-research|sage-ai|sageai)/i.test(pathname);
  if (isProjectPage) {
    try {
      sessionStorage.setItem('portfolio_music_was_playing', 'false');
      localStorage.setItem('portfolio_music_was_playing', 'false');
    } catch (e) {}
    return; // Completely disabled on individual project pages
  }

  if (window.__portfolioAudioInitialized) return;
  window.__portfolioAudioInitialized = true;

  // Resolve base path from this script's location so assets load reliably on any page
  const scriptTag = document.currentScript || document.querySelector('script[src*="audio-controller.js"]');
  const basePath = scriptTag ? scriptTag.src.substring(0, scriptTag.src.lastIndexOf('/') + 1) : '';

  const BG_MUSIC_SRC = basePath + 'assets/audio/background-music.mp3';
  const HOVER_SOUND_SRC = basePath + 'assets/audio/button-hover.mp3';
  const TARGET_BG_VOLUME = 0.28; // Atmospheric ambient level
  const HOVER_VOLUME = 0.45;     // Crisp, pleasant UI feedback

  // Mute state (persisted across page navigation, default to unmuted)
  let isMuted = false;
  try {
    const saved = localStorage.getItem('portfolio_sound_muted');
    if (saved !== null) {
      isMuted = saved === 'true';
    }
  } catch (e) {}

  let userInteracted = false;
  let bgAudio = null;
  let audioCtx = null;
  let hoverBuffer = null;
  let hoverGainNode = null;
  let fadeInterval = null;
  let isPlaying = false;
  let listenersAttached = false;

  // Save current audio playback position and timestamp
  function savePlaybackState() {
    if (!bgAudio) return;
    try {
      const isCurrentlyPlaying = !bgAudio.paused && !isMuted;
      sessionStorage.setItem('portfolio_music_time', String(bgAudio.currentTime || 0));
      sessionStorage.setItem('portfolio_music_timestamp', String(Date.now()));
      sessionStorage.setItem('portfolio_music_was_playing', isCurrentlyPlaying ? 'true' : 'false');

      localStorage.setItem('portfolio_music_time', String(bgAudio.currentTime || 0));
      localStorage.setItem('portfolio_music_timestamp', String(Date.now()));
      localStorage.setItem('portfolio_music_was_playing', isCurrentlyPlaying ? 'true' : 'false');
    } catch (e) {}
  }

  // Calculate continuous playback seek position if resuming from recent page navigation
  function getContinuousResumePosition() {
    try {
      const wasPlaying = (sessionStorage.getItem('portfolio_music_was_playing') || localStorage.getItem('portfolio_music_was_playing')) === 'true';
      const savedTimeStr = sessionStorage.getItem('portfolio_music_time') || localStorage.getItem('portfolio_music_time');
      const savedTsStr = sessionStorage.getItem('portfolio_music_timestamp') || localStorage.getItem('portfolio_music_timestamp');

      if (wasPlaying && savedTimeStr && savedTsStr) {
        const savedTime = parseFloat(savedTimeStr);
        const savedTs = parseInt(savedTsStr, 10);
        const elapsedSec = (Date.now() - savedTs) / 1000;
        if (!isNaN(savedTime) && !isNaN(elapsedSec) && elapsedSec >= 0 && elapsedSec < 45) {
          return { shouldResume: true, seekTime: savedTime + elapsedSec };
        }
      }
    } catch (e) {}
    return { shouldResume: false, seekTime: 0 };
  }

  // Seek safely whether metadata is ready or not
  function applySeekTime(seekTime) {
    if (!bgAudio || seekTime <= 0) return;
    const seek = () => {
      try {
        if (isFinite(bgAudio.duration) && bgAudio.duration > 0) {
          bgAudio.currentTime = seekTime % bgAudio.duration;
        } else {
          bgAudio.currentTime = seekTime;
        }
      } catch (e) {}
    };

    if (bgAudio.readyState >= 1) {
      seek();
    } else {
      bgAudio.addEventListener('loadedmetadata', seek, { once: true });
    }
  }

  // Initialize Web Audio Context for zero-latency hover effects
  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
        hoverGainNode = audioCtx.createGain();
        hoverGainNode.gain.value = isMuted ? 0 : HOVER_VOLUME;
        hoverGainNode.connect(audioCtx.destination);
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  // Pre-load and decode hover sound for zero-latency playback
  function loadHoverSound() {
    if (!audioCtx) return;
    fetch(HOVER_SOUND_SRC)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then(data => audioCtx.decodeAudioData(data))
      .then(buffer => {
        hoverBuffer = buffer;
      })
      .catch(() => {});
  }

  // Fallback HTML5 audio pool for hover sound
  const hoverPool = [];
  function getFallbackHoverAudio() {
    for (let i = 0; i < hoverPool.length; i++) {
      if (hoverPool[i].paused || hoverPool[i].ended) {
        return hoverPool[i];
      }
    }
    const a = new Audio(HOVER_SOUND_SRC);
    a.volume = isMuted ? 0 : HOVER_VOLUME;
    hoverPool.push(a);
    return a;
  }

  // Play button hover sound
  let lastHoverTime = 0;
  function playHoverSound() {
    if (isMuted) return;

    const now = performance.now();
    if (now - lastHoverTime < 40) return;
    lastHoverTime = now;

    if (audioCtx && hoverBuffer) {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      try {
        const source = audioCtx.createBufferSource();
        source.buffer = hoverBuffer;
        source.connect(hoverGainNode);
        source.start(0);
        return;
      } catch (e) {}
    }

    try {
      const audio = getFallbackHoverAudio();
      audio.currentTime = 0;
      audio.volume = isMuted ? 0 : HOVER_VOLUME;
      audio.play().catch(() => {});
    } catch (e) {}
  }

  // Initialize background music
  function initBgMusic() {
    if (bgAudio) return;
    bgAudio = new Audio(BG_MUSIC_SRC);
    bgAudio.loop = true;
    bgAudio.preload = 'auto';
    bgAudio.volume = 0;

    let lastSave = 0;
    bgAudio.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (now - lastSave > 250) {
        lastSave = now;
        savePlaybackState();
      }
    });

    window.addEventListener('beforeunload', savePlaybackState);
    window.addEventListener('pagehide', savePlaybackState);
  }

  // Smooth volume fading helper
  function fadeAudioTo(targetVolume, durationMs, onComplete) {
    if (!bgAudio) return;
    clearInterval(fadeInterval);
    const startVolume = bgAudio.volume;
    const diff = targetVolume - startVolume;
    const steps = 25;
    const stepInterval = durationMs / steps;
    let step = 0;

    fadeInterval = setInterval(() => {
      step++;
      const progress = step / steps;
      const ease = 1 - Math.pow(1 - progress, 3);
      bgAudio.volume = Math.max(0, Math.min(1, startVolume + diff * ease));

      if (step >= steps) {
        clearInterval(fadeInterval);
        bgAudio.volume = targetVolume;
        if (onComplete) onComplete();
      }
    }, stepInterval);
  }

  // Central attempt to start/unmute and play audio
  function tryPlayAudio(isContinuation = false, seekTime = 0) {
    if (isMuted) return;
    initBgMusic();
    initAudioContext();
    if (!hoverBuffer) loadHoverSound();

    if (seekTime > 0) {
      applySeekTime(seekTime);
    }

    bgAudio.muted = false;

    if (isContinuation) {
      bgAudio.volume = TARGET_BG_VOLUME;
    }

    const playPromise = bgAudio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          isPlaying = true;
          if (!isContinuation) {
            fadeAudioTo(TARGET_BG_VOLUME, 1000);
          }
          updateUIState(true);
          savePlaybackState();
          // Audio is playing with sound! Remove activation listeners
          removeActivationListeners();
        })
        .catch(() => {
          // Browser rejected unmuted playback (waiting for user interaction)
          isPlaying = false;
          updateUIState(false);
          // Keep activation listeners active so any movement or click immediately plays!
          setupActivationListeners();
        });
    }
  }

  // Global activation listeners on window & document
  const ACTIVATION_EVENTS = [
    'pointerdown', 'mousedown', 'click', 'pointerup', 'mouseup',
    'touchstart', 'touchend',
    'keydown',
    'wheel', 'scroll',
    'pointermove', 'mousemove', 'mouseover'
  ];

  function onAnyUserActivity() {
    if (isMuted || isPlaying) return;
    userInteracted = true;
    const resume = getContinuousResumePosition();
    tryPlayAudio(resume.shouldResume, resume.seekTime);
  }

  function setupActivationListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    ACTIVATION_EVENTS.forEach(evt => {
      window.addEventListener(evt, onAnyUserActivity, { capture: true, passive: true });
      document.addEventListener(evt, onAnyUserActivity, { capture: true, passive: true });
    });
  }

  function removeActivationListeners() {
    if (!listenersAttached) return;
    ACTIVATION_EVENTS.forEach(evt => {
      window.removeEventListener(evt, onAnyUserActivity, { capture: true });
      document.removeEventListener(evt, onAnyUserActivity, { capture: true });
    });
    listenersAttached = false;
  }

  // Stop / pause background music with smooth fade-out
  function stopBgMusic(immediate = false) {
    if (!bgAudio) return;
    savePlaybackState();
    if (immediate) {
      clearInterval(fadeInterval);
      bgAudio.pause();
      bgAudio.volume = 0;
      isPlaying = false;
      updateUIState(false);
    } else {
      fadeAudioTo(0, 350, () => {
        bgAudio.pause();
        isPlaying = false;
        updateUIState(false);
      });
    }
  }

  // Tab visibility detection (pause when hidden, resume continuous when visible)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (bgAudio && !bgAudio.paused) {
        savePlaybackState();
        bgAudio.pause();
      }
    } else {
      if (!isMuted && userInteracted && bgAudio && bgAudio.paused) {
        const resume = getContinuousResumePosition();
        if (resume.seekTime > 0) {
          applySeekTime(resume.seekTime);
        }
        bgAudio.play().then(() => {
          fadeAudioTo(TARGET_BG_VOLUME, 800);
        }).catch(() => {});
      }
    }
  });

  // Track page transitions via links
  document.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    
    // If navigating to a project / case study page, stop music immediately
    if (/(transportation|kamo-ai|kamoai|savw|design-research)/i.test(href)) {
      try {
        sessionStorage.setItem('portfolio_music_was_playing', 'false');
        localStorage.setItem('portfolio_music_was_playing', 'false');
      } catch (e) {}
      if (bgAudio) {
        stopBgMusic(true);
      }
      return;
    }

    // If navigating between portfolio pages (e.g. index -> about -> work), save exact position
    if (bgAudio && !bgAudio.paused) {
      savePlaybackState();
    }
  }, { capture: true });

  // Attach hover sounds to buttons across the portfolio (with specific exclusions)
  function setupButtonHoverListeners() {
    const BUTTON_SELECTORS = [
      'button',
      'a.btn-contact',
      'a.about-cta-btn',
      'a.nav-pill-btn',
      'a.btn-view-more',
      'a.spec-link-btn',
      'a.projects-more-btn',
      'a[class*="btn"]',
      'button[class*="btn"]',
      '[role="button"]',
      '.prototype-action-btn',
      '.raw-files-action-btn',
      '.project-action-btn'
    ].join(',');

    document.addEventListener('mouseover', e => {
      const target = e.target;
      if (!target) return;
      const btn = target.closest(BUTTON_SELECTORS);
      if (!btn) return;

      // 1. Exclude the sound toggle button itself
      if (btn.closest('#portfolioSoundToggle, .portfolio-sound-pill')) {
        return;
      }

      // 2. Exclude nav links (Work, About, Resume) - KEEP .btn-contact ("Work with me")
      if (btn.classList.contains('nav-link') || (btn.closest('.navbar') && !btn.classList.contains('btn-contact'))) {
        return;
      }

      // 3. Exclude the entire Experience & Honors section
      if (btn.closest('#experience, .experience-section, .experience-stack-track, .experience-content-wrapper, .experience-milestones-list')) {
        return;
      }

      const related = e.relatedTarget;
      if (related && btn.contains(related)) return;

      playHoverSound();
    }, { passive: true });
  }

  // Inject Floating Sound Toggle Widget UI into DOM
  let toggleBtn = null;
  function injectSoundToggleUI() {
    if (document.getElementById('portfolioSoundToggle')) return;

    toggleBtn = document.createElement('button');
    toggleBtn.id = 'portfolioSoundToggle';
    toggleBtn.className = 'portfolio-sound-pill';
    toggleBtn.setAttribute('type', 'button');
    toggleBtn.setAttribute('aria-label', 'Toggle Ambient Sound');
    toggleBtn.title = 'Sound Experience (Click anywhere on page to play, or press M)';

    toggleBtn.innerHTML = `
      <div class="sound-bars">
        <span class="bar bar-1"></span>
        <span class="bar bar-2"></span>
        <span class="bar bar-3"></span>
        <span class="bar bar-4"></span>
      </div>
      <span class="sound-label">Sound On</span>
    `;

    toggleBtn.addEventListener('click', e => {
      e.stopPropagation();
      userInteracted = true;
      initAudioContext();
      if (!hoverBuffer) loadHoverSound();

      if (isMuted) {
        isMuted = false;
        try { localStorage.setItem('portfolio_sound_muted', 'false'); } catch (err) {}
        tryPlayAudio();
        playHoverSound();
      } else if (!isPlaying || (bgAudio && bgAudio.paused)) {
        // Force play immediately!
        if (bgAudio) bgAudio.muted = false;
        const resume = getContinuousResumePosition();
        tryPlayAudio(resume.shouldResume, resume.seekTime);
        playHoverSound();
      } else {
        // Was playing -> Mute it
        isMuted = true;
        try { localStorage.setItem('portfolio_sound_muted', 'true'); } catch (err) {}
        stopBgMusic(false);
      }
    });

    document.body.appendChild(toggleBtn);
    updateUIState(!isMuted && isPlaying);
  }

  // Update visual state of the Sound Toggle button
  function updateUIState(active) {
    if (!toggleBtn) return;
    if (isMuted) {
      toggleBtn.classList.add('is-muted');
      toggleBtn.classList.remove('is-playing');
      const label = toggleBtn.querySelector('.sound-label');
      if (label) label.textContent = 'Muted';
    } else {
      toggleBtn.classList.remove('is-muted');
      if (active) {
        toggleBtn.classList.add('is-playing');
        const label = toggleBtn.querySelector('.sound-label');
        if (label) label.textContent = 'Sound On';
      } else {
        toggleBtn.classList.remove('is-playing');
        const label = toggleBtn.querySelector('.sound-label');
        if (label) label.textContent = 'Sound On';
      }
    }
  }

  // Keyboard shortcut 'M' to mute/unmute
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
      return;
    }
    if (e.key === 'm' || e.key === 'M') {
      if (toggleBtn) toggleBtn.click();
    }
  });

  // Startup initialization
  function init() {
    setupButtonHoverListeners();
    setupActivationListeners();

    if (document.body) {
      injectSoundToggleUI();
    } else {
      document.addEventListener('DOMContentLoaded', injectSoundToggleUI);
    }

    if (!isMuted) {
      const resume = getContinuousResumePosition();
      tryPlayAudio(resume.shouldResume, resume.seekTime);
    } else {
      updateUIState(false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
