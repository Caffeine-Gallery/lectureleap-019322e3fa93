import { backend } from "declarations/backend";

class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.timer = null;
        this.seconds = 0;
        this.recognition = null;
        this.currentTranscriptionId = null;
        this.confidenceThreshold = 0.8;
        this.audioContext = null;
        this.analyser = null;

        this.recordBtn = document.getElementById('recordBtn');
        this.timerDisplay = document.getElementById('timer');
        this.recordingsList = document.getElementById('recordingsList');
        this.transcriptionArea = document.getElementById('transcriptionArea');
        this.transcriptionText = document.getElementById('transcriptionText');
        this.studyGuideArea = document.getElementById('studyGuideArea');
        this.studyGuideText = document.getElementById('studyGuideText');
        this.loadingSpinner = document.getElementById('loadingSpinner');
        this.generateStudyGuideBtn = document.getElementById('generateStudyGuide');

        this.initializeAudioContext();
        this.initializeSpeechRecognition();
        this.initializeEvents();
    }

    initializeAudioContext() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.minDecibels = -90;
        this.analyser.maxDecibels = -10;
        this.analyser.smoothingTimeConstant = 0.85;
    }

    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
        } else if ('SpeechRecognition' in window) {
            this.recognition = new SpeechRecognition();
        } else {
            UIkit.notification({
                message: 'Speech recognition is not supported in this browser.',
                status: 'danger'
            });
            return;
        }

        // Optimize recognition settings
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 3;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = async (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const result = event.results[i];
                const transcript = result[0].transcript;
                const confidence = result[0].confidence;

                if (result.isFinal) {
                    // Only use results with good confidence
                    if (confidence >= this.confidenceThreshold) {
                        finalTranscript += transcript;
                        if (this.currentTranscriptionId !== null) {
                            await backend.processTranscription(this.currentTranscriptionId, transcript);
                        }
                    } else {
                        // Try alternative results if primary confidence is low
                        for (let j = 1; j < result.length; j++) {
                            if (result[j].confidence >= this.confidenceThreshold) {
                                finalTranscript += result[j].transcript;
                                if (this.currentTranscriptionId !== null) {
                                    await backend.processTranscription(this.currentTranscriptionId, result[j].transcript);
                                }
                                break;
                            }
                        }
                    }
                } else {
                    interimTranscript += transcript;
                }
            }

            this.transcriptionText.innerHTML = 
                finalTranscript +
                '<span style="color: #666;">' + interimTranscript + '</span>';
            this.transcriptionText.scrollTop = this.transcriptionText.scrollHeight;
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                UIkit.notification({
                    message: 'No speech detected. Please speak more clearly.',
                    status: 'warning'
                });
            } else {
                UIkit.notification({
                    message: 'Speech recognition error: ' + event.error,
                    status: 'danger'
                });
            }
        };

        this.recognition.onnomatch = () => {
            UIkit.notification({
                message: 'Could not recognize speech. Please speak more clearly.',
                status: 'warning'
            });
        };
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 48000,
                    sampleSize: 16
                }
            });

            // Set up audio processing
            const source = this.audioContext.createMediaStreamSource(stream);
            source.connect(this.analyser);

            // Configure media recorder with high quality settings
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000
            });

            this.audioChunks = [];
            this.currentTranscriptionId = await backend.startTranscription();
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            // Start monitoring audio levels
            this.startAudioMonitoring();

            this.mediaRecorder.start(1000);
            this.recognition.start();
            
            this.isRecording = true;
            this.transcriptionArea.style.display = 'block';
            this.recordBtn.textContent = 'Stop Recording';
            this.recordBtn.classList.remove('uk-button-danger');
            this.recordBtn.classList.add('uk-button-secondary');

            this.seconds = 0;
            this.timer = setInterval(() => this.updateTimer(), 1000);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            UIkit.notification({
                message: 'Error accessing microphone. Please ensure you have granted permission.',
                status: 'danger'
            });
        }
    }

    startAudioMonitoring() {
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const checkAudioLevel = () => {
            if (!this.isRecording) return;

            this.analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            
            if (average < 10) {
                UIkit.notification({
                    message: 'Speech volume is too low. Please speak louder.',
                    status: 'warning',
                    timeout: 2000
                });
            }

            requestAnimationFrame(checkAudioLevel);
        };

        checkAudioLevel();
    }

    // ... rest of the class implementation remains the same ...
}

window.addEventListener('load', () => {
    new AudioRecorder();
});
