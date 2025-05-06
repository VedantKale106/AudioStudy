// Service worker for background audio functionality

// Service worker installation
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    self.skipWaiting();
});

// Service worker activation
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    return self.clients.claim();
});

// Audio context and state management
let audioContext = null;
let audioSource = null;
let mediaSessionActive = false;

// Handle messages from the main thread
self.addEventListener('message', event => {
    const data = event.data;
    
    if (data.type === 'PLAY_AUDIO') {
        setupMediaSession(data.audioInfo);
    } else if (data.type === 'PAUSE_AUDIO') {
        if (mediaSessionActive) {
            navigator.mediaSession.playbackState = 'paused';
        }
    } else if (data.type === 'STOP_AUDIO') {
        if (mediaSessionActive) {
            navigator.mediaSession.playbackState = 'none';
            mediaSessionActive = false;
        }
    }
});

// Set up media session API for background audio controls
function setupMediaSession(audioInfo) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: audioInfo.title || 'Study Session',
            artist: audioInfo.subject || 'Study Assistant',
            album: 'Learning Material',
            artwork: [
                { src: '/static/images/icon-96.png', sizes: '96x96', type: 'image/png' },
                { src: '/static/images/icon-128.png', sizes: '128x128', type: 'image/png' },
                { src: '/static/images/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: '/static/images/icon-256.png', sizes: '256x256', type: 'image/png' },
                { src: '/static/images/icon-384.png', sizes: '384x384', type: 'image/png' },
                { src: '/static/images/icon-512.png', sizes: '512x512', type: 'image/png' },
            ]
        });

        navigator.mediaSession.playbackState = 'playing';
        mediaSessionActive = true;
        
        // Set up action handlers
        navigator.mediaSession.setActionHandler('play', () => {
            self.clients.matchAll().then(clients => {
                if (clients.length > 0) {
                    clients[0].postMessage({
                        type: 'MEDIA_SESSION_PLAY'
                    });
                }
            });
            navigator.mediaSession.playbackState = 'playing';
        });
        
        navigator.mediaSession.setActionHandler('pause', () => {
            self.clients.matchAll().then(clients => {
                if (clients.length > 0) {
                    clients[0].postMessage({
                        type: 'MEDIA_SESSION_PAUSE'
                    });
                }
            });
            navigator.mediaSession.playbackState = 'paused';
        });
        
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            self.clients.matchAll().then(clients => {
                if (clients.length > 0) {
                    clients[0].postMessage({
                        type: 'MEDIA_SESSION_NEXT'
                    });
                }
            });
        });
        
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            self.clients.matchAll().then(clients => {
                if (clients.length > 0) {
                    clients[0].postMessage({
                        type: 'MEDIA_SESSION_PREV'
                    });
                }
            });
        });
    }
}

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/service-worker.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
                
                // Send messages to service worker
                if (navigator.serviceWorker.controller) {
                    setupServiceWorkerCommunication();
                } else {
                    navigator.serviceWorker.oncontrollerchange = () => {
                        setupServiceWorkerCommunication();
                    };
                }
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    });
}

// Set up communication with the service worker
function setupServiceWorkerCommunication() {
    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', event => {
        const data = event.data;
        
        if (data.type === 'MEDIA_SESSION_PLAY') {
            document.getElementById('playPauseBtn').click();
        } else if (data.type === 'MEDIA_SESSION_PAUSE') {
            document.getElementById('playPauseBtn').click();
        } else if (data.type === 'MEDIA_SESSION_NEXT') {
            document.getElementById('skipBtn').click();
        } else if (data.type === 'MEDIA_SESSION_PREV') {
            // Handle previous action if needed
        }
    });
    
    // Initial media session setup
    const audioInfo = {
        title: 'Study Session',
        subject: contentData.subject
    };
    
    navigator.serviceWorker.controller.postMessage({
        type: 'PLAY_AUDIO',
        audioInfo: audioInfo
    });
}