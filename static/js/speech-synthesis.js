// Enhanced Speech Synthesis Utility Functions
const speechSynthesis = window.speechSynthesis;

// Initialize speech synthesis
export function initSpeechSynthesis() {
    if (!speechSynthesis) {
        console.error('Speech synthesis not supported');
        return false;
    }
    
    // Load voices
    if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.addEventListener('voiceschanged', () => {
            console.log('Voices loaded:', speechSynthesis.getVoices().length);
        });
    }
    
    return true;
}

// Speak text using speech synthesis with enhanced voice selection
export function speakText(text, options = {}) {
    if (!speechSynthesis) {
        console.warn('Speech synthesis not available');
        return;
    }
    
    // Cancel any ongoing speech
    speechSynthesis.cancel();
    
    // Default options
    const defaultOptions = {
        rate: 0.9,      // Slightly slower for clarity
        pitch: 1.3,     // Higher pitch for more feminine sound
        volume: 0.95,   // Clear volume
        lang: 'en-GB',  // Prefer British English
        voiceGender: 'female'
    };
    
    const config = { ...defaultOptions, ...options };
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = config.rate;
    utterance.pitch = config.pitch;
    utterance.volume = config.volume;
    utterance.lang = config.lang;

    // Enhanced voice selection
    function setVoiceAndSpeak() {
        const voices = speechSynthesis.getVoices();
        
        if (voices.length === 0) {
            console.warn('No voices available');
            speechSynthesis.speak(utterance);
            return;
        }
        
        // Priority list for voice selection
        const voicePreferences = [
            // British English female voices
            voice => voice.lang.includes('en-GB') && 
                    (voice.name.toLowerCase().includes('female') || 
                     voice.name.toLowerCase().includes('woman') ||
                     voice.name.toLowerCase().includes('kate') ||
                     voice.name.toLowerCase().includes('serena') ||
                     voice.name.toLowerCase().includes('emma')),
            
            // Any English female voices
            voice => voice.lang.includes('en') && 
                    (voice.name.toLowerCase().includes('female') || 
                     voice.name.toLowerCase().includes('woman') ||
                     voice.name.toLowerCase().includes('samantha') ||
                     voice.name.toLowerCase().includes('zira')),
            
            // British English voices (any gender)
            voice => voice.lang.includes('en-GB'),
            
            // US English female voices
            voice => voice.lang.includes('en-US') && 
                    (voice.name.toLowerCase().includes('female') || 
                     voice.name.toLowerCase().includes('woman')),
            
            // Any English voices
            voice => voice.lang.includes('en'),
            
            // Fallback to first available voice
            () => true
        ];
        
        let selectedVoice = null;
        
        for (const preference of voicePreferences) {
            selectedVoice = voices.find(preference);
            if (selectedVoice) break;
        }
        
        if (selectedVoice) {
            utterance.voice = selectedVoice;
            utterance.lang = selectedVoice.lang;
            console.log('Selected voice:', selectedVoice.name, selectedVoice.lang);
        }
        
        // Add event listeners
        utterance.onstart = () => {
            console.log('Speech started');
        };
        
        utterance.onend = () => {
            console.log('Speech ended');
        };
        
        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event.error);
        };
        
        // Add natural pauses for better speech rhythm
        utterance.text = addNaturalPauses(text);
        
        speechSynthesis.speak(utterance);
    }

    // If voices are not loaded yet, wait for them
    if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.addEventListener('voiceschanged', setVoiceAndSpeak, { once: true });
    } else {
        setVoiceAndSpeak();
    }
}

// Add natural pauses to text for better speech rhythm
function addNaturalPauses(text) {
    return text
        .replace(/[.!?]/g, match => `${match} `) // Pause after sentences
        .replace(/[,;:]/g, match => `${match} `) // Small pause after commas
        .replace(/\s+/g, ' ') // Clean up multiple spaces
        .trim();
}

// Stop current speech
export function stopSpeech() {
    if (speechSynthesis) {
        speechSynthesis.cancel();
    }
}

// Check if speech synthesis is currently speaking
export function isSpeaking() {
    return speechSynthesis ? speechSynthesis.speaking : false;
}

// Get available voices
export function getAvailableVoices() {
    return speechSynthesis ? speechSynthesis.getVoices() : [];
}

// Speak with custom voice
export function speakWithVoice(text, voiceName) {
    const voices = getAvailableVoices();
    const selectedVoice = voices.find(voice => voice.name === voiceName);
    
    if (selectedVoice) {
        speakText(text, { voice: selectedVoice });
    } else {
        console.warn(`Voice "${voiceName}" not found. Using default voice.`);
        speakText(text);
    }
}