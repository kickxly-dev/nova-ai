/**
 * Repository Analysis - ZIP upload and code analysis
 */

(function() {
  'use strict';

  const RepoAnalysis = {
    // Analyze uploaded ZIP file
    async analyzeZip(file) {
      const JSZip = await this.loadJSZip();
      const zip = await JSZip.loadAsync(file);
      
      const structure = {
        files: [],
        directories: [],
        totalSize: 0,
        languages: {},
        entryPoints: [],
        configFiles: []
      };

      // Process all files
      const promises = [];
      zip.forEach((path, zipEntry) => {
        if (zipEntry.dir) {
          structure.directories.push(path);
        } else {
          structure.totalSize += zipEntry._data.uncompressedSize;
          
          const fileInfo = {
            path,
            size: zipEntry._data.uncompressedSize,
            extension: path.split('.').pop()?.toLowerCase()
          };
          
          structure.files.push(fileInfo);
          
          // Track languages
          const lang = this.detectLanguage(fileInfo.extension);
          if (lang) {
            structure.languages[lang] = (structure.languages[lang] || 0) + 1;
          }
          
          // Detect entry points
          if (this.isEntryPoint(path)) {
            structure.entryPoints.push(path);
          }
          
          // Track config files
          if (this.isConfigFile(path)) {
            structure.configFiles.push(path);
          }
          
          // Read content of important files
          if (this.shouldReadContent(path, fileInfo.size)) {
            promises.push(
              zipEntry.async('string').then(content => {
                fileInfo.content = content.slice(0, 5000); // Limit content
                fileInfo.preview = this.generatePreview(content, fileInfo.extension);
              }).catch(() => {
                // Binary file
              })
            );
          }
        }
      });

      await Promise.all(promises);

      // Generate analysis
      return {
        filename: file.name,
        ...structure,
        summary: this.generateSummary(structure),
        techStack: this.detectTechStack(structure),
        insights: this.generateInsights(structure)
      };
    },

    // Load JSZip library
    loadJSZip() {
      return new Promise((resolve, reject) => {
        if (window.JSZip) return resolve(window.JSZip);
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve(window.JSZip);
        script.onerror = reject;
        document.head.appendChild(script);
      });
    },

    // Detect language from extension
    detectLanguage(ext) {
      const langMap = {
        js: 'JavaScript', ts: 'TypeScript', jsx: 'React', tsx: 'React',
        py: 'Python', java: 'Java', cpp: 'C++', c: 'C', go: 'Go',
        rs: 'Rust', rb: 'Ruby', php: 'PHP', swift: 'Swift', kt: 'Kotlin',
        html: 'HTML', css: 'CSS', scss: 'SCSS', sass: 'Sass', less: 'Less',
        json: 'JSON', xml: 'XML', yaml: 'YAML', yml: 'YAML',
        md: 'Markdown', sql: 'SQL', sh: 'Shell', bash: 'Bash',
        dockerfile: 'Dockerfile', vue: 'Vue', svelte: 'Svelte'
      };
      return langMap[ext] || null;
    },

    // Check if file is entry point
    isEntryPoint(path) {
      const entryPatterns = [
        /index\.(js|ts|jsx|tsx|html|py)$/i,
        /main\.(js|ts|java|py|go)$/i,
        /app\.(js|ts|jsx|tsx)$/i,
        /server\.(js|ts|py)$/i,
        /package\.json$/i,
        /README\.md$/i
      ];
      return entryPatterns.some(p => p.test(path));
    },

    // Check if config file
    isConfigFile(path) {
      const configPatterns = [
        /package\.json$/, /tsconfig\.json$/, /webpack\.config\./,
        /\.eslintrc/, /\.prettierrc/, /docker-compose\.ya?ml$/,
        /Dockerfile$/, /\.gitignore$/, /\.env\.?/,
        /tailwind\.config\./, /vite\.config\./, /next\.config\./
      ];
      return configPatterns.some(p => p.test(path));
    },

    // Should we read this file's content
    shouldReadContent(path, size) {
      const readableExts = ['js', 'ts', 'jsx', 'tsx', 'py', 'json', 'md', 'html', 'css', 'yml', 'yaml', 'txt'];
      const ext = path.split('.').pop()?.toLowerCase();
      return readableExts.includes(ext) && size < 100000; // < 100KB
    },

    // Generate preview
    generatePreview(content, ext) {
      const lines = content.split('\n');
      let preview = '';
      
      // Show first 20 meaningful lines
      let count = 0;
      for (const line of lines) {
        if (line.trim()) {
          preview += line.slice(0, 80) + '\n';
          count++;
          if (count >= 20) break;
        }
      }
      
      return preview;
    },

    // Generate summary
    generateSummary(structure) {
      const topLangs = Object.entries(structure.languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      return {
        totalFiles: structure.files.length,
        totalDirs: structure.directories.length,
        sizeKB: Math.round(structure.totalSize / 1024),
        primaryLanguage: topLangs[0]?.[0] || 'Unknown',
        languages: topLangs
      };
    },

    // Detect tech stack
    detectTechStack(structure) {
      const stack = {
        framework: null,
        language: null,
        database: null,
        styling: null,
        buildTool: null,
        testing: null,
        deployment: null
      };

      // Check config files
      for (const file of structure.configFiles) {
        const lower = file.toLowerCase();
        
        if (lower.includes('package.json')) stack.language = 'JavaScript/TypeScript';
        if (lower.includes('requirements.txt') || lower.includes('pyproject.toml')) stack.language = 'Python';
        if (lower.includes('gemfile')) stack.language = 'Ruby';
        if (lower.includes('cargo.toml')) stack.language = 'Rust';
        if (lower.includes('go.mod')) stack.language = 'Go';
        
        if (lower.includes('next.config')) stack.framework = 'Next.js';
        if (lower.includes('nuxt.config')) stack.framework = 'Nuxt.js';
        if (lower.includes('vue.config')) stack.framework = 'Vue';
        if (lower.includes('angular.json')) stack.framework = 'Angular';
        if (lower.includes('svelte.config')) stack.framework = 'Svelte';
        if (lower.includes('gatsby-config')) stack.framework = 'Gatsby';
        if (lower.includes('astro.config')) stack.framework = 'Astro';
        
        if (lower.includes('tailwind')) stack.styling = 'Tailwind CSS';
        if (lower.includes('webpack')) stack.buildTool = 'Webpack';
        if (lower.includes('vite')) stack.buildTool = 'Vite';
        if (lower.includes('rollup')) stack.buildTool = 'Rollup';
        if (lower.includes('parcel')) stack.buildTool = 'Parcel';
        
        if (lower.includes('docker')) stack.deployment = 'Docker';
        if (lower.includes('kubernetes') || lower.includes('k8s')) stack.deployment = 'Kubernetes';
        
        if (lower.includes('jest')) stack.testing = 'Jest';
        if (lower.includes('cypress')) stack.testing = 'Cypress';
        if (lower.includes('playwright')) stack.testing = 'Playwright';
        if (lower.includes('vitest')) stack.testing = 'Vitest';
      }

      // Check for databases
      for (const file of structure.files) {
        const content = file.content || '';
        if (content.includes('mongoose') || content.includes('mongodb')) stack.database = 'MongoDB';
        if (content.includes('sequelize') || content.includes('pg') || content.includes('mysql')) stack.database = 'SQL';
        if (content.includes('prisma')) stack.database = 'Prisma';
        if (content.includes('firebase')) stack.database = 'Firebase';
        if (content.includes('supabase')) stack.database = 'Supabase';
      }

      return stack;
    },

    // Generate insights
    generateInsights(structure) {
      const insights = [];
      
      if (structure.files.length > 100) {
        insights.push('Large codebase with ' + structure.files.length + ' files');
      }
      
      if (Object.keys(structure.languages).length > 3) {
        insights.push('Polyglot project using ' + Object.keys(structure.languages).length + ' languages');
      }
      
      if (structure.entryPoints.length === 0) {
        insights.push('No clear entry points found - may be a library or config repo');
      }
      
      if (structure.configFiles.length > 5) {
        insights.push('Well-configured project with ' + structure.configFiles.length + ' config files');
      }

      // Check for tests
      const testFiles = structure.files.filter(f => 
        f.path.includes('.test.') || f.path.includes('.spec.') || f.path.includes('__tests__')
      );
      if (testFiles.length > 0) {
        insights.push('Has test suite with ' + testFiles.length + ' test files');
      }

      return insights;
    },

    // Format for AI
    formatForAI(analysis) {
      let text = `\n\n=== REPOSITORY ANALYSIS: ${analysis.filename} ===\n\n`;
      
      text += `**Overview:**\n`;
      text += `- Files: ${analysis.summary.totalFiles}\n`;
      text += `- Directories: ${analysis.summary.totalDirs}\n`;
      text += `- Size: ${analysis.summary.sizeKB} KB\n`;
      text += `- Primary Language: ${analysis.summary.primaryLanguage}\n\n`;
      
      text += `**Tech Stack:**\n`;
      Object.entries(analysis.techStack).forEach(([key, val]) => {
        if (val) text += `- ${key}: ${val}\n`;
      });
      text += `\n`;
      
      if (analysis.insights.length > 0) {
        text += `**Insights:**\n`;
        analysis.insights.forEach(i => text += `- ${i}\n`);
        text += `\n`;
      }
      
      if (analysis.summary.languages.length > 0) {
        text += `**Languages:**\n`;
        analysis.summary.languages.forEach(([lang, count]) => {
          text += `- ${lang}: ${count} files\n`;
        });
        text += `\n`;
      }
      
      if (analysis.entryPoints.length > 0) {
        text += `**Entry Points:**\n`;
        analysis.entryPoints.slice(0, 5).forEach(ep => text += `- ${ep}\n`);
        text += `\n`;
      }
      
      // Add preview of key files
      const keyFiles = analysis.files.filter(f => 
        f.preview && (f.path.includes('README') || f.path.includes('package.json') || 
        f.path.includes('App') || f.path.includes('index') || f.path.includes('main'))
      ).slice(0, 5);
      
      if (keyFiles.length > 0) {
        text += `**Key Files Preview:**\n\n`;
        keyFiles.forEach(f => {
          text += `--- ${f.path} ---\n${f.preview}\n\n`;
        });
      }
      
      text += `=== END REPOSITORY ANALYSIS ===`;
      
      return text;
    }
  };

  // Expose globally
  window.RepoAnalysis = RepoAnalysis;

  // Handle ZIP upload
  const originalFileUpload = window.handleFileUpload;
  window.handleFileUpload = async function(event, platform) {
    const file = event.target.files[0];
    if (!file) return;

    // Check if it's a ZIP
    if (file.name.endsWith('.zip') || file.type === 'application/zip') {
      showToast('Analyzing repository...');
      
      try {
        const analysis = await RepoAnalysis.analyzeZip(file);
        const formatted = RepoAnalysis.formatForAI(analysis);
        
        const input = document.getElementById(platform + '-msg-input');
        if (input) {
          input.value = formatted + '\n\n' + (input.value || '');
          autoResize(input);
        }
        
        showToast('Repository analyzed!');
        return;
      } catch (err) {
        showToast('Analysis failed: ' + err.message, 'error');
      }
    }

    // Fall back to original handler
    if (originalFileUpload) {
      return originalFileUpload(event, platform);
    }
  };

  console.log('[Repo Analysis] Module loaded - ZIP upload support');
})();
