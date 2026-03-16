/**
 * NOVA AI Changelog
 * Version history and feature tracking
 */

(function() {
  'use strict';
  
  window.NOVA_CHANGELOG = {
    currentVersion: '2.0.0',
    lastUpdated: '2025-01-20',
    
    versions: [
      {
        version: '2.0.0',
        date: '2025-01-20',
        title: 'Major Feature Update',
        features: [
          {
            category: 'Core AI',
            items: [
              'Multi-Model Mode - Compare responses from multiple AIs simultaneously',
              'AI Personalities - 5 specialized personas: NOVA, CodeMaster, Muse, Sage, Insight',
              'Vision for All - Image support across OpenAI, Claude, Gemini, Ollama',
              'Enhanced Memory - AI automatically extracts and remembers user facts'
            ]
          },
          {
            category: 'Search & Knowledge',
            items: [
              'Web Search v2 - Tavily, SerpAPI, DuckDuckGo with citations',
              'Document RAG - Upload documents for AI knowledge base',
              'Code Execution - Run Python/JavaScript directly in chat'
            ]
          },
          {
            category: 'Chat Management',
            items: [
              'Chat Persistence - Auto-sync conversations to database',
              'Chat Sharing - Generate shareable conversation links',
              'Chat Folders - Organize with Work, Personal, Coding, Ideas, Archive',
              'Export Chats - Download as JSON, Markdown, or Text',
              'Chat Tags - Label and categorize conversations'
            ]
          },
          {
            category: 'UI/UX',
            items: [
              'Theme Toggle - Quick switch between Dark, Light, Ocean, Sunset themes',
              'Keyboard Shortcuts - Power user key combos (Ctrl+H for help)',
              'Smooth Animations - Floating icons, slide transitions, hover effects',
              'Mobile Improvements - Better responsive design'
            ]
          },
          {
            category: 'Plugins & Extensibility',
            items: [
              'Plugin System - Modular architecture with tool registration',
              'Built-in Plugins - Calculator, Weather, Dictionary, News',
              'Plugin Manager - Enable/disable plugins with UI',
              'AI Chat Integration - Plugins can provide tools to AI'
            ]
          },
          {
            category: 'Voice & Input',
            items: [
              'Voice Input - Speech-to-text in message input',
              'Text-to-Speech - AI reads responses aloud',
              'File Upload v2 - Better PDF extraction, code file parsing',
              'Drag & Drop - Drop files directly into chat'
            ]
          }
        ]
      },
      {
        version: '1.5.0',
        date: '2025-01-15',
        title: 'Plugin System & Streaming',
        features: [
          {
            category: 'Performance',
            items: [
              'Streaming Responses - Real-time Ollama output',
              'Faster Message Rendering - Optimized DOM updates'
            ]
          },
          {
            category: 'Local AI',
            items: [
              'Ollama Integration - Run AI locally',
              'Model Management - Add/remove local models',
              'CORS Support - Cross-origin configuration'
            ]
          },
          {
            category: 'Plugins',
            items: [
              'Plugin Architecture - Register, enable, disable',
              'Built-in Plugins - Calculator, Weather, Dictionary',
              'Plugin Marketplace foundation'
            ]
          }
        ]
      },
      {
        version: '1.0.0',
        date: '2025-01-10',
        title: 'Initial Release',
        features: [
          {
            category: 'Core',
            items: [
              'Multi-Provider Support - OpenAI, Anthropic, Google, Groq',
              'Chat History - Local storage with search',
              'System Prompts - Customizable AI behavior',
              'Image Attachments - Vision model support',
              'Mobile & Desktop - Responsive design',
              'Settings Panel - API key management'
            ]
          }
        ]
      }
    ],
    
    // Get current version info
    getCurrent() {
      return this.versions[0];
    },
    
    // Get all features as flat list
    getAllFeatures() {
      const features = [];
      this.versions.forEach(v => {
        v.features.forEach(cat => {
          cat.items.forEach(item => {
            features.push({
              version: v.version,
              category: cat.category,
              feature: item,
              date: v.date
            });
          });
        });
      });
      return features;
    },
    
    // Check if version was seen
    isNewVersion() {
      const seen = localStorage.getItem('nova_changelog_seen');
      return seen !== this.currentVersion;
    },
    
    // Mark as seen
    markSeen() {
      localStorage.setItem('nova_changelog_seen', this.currentVersion);
    }
  };
  
  console.log('[Changelog] v' + window.NOVA_CHANGELOG.currentVersion + ' loaded');
})();
