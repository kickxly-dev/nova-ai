// Changelog Modal Component
(function() {
  // Changelog content
  const changelogHTML = `
    <div class="changelog-overlay" id="changelog-overlay" onclick="closeChangelogOutside(event)">
      <div class="changelog-box" onclick="event.stopPropagation()">
        <button class="changelog-close" onclick="closeChangelog()">&times;</button>
        <div class="changelog-header">
          <div class="changelog-icon">✨</div>
          <h2>What's New</h2>
          <p class="changelog-version">Version 1.0 - March 2026</p>
        </div>
        <div class="changelog-body">
          <div class="changelog-section">
            <h3>🖼️ Image Upload & Vision</h3>
            <ul>
              <li>Upload images for AI analysis - just click the paperclip!</li>
              <li>Visual thumbnail preview shows what you're sending</li>
              <li>Works with Ollama vision models (llava, moondream)</li>
            </ul>
          </div>
          <div class="changelog-section">
            <h3>🔐 User System</h3>
            <ul>
              <li>Sign in with Google to sync across devices</li>
              <li>Save API keys securely in your account</li>
              <li>Guest mode for quick access</li>
            </ul>
          </div>
          <div class="changelog-section">
            <h3>🎨 Better Mobile Experience</h3>
            <ul>
              <li>Responsive design optimized for phones</li>
              <li>Swipe-friendly chat interface</li>
              <li>Quick access drawer for chat history</li>
            </ul>
          </div>
          <div class="changelog-section">
            <h3>💻 Code Editor</h3>
            <ul>
              <li>Full-featured code editor with syntax highlighting</li>
              <li>Run JavaScript directly in browser</li>
              <li>AI-powered code assistance</li>
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
    const currentVersion = '1.0';
    return lastVersion !== currentVersion;
  }

  // Show the changelog
  function showChangelog() {
    const overlay = document.getElementById('changelog-overlay');
    if (overlay) {
      overlay.classList.add('active');
    }
  }

  // Close the changelog
  window.closeChangelog = function() {
    const overlay = document.getElementById('changelog-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
    // Mark as seen
    localStorage.setItem('nova_changelog_version', '1.0');
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
