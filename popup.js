/**
 * FAP GPA Calculator - Popup Script
 */

document.addEventListener('DOMContentLoaded', () => {
  const activeState = document.getElementById('active-state');
  const inactiveState = document.getElementById('inactive-state');

  const valGpa10 = document.getElementById('val-gpa10');
  const valGpa4 = document.getElementById('val-gpa4');
  const valClassification = document.getElementById('val-classification');
  const valCredits = document.getElementById('val-credits');
  const valGradedCredits = document.getElementById('val-graded-credits');

  const btnCopy = document.getElementById('btn-copy');
  const btnScroll = document.getElementById('btn-scroll');
  const btnOpenFap = document.getElementById('btn-open-fap');

  let currentStats = null;

  // Query current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) return;
    const currentTab = tabs[0];
    const url = currentTab.url || '';

    // Check if on FAP transcript page
    if (url.includes('fpt.edu.vn') && url.includes('Transcript')) {
      chrome.tabs.sendMessage(currentTab.id, { action: 'GET_GPA_DATA' }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          // If content script was not injected or not ready, show inactive or fallback
          showInactive();
          return;
        }

        currentStats = response.stats;
        showActive(currentStats);
      });
    } else {
      showInactive();
    }
  });

  function showActive(stats) {
    activeState.style.display = 'block';
    inactiveState.style.display = 'none';

    valGpa10.textContent = stats.gpa10;
    valGpa4.textContent = stats.gpa4;
    valClassification.textContent = `${stats.classification.icon} ${stats.classification.title}`;
    valCredits.textContent = `${stats.totalPassedCredits} / ${stats.totalCurriculumCredits} TC`;
    valGradedCredits.textContent = `${stats.gradedCredits} TC`;
  }

  function showInactive() {
    activeState.style.display = 'none';
    inactiveState.style.display = 'block';
  }

  // Event: Open FAP
  if (btnOpenFap) {
    btnOpenFap.onclick = () => {
      chrome.tabs.create({ url: 'https://fap.fpt.edu.vn/Report/Transcript' });
    };
  }

  // Event: Scroll to dashboard
  if (btnScroll) {
    btnScroll.onclick = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'SCROLL_TO_DASHBOARD' });
        }
      });
    };
  }

  // Event: Copy summary
  if (btnCopy) {
    btnCopy.onclick = () => {
      if (!currentStats) return;
      const text = `=== BÁO CÁO GPA FPT UNIVERSITY ===\n` +
        `• GPA Tích lũy (Hệ 10): ${currentStats.gpa10}\n` +
        `• GPA Quy đổi (Hệ 4): ${currentStats.gpa4}\n` +
        `• Xếp loại học lực: ${currentStats.classification.title}\n` +
        `• Tín chỉ đã tích lũy: ${currentStats.totalPassedCredits} / ${currentStats.totalCurriculumCredits} TC\n` +
        `• Tín chỉ tính điểm: ${currentStats.gradedCredits} TC\n` +
        `==================================`;
      navigator.clipboard.writeText(text).then(() => {
        btnCopy.textContent = '✅ Đã sao chép!';
        setTimeout(() => { btnCopy.textContent = '📋 Sao chép báo cáo GPA'; }, 2000);
      });
    };
  }
});
