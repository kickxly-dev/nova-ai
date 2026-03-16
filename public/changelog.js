// Changelog Modal Component - Updated for v2.0
(function() {
  // Changelog content
  const changelogHTML = `
    <div class="changelog-overlay" id="changelog-overlay" onclick="closeChangelogOutside(event)">
      <div class="changelog-box" onclick="event.stopPropagation()">
        <button class="changelog-close" onclick="closeChangelog()">&times;</button>
        <div class="changelog-header">
          <div class="changelog-icon">🚀</div>
          <h2>What's New in NOVA 2.0</h2>
          <p class="changelog-version">Version 2.0 - Major Feature Update</p>
        </div>
        <div class="changelog-body">
          <div class="changelog-section">
            <h3>🎭 AI Personalities</h3>
            <ul>
              <li><strong>5 specialized personas:</strong> NOVA, CodeMaster, Muse, Sage, Insight</li>
              <li>Each with unique expertise and response style</li>
              <li>Click the sliders icon in the toolbar to switch</li>
            </ul>
          </div>
          <div class="changelog-section">
            <h3>🔍 Enhanced Web Search</h3>
            <ul>
              <li>Tavily, SerpAPI, and DuckDuckGo support</li>
              <li>Automatic citations with source links</li>
              <li>AI answers from real-time search results</li>
            </ul>
          </div>
          <div class="changelog-section">
            <h3>🔄 Multi-Model Mode</h3>
            <ul>
              <li>Ask multiple AIs at once and compare responses</li>
              <li>Compare GPT-4, Claude, Gemini side-by-side</li>
              <li>Click "Multi" in the toolbar to enable</li>
            </ul>
          </div>
          <div class="changelog-section">
            <h3>� Chat Persistence</h3>
            <ul>
              <li>Conversations auto-sync to database</li>
              <li>Access chats from any device</li>
              <li>Share chats with public links</li>
            </ul>
          </div>
          <div class="changelog-section">
            <h3>📁 Chat Organization</h3>
            <ul>
              <li><strong>Folders:</strong> Work, Personal, Coding, Ideas, Archive</li>
              <li>Right-click chats to organize</li>
              <li>Export as JSON, Markdown, or Text</li>
            </ul>
          </div>
          <div class="changelog-section">
            <h3>🧠 AI Memory</h3>
            <ul>
              <li>AI automatically remembers facts about you</li>
              <li>Name, location, interests, technologies</li>
              <li>Personalized responses over time</li>
            </ul>
          </div>
          <div class="changelog-section">
            <h3>🗣️ Voice Features</h3>
            <ul>
              <li>Speech-to-text input (microphone button)</li>
              <li>Text-to-speech for AI responses</li>
              <li>Toggle "TTS" in the toolbar</li>
            </ul>
          </div>
          <div class="changelog-section">
            <h3>🎨 Themes & Animations</h3>
            <ul>
              <li>4 themes: Dark, Light, Ocean, Sunset</li>
              <li>Click sun icon to toggle</li>
              <li>Smooth animations throughout UI</li>
            </ul>
          </div>
          <div class="changelog-section">
            <h3>⌨️ Keyboard Shortcuts</h3>
            <ul>
              <li><strong>Ctrl+N:</strong> New chat</li>
              <li><strong>Ctrl+K:</strong> Focus input</li>
              <li><strong>Ctrl+Shift+T:</strong> Toggle theme</li>
              <li><strong>Ctrl+H:</strong> View all shortcuts</li>
            </ul>
          </div>
          <div class="changelog-section">
            <h3>🔌 Plugin System</h3>
            <ul>
              <li>Calculator, Weather, Dictionary, News</li>
              <li>AI can use plugins automatically</li>
              <li>Manage plugins from sidebar</li>
            </ul>
          </div>
        </div>
        <div class="changelog-footer">
          <button class="changelog-btn" onclick="closeChangelog()">Got it!</button>
        </div>
      </div>
    </div>
  `;

  // Inject the modal into the page
  function injectChangelog() {
    const div = document.createElement('div');
    div.innerHTML = changelogHTML;
    document.body.appendChild(div.firstElementChild);
  }

  // Check if user has seen the changelog
  function shouldShowChangelog() {
    const lastVersion = localStorage.getItem('nova_changelog_version');
    const currentVersion = '2.0';
    return lastVersion !== currentVersion;
  }

  // Show the changelog
  window.showChangelog = function() {
    const overlay = document.getElementById('changelog-overlay');
    if (overlay) {
      overlay.classList.add('active');
    }
  };

  // Close the changelog
  window.closeChangelog = function() {
    const overlay = document.getElementById('changelog-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
    // Mark as seen
    localStorage.setItem('nova_changelog_version', '2.0');
    localStorage.setItem('nova_changelog_seen', Date.now().toString());
  };

  // Close when clicking outside
  window.closeChangelogOutside = function(e) {
    if (e.target.id === 'changelog-overlay') {
      closeChangelog();
    }
  };

  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    injectChangelog();
    // Show after a short delay if user hasn't seen it
    if (shouldShowChangelog()) {
      setTimeout(showChangelog, 1000);
    }
  }
})();
