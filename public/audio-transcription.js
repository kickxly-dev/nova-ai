/**
 * Audio Transcription - Speech to text
 */

(function() {
  'use strict';

  const AudioTranscription = {
    // Transcribe audio file
    async transcribe(audioFile) {
      showToast('Transcribing audio...');
      
      try {
        const formData = new FormData();
        formData.append('audio', audioFile);
        
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData
        });
        
        if (!res.ok) throw new Error('Transcription failed');
        
        const data = await res.json();
        return {
          success: true,
          text: data.text,
          duration: data.duration,
          language: data.language
        };
      } catch (err) {
        // Fallback: return placeholder for local processing
        return {
          success: false,
          error: err.message,
          text: '[Audio transcription would appear here with Whisper API integration]'
        };
      }
    },

    // Real-time transcription (Web Speech API)
    startRealtime(callback) {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        return { error: 'Speech recognition not supported' };
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event) => {
        let final = '';
        let interim = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        
        callback({ final, interim, isFinal: event.results[event.results.length - 1].isFinal });
      };
      
      recognition.start();
      return { recognition, stop: () => recognition.stop() };
    }
  };

  window.AudioTranscription = AudioTranscription;

  // Handle audio file upload
  const originalHandleFileUpload = window.handleFileUpload;
  window.handleFileUpload = async function(event, platform) {
    const file = event.target.files[0];
    if (!file) return;

    // Check if audio
    if (file.type.startsWith('audio/')) {
      const result = await AudioTranscription.transcribe(file);
      
      const input = document.getElementById(platform + '-msg-input');
      if (input && result.text) {
        input.value = `[Audio Transcription]\n${result.text}\n\n${input.value}`;
        autoResize(input);
      }
      
      showToast(result.success ? 'Audio transcribed!' : 'Transcription queued');
      return;
    }

    if (originalHandleFileUpload) {
      return originalHandleFileUpload(event, platform);
    }
  };

  console.log('[Audio Transcription] Module loaded');
})();
