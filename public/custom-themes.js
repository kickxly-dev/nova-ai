/**
 * Custom Themes Module - User-defined colors
 */

(function() {
  'use strict';

  const CustomThemes = {
    // Default themes as base
    presets: {
      dark: { bg: '#09090b', surface: '#0f0f12', surface2: '#18181b', surface3: '#27272a', text: '#fafafa', text2: '#a1a1aa', muted: '#71717a', accent: '#8b5cf6', accent2: '#ec4899' },
      light: { bg: '#ffffff', surface: '#f4f4f5', surface2: '#e4e4e7', surface3: '#d4d4d8', text: '#18181b', text2: '#3f3f46', muted: '#71717a', accent: '#8b5cf6', accent2: '#ec4899' },
      ocean: { bg: '#0a192f', surface: '#112240', surface2: '#1d3557', surface3: '#264653', text: '#ccd6f6', text2: '#8892b0', muted: '#5a6a7a', accent: '#64ffda', accent2: '#00b4d8' },
      sunset: { bg: '#1a1423', surface: '#2d1f3d', surface2: '#3d2a4f', surface3: '#4d3561', text: '#f8e8d4', text2: '#d4b8a0', muted: '#a08070', accent: '#ff6b6b', accent2: '#f9c74f' },
      forest: { bg: '#0d1f0d', surface: '#1a2f1a', surface2: '#2a3f2a', surface3: '#3a4f3a', text: '#e8f5e8', text2: '#b8d4b8', muted: '#789078', accent: '#4ade80', accent2: '#22c55e' },
      midnight: { bg: '#020617', surface: '#0f172a', surface2: '#1e293b', surface3: '#334155', text: '#f8fafc', text2: '#94a3b8', muted: '#64748b', accent: '#38bdf8', accent2: '#818cf8' }
    },

    // Get custom themes
    getCustomThemes() {
      const saved = localStorage.getItem('nova_custom_themes');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch(e) {}
      }
      return [];
    },

    // Save custom theme
    saveCustomTheme(name, colors) {
      const themes = this.getCustomThemes();
      const id = 'custom_' + Date.now();
      themes.push({ id, name, colors, created: Date.now() });
      localStorage.setItem('nova_custom_themes', JSON.stringify(themes));
      return id;
    },

    // Delete custom theme
    deleteCustomTheme(id) {
      const themes = this.getCustomThemes().filter(t => t.id !== id);
      localStorage.setItem('nova_custom_themes', JSON.stringify(themes));
    },

    // Apply theme
    applyTheme(themeId) {
      let theme = this.presets[themeId];
      if (!theme) {
        const custom = this.getCustomThemes().find(t => t.id === themeId);
        if (custom) theme = custom.colors;
      }
      if (!theme) return false;

      const root = document.documentElement;
      Object.keys(theme).forEach(key => {
        root.style.setProperty('--' + key, theme[key]);
      });
      localStorage.setItem('nova_theme', themeId);
      return true;
    },

    // Get current theme colors
    getCurrentColors() {
      const current = localStorage.getItem('nova_theme') || 'dark';
      if (this.presets[current]) return this.presets[current];
      const custom = this.getCustomThemes().find(t => t.id === current);
      return custom ? custom.colors : this.presets.dark;
    },

    // Reset to default
    reset() {
      localStorage.removeItem('nova_theme');
      localStorage.removeItem('nova_custom_themes');
      this.applyTheme('dark');
    }
  };

  // Expose globally
  window.CustomThemes = CustomThemes;

  // Build theme selector UI
  window.buildThemeSelector = function() {
    const current = localStorage.getItem('nova_theme') || 'dark';
    let html = '<div class="theme-grid">';
    
    // Presets
    Object.entries(CustomThemes.presets).forEach(([id, colors]) => {
      const isActive = current === id;
      html += `<div class="theme-card ${isActive ? 'active' : ''}" onclick="CustomThemes.applyTheme('${id}')">`;
      html += `<div class="theme-preview" style="background:${colors.bg};border-color:${colors.accent}">`;
      html += `<div class="theme-dot" style="background:${colors.accent}"></div>`;
      html += `</div>`;
      html += `<div class="theme-name">${id.charAt(0).toUpperCase() + id.slice(1)}</div>`;
      html += `</div>`;
    });
    
    // Custom themes
    CustomThemes.getCustomThemes().forEach(theme => {
      const isActive = current === theme.id;
      const c = theme.colors;
      html += `<div class="theme-card ${isActive ? 'active' : ''}" onclick="CustomThemes.applyTheme('${theme.id}')">`;
      html += `<div class="theme-preview" style="background:${c.bg};border-color:${c.accent}">`;
      html += `<div class="theme-dot" style="background:${c.accent}"></div>`;
      html += `</div>`;
      html += `<div class="theme-name">${theme.name}</div>`;
      html += `<div class="theme-delete" onclick="event.stopPropagation();deleteCustomTheme('${theme.id}')">×</div>`;
      html += `</div>`;
    });
    
    // Add new button
    html += `<div class="theme-card theme-add" onclick="showCustomThemeBuilder()">`;
    html += `<div class="theme-preview" style="background:var(--surface2);border-style:dashed">+</div>`;
    html += `<div class="theme-name">Custom</div>`;
    html += `</div>`;
    
    html += '</div>';
    return html;
  };

  // Show custom theme builder
  window.showCustomThemeBuilder = function() {
    const colors = CustomThemes.getCurrentColors();
    const name = prompt('Theme name:', 'My Theme');
    if (!name) return;
    
    // Quick color picker for accent
    const accent = prompt('Accent color (hex):', colors.accent);
    if (!accent) return;
    
    // Create theme based on dark with custom accent
    const newTheme = {
      ...colors,
      accent: accent.startsWith('#') ? accent : '#' + accent
    };
    
    CustomThemes.saveCustomTheme(name, newTheme);
    CustomThemes.applyTheme(CustomThemes.getCustomThemes().slice(-1)[0].id);
    
    // Refresh UI if visible
    const themeTab = document.getElementById('tab-theme-tab');
    if (themeTab) {
      const grid = themeTab.querySelector('.theme-grid');
      if (grid) grid.outerHTML = window.buildThemeSelector();
    }
  };

  // Delete custom theme
  window.deleteCustomTheme = function(id) {
    if (confirm('Delete this theme?')) {
      CustomThemes.deleteCustomTheme(id);
      if (localStorage.getItem('nova_theme') === id) {
        CustomThemes.applyTheme('dark');
      }
      const themeTab = document.getElementById('tab-theme-tab');
      if (themeTab) {
        const grid = themeTab.querySelector('.theme-grid');
        if (grid) grid.outerHTML = window.buildThemeSelector();
      }
    }
  };

})();
