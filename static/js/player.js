// Player.js - Main functionality for the study assistant player

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');
    const skipBtn = document.getElementById('skipBtn');
    const speedRange = document.getElementById('speedRange');
    const speedValue = document.getElementById('speedValue');
    const progressBar = document.getElementById('progress');
    const qaContent = document.getElementById('qaContent');
    const qaItems = document.querySelectorAll('.qa-item');
    const currentQADisplay = document.getElementById('currentQA');
    const studyTimerDisplay = document.getElementById('studyTimer');
    const breakTimerDisplay = document.getElementById('breakTimer');
    const currentModeDisplay = document.getElementById('currentMode');
    const speechAudio = document.getElementById('speechAudio');
    const breakAudio = document.getElementById('breakAudio');

    // State variables
    let currentIndex = 0;
    let isPlaying = false;
    let speechSynthesis = window.speechSynthesis;
    let currentUtterance = null;
    let studyTimeInSeconds = 0;
    let breakCountdownInSeconds = 600; // 10 minutes
    let studyInterval;
    let breakInterval;
    let isInBreak = false;
    let currentSpeakingPart = 'question'; // 'question' or 'answer'
    let waitBetweenQA = 1000; // ms to wait between question and answer

    // Initialize the player
    function init() {
        // Set up event listeners
        playPauseBtn.addEventListener('click', togglePlayPause);
        skipBtn.addEventListener('click', skipToNextQuestion);
        speedRange.addEventListener('input', changeSpeed);

        // Set up click events for QA items
        qaItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                stopSpeaking();
                currentIndex = index;
                currentSpeakingPart = 'question';
                updateActiveItem();
                if (isPlaying) {
                    speak();
                }
            });
        });

        // Set up timers
        setupTimers();

        // Set up break audio
        setupBreakAudio();

        // Set initial active item
        updateActiveItem();

        // Handle page visibility changes (for background playback)
        handleVisibilityChange();

        // Enable wake lock if available (to prevent screen from turning off)
        requestWakeLock();
    }

    // Toggle play/pause
    function togglePlayPause() {
        if (isInBreak) {
            // End break and resume study
            endBreak();
            return;
        }

        isPlaying = !isPlaying;
        
        if (isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'inline';
            speak();
            startStudyTimer();
        } else {
            playIcon.style.display = 'inline';
            pauseIcon.style.display = 'none';
            stopSpeaking();
            pauseStudyTimer();
        }
    }

    // Skip to next question
    function skipToNextQuestion() {
        stopSpeaking();
        
        if (currentSpeakingPart === 'question') {
            // If currently on question, move to its answer
            currentSpeakingPart = 'answer';
        } else {
            // If on answer, move to next question
            currentIndex = (currentIndex + 1) % qaItems.length;
            currentSpeakingPart = 'question';
            currentQADisplay.textContent = currentIndex + 1;
        }
        
        updateActiveItem();
        
        if (isPlaying) {
            speak();
        }
    }

    // Change speech rate
    function changeSpeed() {
        const speed = parseFloat(speedRange.value);
        speedValue.textContent = speed.toFixed(1) + 'x';
        
        if (currentUtterance) {
            // Stop and restart with new rate
            const currentText = currentUtterance.text;
            stopSpeaking();
            speak(currentText, speed);
        }
    }

    // Update which item is visually active
    function updateActiveItem() {
        // Remove active class from all items
        qaItems.forEach(item => {
            item.classList.remove('active-item');
            item.querySelector('.question').classList.remove('highlight');
            item.querySelector('.answer').classList.remove('highlight');
        });
        
        // Add active class to current item
        const currentItem = qaItems[currentIndex];
        currentItem.classList.add('active-item');
        
        // Highlight current speaking part
        if (currentSpeakingPart === 'question') {
            currentItem.querySelector('.question').classList.add('highlight');
        } else {
            currentItem.querySelector('.answer').classList.add('highlight');
        }
        
        // Scroll to visible
        currentItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Update progress bar
        const progress = ((currentIndex / qaItems.length) * 100) + 
                        (currentSpeakingPart === 'answer' ? (1/qaItems.length * 50) : 0);
        progressBar.style.width = `${progress}%`;
    }

    // Speak the current content
    function speak() {
        if (!speechSynthesis) {
            console.error('Speech synthesis not supported');
            return;
        }
        
        stopSpeaking();
        
        const currentItem = qaItems[currentIndex];
        const textToSpeak = currentSpeakingPart === 'question' 
            ? currentItem.querySelector('.question').textContent.trim()
            : currentItem.querySelector('.answer').textContent.trim();
        
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = parseFloat(speedRange.value);
        utterance.lang = 'en-US';
        
        // Handle end of speaking
        utterance.onend = () => {
            if (currentSpeakingPart === 'question') {
                // After question, move to answer after short pause
                currentSpeakingPart = 'answer';
                updateActiveItem();
                
                setTimeout(() => {
                    if (isPlaying) {
                        speak();
                    }
                }, waitBetweenQA);
            } else {
                // After answer, move to next question
                currentIndex = (currentIndex + 1) % qaItems.length;
                currentSpeakingPart = 'question';
                currentQADisplay.textContent = currentIndex + 1;
                updateActiveItem();
                
                setTimeout(() => {
                    if (isPlaying) {
                        speak();
                    }
                }, waitBetweenQA * 1.5);
            }
        };
        
        // Handle errors
        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
        };
        
        currentUtterance = utterance;
        speechSynthesis.speak(utterance);
    }

    // Stop speaking
    function stopSpeaking() {
        if (speechSynthesis) {
            speechSynthesis.cancel();
        }
        currentUtterance = null;
    }

    // Set up study and break timers
    function setupTimers() {
        // Update displays initially
        updateTimerDisplay(studyTimerDisplay, studyTimeInSeconds);
        updateTimerDisplay(breakTimerDisplay, breakCountdownInSeconds);
        
        // Check for saved progress
        const savedProgress = localStorage.getItem(`progress_${contentData.subject}`);
        if (savedProgress) {
            const progress = JSON.parse(savedProgress);
            currentIndex = progress.index || 0;
            currentSpeakingPart = progress.part || 'question';
            studyTimeInSeconds = progress.studyTime || 0;
            updateActiveItem();
            updateTimerDisplay(studyTimerDisplay, studyTimeInSeconds);
        }
    }

    // Start the study timer
    function startStudyTimer() {
        if (studyInterval) clearInterval(studyInterval);
        
        studyInterval = setInterval(() => {
            studyTimeInSeconds++;
            updateTimerDisplay(studyTimerDisplay, studyTimeInSeconds);
            
            // Decrease break countdown
            breakCountdownInSeconds--;
            updateTimerDisplay(breakTimerDisplay, breakCountdownInSeconds);
            
            // Save progress
            saveProgress();
            
            // Check if it's time for a break
            if (breakCountdownInSeconds <= 0 && !isInBreak) {
                startBreak();
            }
        }, 1000);
    }

    // Pause the study timer
    function pauseStudyTimer() {
        if (studyInterval) {
            clearInterval(studyInterval);
        }
    }

    // Update timer display format
    function updateTimerDisplay(element, seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        element.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // Set up break audio
    function setupBreakAudio() {
        if (contentData.songs && contentData.songs.length > 0) {
            // Randomly select a song
            const randomSong = contentData.songs[Math.floor(Math.random() * contentData.songs.length)];
            breakAudio.src = `/static/songs/${randomSong}`;
            breakAudio.load();
        }
    }

    // Start a break period
    function startBreak() {
        isInBreak = true;
        stopSpeaking();
        pauseStudyTimer();
        
        // Update UI
        currentModeDisplay.textContent = 'Break';
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'inline';
        
        // Play break music
        breakAudio.play().catch(error => {
            console.error('Error playing break audio:', error);
        });
        
        // Set up a break timer (5 minutes)
        let breakTime = 300; // 5 minutes
        updateTimerDisplay(breakTimerDisplay, breakTime);
        
        if (breakInterval) clearInterval(breakInterval);
        
        breakInterval = setInterval(() => {
            breakTime--;
            updateTimerDisplay(breakTimerDisplay, breakTime);
            
            if (breakTime <= 0) {
                endBreak();
            }
        }, 1000);
    }

    // End the break period
    function endBreak() {
        isInBreak = false;
        
        // Stop break timer
        if (breakInterval) {
            clearInterval(breakInterval);
        }
        
        // Stop break music
        breakAudio.pause();
        breakAudio.currentTime = 0;
        
        // Reset break countdown
        breakCountdownInSeconds = 600; // 10 minutes
        updateTimerDisplay(breakTimerDisplay, breakCountdownInSeconds);
        
        // Update UI
        currentModeDisplay.textContent = 'Study';
        
        // Resume study if it was playing before
        if (isPlaying) {
            speak();
            startStudyTimer();
        } else {
            playIcon.style.display = 'inline';
            pauseIcon.style.display = 'none';
        }
    }

    // Save progress to localStorage
    function saveProgress() {
        const progress = {
            index: currentIndex,
            part: currentSpeakingPart,
            studyTime: studyTimeInSeconds
        };
        
        localStorage.setItem(`progress_${contentData.subject}`, JSON.stringify(progress));
    }

    // Handle page visibility changes for background audio
    function handleVisibilityChange() {
        document.addEventListener('visibilitychange', () => {
            // When page becomes hidden, we need to ensure speech continues
            if (document.visibilityState === 'hidden' && isPlaying && !isInBreak) {
                // Save state before page is hidden
                saveProgress();
            }
        });
    }

    // Request wake lock to prevent screen from turning off
    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                const wakeLock = await navigator.wakeLock.request('screen');
                
                wakeLock.addEventListener('release', () => {
                    console.log('Wake lock released');
                });
                
                // Re-request wake lock when page visibility changes
                document.addEventListener('visibilitychange', async () => {
                    if (document.visibilityState === 'visible') {
                        await navigator.wakeLock.request('screen');
                    }
                });
                
                console.log('Wake lock acquired');
            } catch (err) {
                console.error('Could not acquire wake lock:', err);
            }
        } else {
            console.warn('Wake Lock API not supported in this browser');
        }
    }

    // Initialize the player
    init();
});