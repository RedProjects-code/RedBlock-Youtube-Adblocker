let isEnabled = true;
let isHandlingAd = false;
let lastMainVideoTime = 0;
let adStuckTimer = null;
let bannerSessionCount = 0;
let preAdTime = null;

chrome.storage.local.get(['isEnabled'], (data) => { isEnabled = data.isEnabled !== false; });
chrome.storage.onChanged.addListener((changes) => { if (changes.isEnabled) isEnabled = changes.isEnabled.newValue; });

const createBlackoutOverlay = () => {
  let overlay = document.getElementById('premium-ad-blackout');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'premium-ad-blackout';
    overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: #000; z-index: 999999; display: none; align-items: center; 
      justify-content: center; color: #4facfe; font-family: sans-serif;
      flex-direction: column; pointer-events: none;
    `;
    overlay.innerHTML = `
      <div style="font-size: 28px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">Turbo Mode Active</div>
      <div id="turbo-status" style="font-size: 14px; color: #aaa; margin-top: 8px;">Skipping Interruption...</div>
    `;
    const player = document.querySelector('.html5-video-player');
    if (player) player.appendChild(overlay);
  }
  return overlay;
};

// --- SLAYER: Small Ads, Companion Banners, Promoted Tiles ---
const killSponsoredAds = () => {
  if (!isEnabled) return;
  let removedCount = 0;
  
  // Every possible selector for small/side/banner ads
  const selectors = [
    'ytd-ad-slot-renderer', 
    '#player-ads', 
    'ytd-promoted-video-renderer', 
    '#masthead-ad',
    '#panels:has(ytd-ads-engagement-panel-content-renderer)',
    '.ytd-companion-slot-renderer',
    'ytd-action-companion-ad-renderer',
    'ytd-banner-promo-renderer'
  ];

  selectors.forEach(s => {
    document.querySelectorAll(s).forEach(el => {
      el.remove();
      removedCount++;
    });
  });

  document.querySelectorAll('ytd-rich-item-renderer, ytd-compact-video-renderer').forEach(item => {
    // If it has the 'Sponsored' badge inside it
    if (item.querySelector('.badge-shape-wiz__text') && item.innerText.includes('Sponsored')) {
      item.remove();
      removedCount++;
    }
  });

  // Save to GUI if we destroyed banners
  if (removedCount > 0) {
    chrome.storage.local.get(['bannersBlocked'], (data) => {
      let current = parseInt(data.bannersBlocked) || 0;
      chrome.storage.local.set({ bannersBlocked: current + removedCount });
    });
  }
};

// --- MAIN ENGINE: Video Ads + Refresh ---
const turboSkip = () => {
  if (!isEnabled) return;

  const video = document.querySelector('video');
  const adShowing = document.querySelector('.ad-showing, .ad-interrupting');
  const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern');
  const overlay = createBlackoutOverlay();

  // 1. TRACK MAIN VIDEO TIME
  if (video && !adShowing) {
    if (!isNaN(video.currentTime) && video.currentTime > 0) {
      lastMainVideoTime = video.currentTime;
    }
    adStuckTimer = null; // Reset refresh timer
  }

  // 2. IF AD IS PLAYING
  if (adShowing && video) {
    if (overlay) overlay.style.display = 'flex';
    if (!adStuckTimer) adStuckTimer = Date.now();

    // Capture the pre-ad time only once (so we can resume correctly)
    if (preAdTime === null) {
      preAdTime = Math.floor(lastMainVideoTime) || Math.floor(video.currentTime) || 0;
    }

    // -- 5-SECOND REFRESH & RESUME GUARANTEE --
    if (Date.now() - adStuckTimer > 5000) {
      const turboStatusEl = document.getElementById('turbo-status');
      if (turboStatusEl) turboStatusEl.innerText = "Ad bypassed. Resuming video...";

      const url = new URL(window.location.href);
      // Use numeric seconds without the trailing 's' to be more compatible
      url.searchParams.set('t', String(preAdTime || 0));

      // Use replace() so we don't mess up the back button history
      window.location.replace(url.toString());
      return;
    }

    // -- TELEPORT LOGIC --
    video.muted = true;
    video.playbackRate = 16.0;

    let duration = parseInt(video.duration);
    if (!isNaN(duration) && duration > 0) {
      // Jump near the end so the player considers the ad finished
      try { video.currentTime = Math.max(0, duration - 0.1); } catch (e) { /* some players block setting time */ }
    }

    if (skipBtn) skipBtn.click();

    // -- STRICT NUMBER MATH FOR GUI STATS --
    if (!isHandlingAd) {
      isHandlingAd = true;
      let adDurationToSave = (!isNaN(duration) && duration > 0 && duration < 3600) ? duration : 15;

      chrome.storage.local.get(['adsSkipped', 'timeSaved'], (data) => {
        let currentAds = parseInt(data.adsSkipped) || 0;
        let currentTime = parseInt(data.timeSaved) || 0;

        chrome.storage.local.set({
          adsSkipped: currentAds + 1,
          timeSaved: currentTime + adDurationToSave
        });
      });
    }
  } else {
    // 3. CLEANUP AFTER AD
    if (isHandlingAd) {
      isHandlingAd = false;
      if (video) video.playbackRate = 1.0;
      if (overlay) overlay.style.display = 'none';
      const statusText = document.getElementById('turbo-status');
      if (statusText) statusText.innerText = "Skipping Interruption...";
      // restore audio
      try { if (video) video.muted = false; } catch (e) {}
      // reset captured pre-ad time
      preAdTime = null;
    }
  }
};

// Loop timers
setInterval(turboSkip, 250); 
setInterval(killSponsoredAds, 1000);