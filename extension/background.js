// 설치/업데이트 시: 도구 모음 아이콘 클릭 → 옆 패널(side panel)로 열기
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
});
