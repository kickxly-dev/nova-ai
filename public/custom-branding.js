/**
 * Custom Branding - Enterprise branding options
 */

(function() {
  'use strict';

  const CustomBranding = {
    // Default branding
    defaults: {
      logoText: 'NOVA',
      logoSub: 'AI Assistant',
      primaryColor: '#8b5cf6',
      accentColor: '#ec4899',
      favicon: null,
      customCSS: '',
      watermark: false,
      poweredBy: true
    },

    // Get current branding
    get() {
      const saved = localStorage.getItem('nova_branding');
      return saved ? { ...this.defaults, ...JSON.parse(saved) } : this.defaults;
    },

    // Save branding
    save(settings) {
      localStorage.setItem('nova_branding', JSON.stringify({ ...this.get(), ...settings }));
      this.apply();
    },

    // Apply branding
    apply() {
      const branding = this.get();
      
      // Update logo text
      const logoTexts = document.querySelectorAll('#d-logo-text, #m-title');;
      logoTexts.forEach(el => {
        if (el) el.textContent = branding.logoText;
      });

      // Update logo sub
      const logoSubs = document.querySelectorAll('#d-logo-sub, #m-subtitle');
      logoSubs.forEach(el => {
        if (el) el.textContent = branding.logoSub;
      });

      // Update colors via CSS variables
      const root = document.documentElement;
      root.style.setProperty('--accent', branding.primaryColor);
      root.style.setProperty('--accent-light', this.lighten(branding.primaryColor, 20));
      root.style.setProperty('--accent2', branding.accentColor);

      // Apply custom CSS
      let customStyle = document.getElementById('custom-branding-css');
      if (!customStyle) {
        customStyle = document.createElement('style');
        customStyle.id = 'custom-branding-css';
        document.head.appendChild(customStyle);
      }
      customStyle.textContent = branding.customCSS;

      // Hide/show powered by
      const poweredBy = document.getElementById('powered-by');
      if (poweredBy) {
        poweredBy.style.display = branding.poweredBy ? 'block' : 'none';
      }
    },

    // Lighten color helper
    lighten(color, percent) {
      // Simple hex lighten
      const num = parseInt(color.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = (num >> 16) + amt;
      const G = (num >> 8 & 0x00FF) + amt;
      const B = (num & 0x0000FF) + amt;
      return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255))
        .toString(16).slice(1);
    },

    // Reset to defaults
    reset() {
      localStorage.removeItem('nova_branding');
      this.apply();
    }
  };

  window.CustomBranding = CustomBranding;

  // UI
  window.openBrandingModal = function() {
    const branding = CustomBranding.get();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.id = 'branding-modal';
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width: 500px;">
        <div class="modal-top"><h2>🎨 Custom Branding</h2><button class="modal-close" onclick="closeBrandingModal()">&times;</button></div>
        <div class="modal-body">
          <div style="display: grid; gap: 16px;">
            <div>
              <label style="display: block; margin-bottom: 6px; font-size: 12px; color: var(--muted);">Logo Text</label>
              <input type="text" id="brand-logo-text" value="${branding.logoText}" style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 6px; font-size: 12px; color: var(--muted);">Logo Subtitle</label>
              <input type="text" id="brand-logo-sub" value="${branding.logoSub}" style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text);">
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="display: block; margin-bottom: 6px; font-size: 12px; color: var(--muted);">Primary Color</label>
                <input type="color" id="brand-primary" value="${branding.primaryColor}" style="width: 100%; height: 40px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer;">
              </div>
              <div>
                <label style="display: block; margin-bottom: 6px; font-size: 12px; color: var(--muted);">Accent Color</label>
                <input type="color" id="brand-accent" value="${branding.accentColor}" style="width: 100%; height: 40px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer;">
              </div>
            </div>
            
            <div>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="brand-powered" ${branding.poweredBy ? 'checked' : ''}>
                <span>Show "Powered by NOVA"</span>
              </label>
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 6px; font-size: 12px; color: var(--muted);">Custom CSS</label>
              <textarea id="brand-css" rows="4" style="width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-family: var(--mono); font-size: 12px;">${branding.customCSS}</textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer" style="display: flex; justify-content: space-between; gap: 8px;">
          <button onclick="resetBranding()" style="padding: 8px 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--red); cursor: pointer;">Reset</button>
          <div style="display: flex; gap: 8px;">
            <button onclick="closeBrandingModal()" style="padding: 8px 16px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); cursor: pointer;">Cancel</button>
            <button onclick="saveBranding()" style="padding: 8px 16px; background: var(--accent); border: none; border-radius: var(--radius-sm); color: #000; font-weight: 600; cursor: pointer;">Save</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.closeBrandingModal = function() {
    const modal = document.getElementById('branding-modal');
    if (modal) modal.remove();
  };

  window.saveBranding = function() {
    const settings = {
      logoText: document.getElementById('brand-logo-text').value,
      logoSub: document.getElementById('brand-logo-sub').value,
      primaryColor: document.getElementById('brand-primary').value,
      accentColor: document.getElementById('brand-accent').value,
      poweredBy: document.getElementById('brand-powered').checked,
      customCSS: document.getElementById('brand-css').value
    };
    
    CustomBranding.save(settings);
    showToast('Branding saved!');
    closeBrandingModal();
  };

  window.resetBranding = function() {
    if (confirm('Reset all branding to defaults?')) {
      CustomBranding.reset();
      showToast('Branding reset');
      closeBrandingModal();
    }
  };

  // Apply on load
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => CustomBranding.apply(), 100);
  });

  // Add admin button
  window.addBrandingButton = function() {
    const adminPanel = document.querySelector('.admin-tabs');
    if (adminPanel) {
      const btn = document.createElement('button');
      btn.className = 'admin-tab';
      btn.textContent = 'Branding';
      btn.onclick = openBrandingModal;
      adminPanel.appendChild(btn);
    }
  };

  setTimeout(addBrandingButton, 7000);
  console.log('[Custom Branding] Module loaded');
})();
