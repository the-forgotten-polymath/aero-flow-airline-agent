document.addEventListener('DOMContentLoaded', function() {
    // Import speech synthesis utilities
    import('./speech-synthesis.js').then(speech => {
        speech.initSpeechSynthesis();
        window.speakText = speech.speakText;
    }).catch(error => {
        console.error('Error loading speech synthesis:', error);
    });

    // DOM Elements - Chat UI
    const chatbotIcon = document.getElementById('chatbot-icon');
    const chatbotWindow = document.getElementById('chatbot-window');
    const closeChat = document.getElementById('close-chat');
    const minimizeChat = document.getElementById('minimize-chat');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const chatContainer = document.getElementById('chat-container');
    
    // DOM Elements - Voice UI
    const voiceButton = document.getElementById('voice-button');
    const voicePopup = document.getElementById('voice-popup');
    const voicePopupOverlay = document.getElementById('voice-popup-overlay');
    const closeVoicePopup = document.getElementById('close-voice-popup');
    const startRecording = document.getElementById('start-recording');
    const pauseRecording = document.getElementById('pause-recording');
    const resumeRecording = document.getElementById('resume-recording');
    const resetRecording = document.getElementById('reset-recording');
    const sendVoice = document.getElementById('send-voice');
    const transcriptionResult = document.getElementById('transcription-result');
    const recordingIndicator = document.getElementById('recording-indicator');
    const waveformPath = document.getElementById('waveform-svg-path');
    const recordingStatus = document.getElementById('recording-status');
    
    // DOM Elements - Attachment UI
    const attachmentButton = document.getElementById('attachment-button');
    const fileInput = document.getElementById('file-input');
    const attachmentPreview = document.getElementById('attachment-preview');
    const attachmentName = document.getElementById('attachment-name');
    const removeAttachment = document.getElementById('remove-attachment');
    
    // Speech Recognition Setup
    let recognition = null;
    let isRecording = false;
    let isPaused = false;
    let currentFile = null;
    let finalTranscript = '';
    
    // Initialize Speech Recognition if available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        recognition.onresult = function(event) {
            finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
        };
        
        recognition.onend = function() {
            // For direct recording, don't restart automatically
            if (isRecording) {
                stopDirectVoiceRecording();
            }
        };
        
        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            
            // Reset voice button on error
            isRecording = false;
            voiceButton.style.backgroundColor = '';
            voiceButton.style.color = '';
            voiceButton.querySelector('i').className = 'fas fa-microphone';
        };
    }
    
    function handleRecordingEnd() {
        isRecording = false;
        recordingIndicator.classList.add('hidden');
        startRecording.querySelector('i').className = 'fas fa-microphone';
        animateWaveform(false);
        updateVoiceControls();
        
        if (recordingStatus) {
            if (finalTranscript.trim() !== '') {
                recordingStatus.innerHTML = '<span style="color: var(--ba-navy);">✓</span> Recording complete. You can send or reset.';
            } else {
                recordingStatus.textContent = 'Recording stopped. Click microphone to try again.';
            }
        }
    }
    
    // Toggle chat window visibility
    chatbotIcon.addEventListener('click', function() {
        chatbotWindow.classList.remove('hidden');
        chatbotIcon.classList.add('hidden');
        chatInput.focus();
        scrollToBottom();
    });
    
    // Close chat window
    closeChat.addEventListener('click', function() {
        chatbotWindow.classList.add('hidden');
        chatbotIcon.classList.remove('hidden');
        voicePopup.classList.add('hidden');
        voicePopupOverlay.classList.add('hidden');
    });
    
    // Minimize chat window
    minimizeChat.addEventListener('click', function() {
        chatbotWindow.classList.add('hidden');
        chatbotIcon.classList.remove('hidden');
        voicePopup.classList.add('hidden');
        voicePopupOverlay.classList.add('hidden');
    });
    
    // Direct voice recording without popup
    voiceButton.addEventListener('click', function() {
        if (!isRecording) {
            startDirectVoiceRecording();
        } else {
            stopDirectVoiceRecording();
        }
    });
    
    // Close voice popup handlers
    closeVoicePopup.addEventListener('click', closeVoicePopupFunc);
    voicePopupOverlay.addEventListener('click', closeVoicePopupFunc);
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !voicePopup.classList.contains('hidden')) {
            closeVoicePopupFunc();
        }
    });
    
    function closeVoicePopupFunc() {
        voicePopup.classList.add('hidden');
        voicePopupOverlay.classList.add('hidden');
        stopRecording();
        setTimeout(() => chatInput.focus(), 100);
    }
    
    // File attachment handlers
    attachmentButton.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            currentFile = e.target.files[0];
            attachmentName.textContent = currentFile.name;
            attachmentPreview.classList.remove('hidden');
        }
    });
    
    removeAttachment.addEventListener('click', function() {
        currentFile = null;
        fileInput.value = '';
        attachmentPreview.classList.add('hidden');
    });
    
    // Voice Recording Controls
    startRecording.addEventListener('click', function() {
        if (!isRecording) {
            startVoiceRecording();
        } else {
            stopRecording();
        }
    });
    
    pauseRecording.addEventListener('click', function() {
        if (isRecording && !isPaused && recognition) {
            recognition.stop();
            isPaused = true;
            animateWaveform(false);
            updateVoiceControls();
            if (recordingStatus) {
                recordingStatus.innerHTML = '<span style="color: #e6c418;">⏸</span> Recording paused';
            }
        }
    });
    
    resumeRecording.addEventListener('click', function() {
        if (isRecording && isPaused && recognition) {
            try {
                recognition.start();
                isPaused = false;
                animateWaveform(true);
                updateVoiceControls();
                if (recordingStatus) {
                    recordingStatus.innerHTML = '<span style="color: var(--ba-red); animation: blink 1s infinite;">●</span> Recording resumed... speak now';
                }
            } catch (e) {
                console.error('Error resuming recognition:', e);
                if (recordingStatus) {
                    recordingStatus.innerHTML = '<span style="color: var(--ba-red);">Error resuming recording. Please try again.</span>';
                }
            }
        }
    });
    
    resetRecording.addEventListener('click', resetVoiceUI);
    
    sendVoice.addEventListener('click', function() {
        const text = finalTranscript.trim();
        if (text) {
            sendVoice.disabled = true;
            if (recordingStatus) {
                recordingStatus.innerHTML = '<span style="color: var(--ba-navy);">↑</span> Sending message...';
            }
            
            setTimeout(() => {
                addMessage('user', text);
                transcriptionResult.innerHTML = '';
                voicePopup.classList.add('hidden');
                voicePopupOverlay.classList.add('hidden');
                stopRecording();
                resetVoiceUI();
                processMessage(text, null, true); // true indicates voice input
                chatInput.focus();
            }, 800);
        }
    });
    
    function startVoiceRecording() {
        if (!recognition) {
            if (recordingStatus) {
                recordingStatus.innerHTML = '<span style="color: var(--ba-red);">Speech recognition is not supported in your browser.</span>';
            }
            return;
        }
        
        try {
            finalTranscript = '';
            recognition.start();
            isRecording = true;
            isPaused = false;
            recordingIndicator.classList.remove('hidden');
            startRecording.querySelector('i').className = 'fas fa-stop';
            transcriptionResult.innerHTML = '';
            sendVoice.disabled = true;
            
            if (recordingStatus) {
                recordingStatus.innerHTML = '<span style="color: var(--ba-red); animation: blink 1s infinite;">●</span> Recording... speak now';
            }
            
            animateWaveform(true);
            updateVoiceControls();
        } catch (e) {
            console.error('Error starting recognition:', e);
            if (recordingStatus) {
                recordingStatus.innerHTML = '<span style="color: var(--ba-red);">Error starting speech recognition. Please try again.</span>';
                setTimeout(() => {
                    recordingStatus.textContent = 'Click the microphone to start recording';
                }, 3000);
            }
        }
    }
    
    function startDirectVoiceRecording() {
        if (!recognition) {
            console.error('Speech recognition is not supported in your browser.');
            return;
        }
        
        try {
            finalTranscript = '';
            recognition.start();
            isRecording = true;
            isPaused = false;
            
            // Visual feedback on voice button
            voiceButton.style.backgroundColor = '#dc3545';
            voiceButton.style.color = 'white';
            voiceButton.querySelector('i').className = 'fas fa-stop';
            
        } catch (e) {
            console.error('Error starting recognition:', e);
        }
    }
    
    function stopDirectVoiceRecording() {
        if (recognition && isRecording) {
            recognition.stop();
            isRecording = false;
            isPaused = false;
            
            // Reset voice button appearance
            voiceButton.style.backgroundColor = '';
            voiceButton.style.color = '';
            voiceButton.querySelector('i').className = 'fas fa-microphone';
            
            // Send the recorded message if we have text
            setTimeout(() => {
                const text = finalTranscript.trim();
                if (text) {
                    addMessage('user', text);
                    processMessage(text, null, true); // true indicates voice input
                }
                finalTranscript = '';
            }, 500);
        }
    }

    // Send message handlers
    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    function sendMessage() {
        const message = chatInput.value.trim();
        if (message === '' && !currentFile) return;
        
        if (message) {
            addMessage('user', message);
        }
        
        chatInput.value = '';
        
        let fileData = null;
        if (currentFile) {
            fileData = {
                name: currentFile.name,
                type: currentFile.type,
                size: currentFile.size
            };
            currentFile = null;
            fileInput.value = '';
            attachmentPreview.classList.add('hidden');
        }
        
        processMessage(message, fileData);
    }
    
    // Process message and get response
    function processMessage(message, fileData = null, isVoiceInput = false) {
        showTypingIndicator();
        
        const data = { message: message || '' };
        if (fileData) data.file = fileData;

        fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
        .then(response => response.json())
        .then(data => {
            removeTypingIndicator();
            
            if (data.response) {
                addMessage('assistant', data.response);
                // Use speech synthesis for voice response if input was voice
                if (isVoiceInput && window.speakText) {
                    window.speakText(data.response);
                }
            } else if (data.error) {
                const errorMsg = 'Sorry, there was an error: ' + data.error;
                addMessage('assistant', errorMsg);
                if (isVoiceInput && window.speakText) {
                    window.speakText(errorMsg);
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            removeTypingIndicator();
            const errorMsg = 'Sorry, there was an error processing your message.';
            addMessage('assistant', errorMsg);
            if (isVoiceInput && window.speakText) {
                window.speakText(errorMsg);
            }
        });
    }
    
    function addMessage(sender, message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;
        
        if (sender === 'user') {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="message-content">
                    <p>${escapeHtml(message)}</p>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <p>${escapeHtml(message)}</p>
                </div>
            `;
        }
        
        chatContainer.appendChild(messageDiv);
        scrollToBottom();
    }
    
    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-message bot typing-indicator-container';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <p><span class="typing-dots">Typing</span></p>
            </div>
        `;
        chatContainer.appendChild(typingDiv);
        scrollToBottom();
        
        const typingDots = typingDiv.querySelector('.typing-dots');
        let dots = 1;
        const typingAnimation = setInterval(() => {
            dots = (dots % 3) + 1;
            typingDots.textContent = 'Typing' + '.'.repeat(dots);
        }, 500);
        
        typingDiv.dataset.typingInterval = typingAnimation;
    }
    
    function removeTypingIndicator() {
        const typingIndicator = document.querySelector('.typing-indicator-container');
        if (typingIndicator) {
            clearInterval(typingIndicator.dataset.typingInterval);
            typingIndicator.remove();
        }
    }
    
    function scrollToBottom() {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    function updateVoiceControls() {
        if (isRecording) {
            pauseRecording.disabled = isPaused;
            resumeRecording.disabled = !isPaused;
            resetRecording.disabled = false;
        } else {
            pauseRecording.disabled = true;
            resumeRecording.disabled = true;
            resetRecording.disabled = true;
            sendVoice.disabled = !finalTranscript.trim();
        }
    }
    
    function stopRecording() {
        if (recognition && isRecording) {
            recognition.stop();
            isRecording = false;
            isPaused = false;
            recordingIndicator.classList.add('hidden');
            startRecording.querySelector('i').className = 'fas fa-microphone';
            animateWaveform(false);
            updateVoiceControls();
        }
    }
    
    function resetVoiceUI() {
        stopRecording();
        finalTranscript = '';
        transcriptionResult.innerHTML = '';
        sendVoice.disabled = true;
        pauseRecording.disabled = true;
        resumeRecording.disabled = true;
        resetRecording.disabled = true;
        startRecording.querySelector('i').className = 'fas fa-microphone';
        
        if (recordingStatus) {
            recordingStatus.textContent = 'Click the microphone to start recording';
        }
        
        waveformPath.setAttribute('d', 'M0,30 Q25,30 50,30 T100,30 T150,30 T200,30 T250,30 T300,30');
    }
    
    function animateWaveform(active) {
        if (active) {
            let lastValues = Array(20).fill(30);
            
            function updateWaveform() {
                if (!isRecording || isPaused) return;
                
                const points = [];
                const totalPoints = 20;
                
                for (let i = 0; i <= totalPoints; i++) {
                    const x = (i / totalPoints) * 300;
                    
                    if (i === 0 || i === totalPoints) {
                        points.push([x, 30]);
                        continue;
                    }
                    
                    let prevVal = lastValues[i];
                    let amplitude = Math.random() * 18 + 2;
                    
                    if (Math.random() < 0.05) {
                        amplitude += 15;
                    }
                    
                    let targetY = 30 - amplitude + Math.random() * (amplitude/3);
                    let y = prevVal + (targetY - prevVal) * 0.3;
                    
                    lastValues[i] = y;
                    points.push([x, y]);
                }
                
                let pathData = `M${points[0][0]},${points[0][1]}`;
                
                for (let i = 1; i < points.length; i++) {
                    const [x, y] = points[i];
                    const [prevX, prevY] = points[i-1];
                    
                    const cp1x = prevX + (x - prevX) * 0.4;
                    const cp1y = prevY;
                    const cp2x = prevX + (x - prevX) * 0.6;
                    const cp2y = y;
                    
                    pathData += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${x},${y}`;
                }
                
                waveformPath.setAttribute('d', pathData);
                
                if (isRecording && !isPaused) {
                    requestAnimationFrame(updateWaveform);
                }
            }
            
            requestAnimationFrame(updateWaveform);
        } else {
            const flatPath = 'M0,30 Q25,30 50,30 T100,30 T150,30 T200,30 T250,30 T300,30';
            waveformPath.style.transition = 'd 0.5s ease-out';
            waveformPath.setAttribute('d', flatPath);
            
            setTimeout(() => {
                waveformPath.style.transition = '';
            }, 500);
        }
    }
});