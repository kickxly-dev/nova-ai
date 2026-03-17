/**
 * Knowledge Graph - Advanced memory system
 */

(function() {
  'use strict';

  const KnowledgeGraph = {
    // Initialize graph from localStorage
    init() {
      if (!localStorage.getItem('nova_knowledge_graph')) {
        localStorage.setItem('nova_knowledge_graph', JSON.stringify({
          nodes: [],
          edges: [],
          version: 1
        }));
      }
    },

    // Get graph data
    getGraph() {
      return JSON.parse(localStorage.getItem('nova_knowledge_graph') || '{"nodes":[],"edges":[]}');
    },

    // Save graph
    saveGraph(graph) {
      localStorage.setItem('nova_knowledge_graph', JSON.stringify(graph));
    },

    // Add entity node
    addEntity(name, type, metadata = {}) {
      const graph = this.getGraph();
      const existing = graph.nodes.find(n => n.name.toLowerCase() === name.toLowerCase());
      
      if (existing) {
        existing.mentions = (existing.mentions || 1) + 1;
        existing.lastUpdated = Date.now();
        existing.metadata = { ...existing.metadata, ...metadata };
      } else {
        graph.nodes.push({
          id: 'entity_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          name,
          type,
          mentions: 1,
          created: Date.now(),
          lastUpdated: Date.now(),
          metadata
        });
      }
      
      this.saveGraph(graph);
      return existing || graph.nodes[graph.nodes.length - 1];
    },

    // Add relationship
    addRelationship(fromId, toId, relationship, strength = 1) {
      const graph = this.getGraph();
      const existing = graph.edges.find(e => 
        e.from === fromId && e.to === toId && e.relationship === relationship
      );
      
      if (existing) {
        existing.strength += strength;
        existing.lastUpdated = Date.now();
      } else {
        graph.edges.push({
          id: 'edge_' + Date.now(),
          from: fromId,
          to: toId,
          relationship,
          strength,
          created: Date.now()
        });
      }
      
      this.saveGraph(graph);
    },

    // Extract entities from text
    extractEntities(text) {
      const entities = [];
      
      // Person patterns
      const personPatterns = /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g;
      let match;
      while ((match = personPatterns.exec(text)) !== null) {
        entities.push({ name: match[1], type: 'person' });
      }
      
      // Company/Organization
      const orgPatterns = /\b(Google|Microsoft|Apple|Amazon|Meta|OpenAI|Anthropic|NVIDIA|SpaceX|Tesla|Netflix|Stripe|Shopify|Uber|Airbnb)\b/g;
      while ((match = orgPatterns.exec(text)) !== null) {
        entities.push({ name: match[1], type: 'organization' });
      }
      
      // Technologies
      const techPatterns = /\b(JavaScript|Python|TypeScript|React|Vue|Angular|Node\.?js|Docker|Kubernetes|AWS|Azure|GCP|OpenAI|GPT-4|Claude)\b/gi;
      while ((match = techPatterns.exec(text)) !== null) {
        entities.push({ name: match[1], type: 'technology' });
      }
      
      // Projects (words in quotes or ALL CAPS)
      const projectPatterns = /"([^"]+)"|PROJECT: ([^\s]+)/g;
      while ((match = projectPatterns.exec(text)) !== null) {
        const name = match[1] || match[2];
        if (name) entities.push({ name, type: 'project' });
      }
      
      return entities;
    },

    // Learn from conversation
    learn(userMsg, aiMsg) {
      const text = userMsg + ' ' + aiMsg;
      const entities = this.extractEntities(text);
      
      const nodeIds = [];
      for (const entity of entities) {
        const node = this.addEntity(entity.name, entity.type);
        nodeIds.push(node.id);
      }
      
      // Create relationships between entities in same conversation
      for (let i = 0; i < nodeIds.length; i++) {
        for (let j = i + 1; j < nodeIds.length; j++) {
          this.addRelationship(nodeIds[i], nodeIds[j], 'mentioned_with', 0.5);
        }
      }
      
      // Extract and store facts
      this.extractFacts(text);
    },

    // Extract simple facts (X is Y patterns)
    extractFacts(text) {
      const factPatterns = [
        /([A-Z][a-z]+) is (?:a|an) ([a-z]+)/gi,
        /([A-Z][a-z]+) works at ([A-Z][a-z]+)/gi,
        /([A-Z][a-z]+) likes? ([a-z]+)/gi,
        /([A-Z][a-z]+) prefers? ([a-z]+)/gi
      ];
      
      for (const pattern of factPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const subject = match[1];
          const object = match[2];
          
          const subjectNode = this.addEntity(subject, 'person');
          const objectNode = this.addEntity(object, 'concept');
          
          this.addRelationship(subjectNode.id, objectNode.id, 'has_property', 1);
        }
      }
    },

    // Query knowledge
    query(query) {
      const graph = this.getGraph();
      const results = [];
      
      // Find matching nodes
      const queryLower = query.toLowerCase();
      const matchingNodes = graph.nodes.filter(n => 
        n.name.toLowerCase().includes(queryLower) ||
        n.type.toLowerCase().includes(queryLower)
      );
      
      for (const node of matchingNodes) {
        // Find connected nodes
        const related = graph.edges
          .filter(e => e.from === node.id || e.to === node.id)
          .map(e => {
            const otherId = e.from === node.id ? e.to : e.from;
            const otherNode = graph.nodes.find(n => n.id === otherId);
            return {
              relationship: e.relationship,
              node: otherNode,
              strength: e.strength
            };
          })
          .filter(r => r.node)
          .sort((a, b) => b.strength - a.strength);
        
        results.push({
          node,
          related: related.slice(0, 5)
        });
      }
      
      return results;
    },

    // Get summary for AI context
    getContextForAI(topic = null) {
      const graph = this.getGraph();
      
      // Get most mentioned entities
      const topEntities = graph.nodes
        .sort((a, b) => (b.mentions || 0) - (a.mentions || 0))
        .slice(0, 20);
      
      if (topEntities.length === 0) return '';
      
      let context = '\n\n=== KNOWLEDGE GRAPH (Learned from conversations) ===\n';
      
      for (const entity of topEntities) {
        context += `\n${entity.name} (${entity.type})`;
        
        // Get relationships
        const related = graph.edges
          .filter(e => e.from === entity.id || e.to === entity.id)
          .slice(0, 3);
        
        for (const edge of related) {
          const otherId = edge.from === entity.id ? edge.to : edge.from;
          const other = graph.nodes.find(n => n.id === otherId);
          if (other) {
            context += `\n  → ${edge.relationship} ${other.name}`;
          }
        }
      }
      
      context += '\n=== END KNOWLEDGE ===';
      return context;
    },

    // Visualize graph (simple HTML representation)
    visualize() {
      const graph = this.getGraph();
      let html = '<div style="padding: 20px; font-family: var(--mono);">';
      html += '<h3>Knowledge Graph</h3>';
      html += '<div style="display: grid; grid-template-columns: 1fr; gap: 12px;">';
      
      for (const node of graph.nodes.slice(0, 50)) {
        const color = {
          person: '#3b82f6',
          organization: '#10b981',
          technology: '#f59e0b',
          project: '#ec4899',
          concept: '#8b5cf6'
        }[node.type] || '#6b7280';
        
        html += `
          <div style="padding: 12px; background: var(--surface2); border-radius: var(--radius-sm); border-left: 3px solid ${color};">
            <div style="font-weight: 600; color: var(--text);">${node.name}</div>
            <div style="font-size: 11px; color: ${color};">${node.type} • mentioned ${node.mentions} times</div>
          </div>
        `;
      }
      
      html += '</div></div>';
      return html;
    },

    // Export graph
    export() {
      return JSON.stringify(this.getGraph(), null, 2);
    },

    // Import graph
    import(json) {
      try {
        const data = JSON.parse(json);
        this.saveGraph(data);
        return true;
      } catch (e) {
        return false;
      }
    },

    // Clear graph
    clear() {
      localStorage.removeItem('nova_knowledge_graph');
      this.init();
    }
  };

  // Auto-initialize
  KnowledgeGraph.init();

  // Expose globally
  window.KnowledgeGraph = KnowledgeGraph;

  // Hook into conversation learning
  const originalLearn = window.learnFromConversation;
  window.learnFromConversation = function(userMsg, aiMsg) {
    // Call original
    if (originalLearn) originalLearn(userMsg, aiMsg);
    
    // Also learn to knowledge graph
    KnowledgeGraph.learn(userMsg, aiMsg);
  };

  // Add to system prompt
  const originalGetSystemPrompt = window.getEnhancedSystemPrompt;
  window.getEnhancedSystemPrompt = function() {
    let prompt = originalGetSystemPrompt ? originalGetSystemPrompt() : '';
    prompt += KnowledgeGraph.getContextForAI();
    return prompt;
  };

  console.log('[Knowledge Graph] Module loaded - Advanced memory system');
})();
