/**
 * Video Analysis - Extract frames, transcript, analyze content
 */

(function() {
  'use strict';

  const VideoAnalysis = {
    // Extract frames from video
    async extractFrames(videoFile, intervalSeconds = 5) {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const frames = [];
        
        video.src = URL.createObjectURL(videoFile);
        video.muted = true;
        
        video.onloadedmetadata = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const duration = video.duration;
          let currentTime = 0;
          
          const captureFrame = () => {
            if (currentTime > duration) {
              URL.revokeObjectURL(video.src);
              resolve({
                totalFrames: frames.length,
                duration,
                frames: frames.slice(0, 10) // Limit to 10 frames
              });
              return;
            }
            
            video.currentTime = currentTime;
            currentTime += intervalSeconds;
          };
          
          video.onseeked = () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frameData = canvas.toDataURL('image/jpeg', 0.5);
            frames.push({
              time: video.currentTime,
              data: frameData
            });
            captureFrame();
          };
          
          captureFrame();
        };
        
        video.onerror = reject;
      });
    },

    // Get video info
    async getInfo(videoFile) {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(video.src);
          resolve({
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight,
            size: videoFile.size,
            type: videoFile.type
          });
        };
        
        video.src = URL.createObjectURL(videoFile);
      });
    },

    // Format for AI
    formatForAI(info, frames) {
      return `\n\n=== VIDEO ANALYSIS ===\n` +
        `Duration: ${Math.round(info.duration)}s\n` +
        `Resolution: ${info.width}x${info.height}\n` +
        `Size: ${Math.round(info.size / 1024 / 1024)}MB\n` +
        `Frames extracted: ${frames.totalFrames}\n` +
        `\n[Video content analysis would include frame descriptions]\n` +
        `=== END VIDEO ===`;
    }
  };

  window.VideoAnalysis = VideoAnalysis;

  // Handle video upload
  const originalHandleFileUpload = window.handleFileUpload;
  window.handleFileUpload = async function(event, platform) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      showToast('Analyzing video...');
      
      try {
        const info = await VideoAnalysis.getInfo(file);
        const frames = await VideoAnalysis.extractFrames(file, 10);
        const formatted = VideoAnalysis.formatForAI(info, frames);
        
        const input = document.getElementById(platform + '-msg-input');
        if (input) {
          input.value = `[Video Analysis]\n${formatted}\n\n${input.value}`;
          autoResize(input);
        }
        
        showToast('Video analyzed!');
        return;
      } catch (err) {
        showToast('Video analysis failed', 'error');
      }
    }

    if (originalHandleFileUpload) {
      return originalHandleFileUpload(event, platform);
    }
  };

  console.log('[Video Analysis] Module loaded');
})();
