const toggleUIState = (isEnabled) => {
  const statusText = document.getElementById('statusText');
  const statusPulse = document.getElementById('statusPulse');
  const indicatorContainer = document.querySelector('.status-indicator');

  if (isEnabled) {
    statusText.innerText = "Active & Guarding";
    statusPulse.classList.remove('inactive');
    indicatorContainer.classList.remove('inactive');
  } else {
    statusText.innerText = "Inactive";
    statusPulse.classList.add('inactive');
    indicatorContainer.classList.add('inactive');
  }
};

const updateDisplay = () => {
  chrome.storage.local.get(['isEnabled', 'adsSkipped', 'timeSaved', 'bannersBlocked'], (data) => {
    const isEnabled = data.isEnabled !== false; // Default is true
    document.getElementById('masterToggle').checked = isEnabled;
    
    // Update visual text/colors
    toggleUIState(isEnabled);

    document.getElementById('adsSkipped').innerText = parseInt(data.adsSkipped) || 0;
    document.getElementById('bannersBlocked').innerText = parseInt(data.bannersBlocked) || 0;
    
    // Format time securely
    let sec = parseInt(data.timeSaved) || 0;
    if (sec < 60) {
      document.getElementById('timeSaved').innerText = sec + 's';
    } else if (sec < 3600) {
      document.getElementById('timeSaved').innerText = Math.floor(sec / 60) + 'm ' + (sec % 60) + 's';
    } else {
      document.getElementById('timeSaved').innerText = (sec / 3600).toFixed(1) + 'h';
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  updateDisplay();
  
  // Listen for the user clicking the switch
  document.getElementById('masterToggle').addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    chrome.storage.local.set({ isEnabled: isChecked });
    toggleUIState(isChecked); // Instantly update the text/lights
  });
});

chrome.storage.onChanged.addListener(() => updateDisplay());