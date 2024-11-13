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
        this.transcriptionHistory = '';
        this.recordings = new Map();

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
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.minDecibels = -90;
            this.analyser.maxDecibels = -10;
            this.analyser.smoothingTimeConstant = 0.85;
        } catch (error) {
            console.error('Error initializing audio context:', error);
            UIkit.notification({
                message: 'Error initializing audio system. Please try again.',
                status: 'danger'
            });
        }
    }

    initializeEvents() {
        if (this.recordBtn) {
            this.recordBtn.addEventListener('click', () => this.toggleRecording());
        }
        if (this.generateStudyGuideBtn) {
            this.generateStudyGuideBtn.addEventListener('click', () => this.generateStudyGuide());
        }
    }

    async toggleRecording() {
        try {
            if (!this.isRecording) {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    await this.stopRecording();
                }
                await this.startRecording();
            } else {
                await this.stopRecording();
            }
        } catch (error) {
            console.error('Error toggling recording:', error);
            UIkit.notification({
                message: 'Error toggling recording. Please try again.',
                status: 'danger'
            });
        }
    }

    cleanupRecording() {
        if (this.mediaRecorder) {
            if (this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
            }
            if (this.mediaRecorder.stream) {
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
        }
        if (this.recognition) {
            this.recognition.stop();
        }
        this.mediaRecorder = null;
        this.audioChunks = [];
        clearInterval(this.timer);
        this.isRecording = false;
    }

    updateTimer() {
        this.seconds++;
        const minutes = Math.floor(this.seconds / 60);
        const remainingSeconds = this.seconds % 60;
        if (this.timerDisplay) {
            this.timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
        }
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
                    if (confidence >= this.confidenceThreshold) {
                        finalTranscript += transcript;
                        this.transcriptionHistory += transcript + ' ';
                        if (this.currentTranscriptionId !== null) {
                            await backend.processTranscription(this.currentTranscriptionId, transcript);
                        }
                    }
                } else {
                    interimTranscript += transcript;
                }
            }

            if (this.transcriptionText) {
                this.transcriptionText.innerHTML = 
                    this.transcriptionHistory +
                    '<span class="interim-text">' + interimTranscript + '</span>';
                this.transcriptionText.scrollTop = this.transcriptionText.scrollHeight;
            }
        };

        this.recognition.onend = () => {
            if (this.isRecording) {
                this.recognition.start();
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error !== 'no-speech') {
                UIkit.notification({
                    message: 'Speech recognition error: ' + event.error,
                    status: 'danger'
                });
            }
        };
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

    async startRecording() {
        try {
            this.cleanupRecording();

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

            const source = this.audioContext.createMediaStreamSource(stream);
            source.connect(this.analyser);

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

            this.startAudioMonitoring();

            this.mediaRecorder.start(1000);
            this.recognition.start();
            
            this.isRecording = true;
            if (this.recordBtn) {
                this.recordBtn.textContent = 'Stop Recording';
                this.recordBtn.classList.remove('uk-button-danger');
                this.recordBtn.classList.add('uk-button-secondary');
            }

            this.seconds = 0;
            this.timer = setInterval(() => this.updateTimer(), 1000);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.cleanupRecording();
            UIkit.notification({
                message: 'Error accessing microphone. Please ensure you have granted permission.',
                status: 'danger'
            });
        }
    }

    async stopRecording() {
        return new Promise(async (resolve) => {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.onstop = async () => {
                    clearInterval(this.timer);
                    if (this.timerDisplay) {
                        this.timerDisplay.textContent = '00:00';
                    }
                    
                    try {
                        await backend.finalizeTranscription(this.currentTranscriptionId);
                        const transcription = await backend.getLatestTranscription(this.currentTranscriptionId);
                        if (transcription !== undefined && transcription !== null) {
                            this.addRecordingToList(this.currentTranscriptionId, transcription.toString());
                        }
                    } catch (error) {
                        console.error('Error finalizing transcription:', error);
                        UIkit.notification({
                            message: 'Error saving transcription. Please try again.',
                            status: 'danger'
                        });
                    }
                    
                    if (this.recordBtn) {
                        this.recordBtn.textContent = 'Start Recording';
                        this.recordBtn.classList.remove('uk-button-secondary');
                        this.recordBtn.classList.add('uk-button-danger');
                    }
                    
                    this.cleanupRecording();
                    resolve();
                };

                this.mediaRecorder.stop();
            } else {
                this.cleanupRecording();
                resolve();
            }
        });
    }

    addRecordingToList(recordingId, transcription) {
        if (!this.recordingsList || !transcription) return;

        try {
            const transcriptionText = typeof transcription === 'string' 
                ? transcription 
                : transcription.toString();

            this.recordings.set(recordingId, transcriptionText);

            const recordingElement = document.createElement('div');
            recordingElement.className = 'recording-card';
            recordingElement.innerHTML = `
                <div class="uk-card uk-card-default uk-card-body uk-margin-small">
                    <h4 class="uk-card-title">Recording ${recordingId}</h4>
                    <p class="uk-text-truncate">${transcriptionText.substring(0, 100)}...</p>
                    <button class="uk-button uk-button-primary uk-button-small view-transcription" 
                        data-recording-id="${recordingId}">
                        View Transcription
                    </button>
                </div>
            `;

            const viewButton = recordingElement.querySelector('.view-transcription');
            viewButton.addEventListener('click', () => this.viewTranscription(recordingId));

            const grid = this.recordingsList.querySelector('.uk-grid');
            if (grid) {
                grid.appendChild(recordingElement);
            }
        } catch (error) {
            console.error('Error adding recording to list:', error);
            UIkit.notification({
                message: 'Error displaying recording. Please try again.',
                status: 'warning'
            });
        }
    }

    viewTranscription(recordingId) {
        const transcription = this.recordings.get(recordingId);
        if (transcription) {
            const modalContent = document.getElementById('modalTranscriptionContent');
            modalContent.innerHTML = `<div class="uk-margin">${transcription}</div>`;
            UIkit.modal('#transcriptionModal').show();
        } else {
            UIkit.notification({
                message: 'Transcription not found.',
                status: 'danger'
            });
        }
    }

    async generateStudyGuide() {
        if (!this.loadingSpinner || !this.transcriptionText || !this.studyGuideArea || !this.studyGuideText) return;

        this.loadingSpinner.hidden = false;
        try {
            const transcription = this.transcriptionText.textContent;
            const studyGuide = await backend.generateStudyGuide(transcription);
            
            this.studyGuideArea.style.display = 'block';
            this.studyGuideText.innerHTML = studyGuide.replace(/\n/g, '<br>');
            
        } catch (error) {
            console.error('Error generating study guide:', error);
            UIkit.notification({
                message: 'Error generating study guide. Please try again.',
                status: 'danger'
            });
        } finally {
            this.loadingSpinner.hidden = true;
        }
    }
}

window.addEventListener('load', () => {
    new AudioRecorder();
});
