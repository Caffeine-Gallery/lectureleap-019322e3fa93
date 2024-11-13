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

    initializeEvents() {
        if (this.recordBtn) {
            this.recordBtn.addEventListener('click', () => this.toggleRecording());
        }
        if (this.generateStudyGuideBtn) {
            this.generateStudyGuideBtn.addEventListener('click', () => this.generateStudyGuide());
        }
    }

    async toggleRecording() {
        if (!this.isRecording) {
            await this.startRecording();
        } else {
            await this.stopRecording();
        }
    }

    updateTimer() {
        this.seconds++;
        const minutes = Math.floor(this.seconds / 60);
        const remainingSeconds = this.seconds % 60;
        this.timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
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
                        if (this.currentTranscriptionId !== null) {
                            await backend.processTranscription(this.currentTranscriptionId, transcript);
                        }
                    } else {
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

            if (this.transcriptionText) {
                this.transcriptionText.innerHTML = 
                    finalTranscript +
                    '<span style="color: #666;">' + interimTranscript + '</span>';
                this.transcriptionText.scrollTop = this.transcriptionText.scrollHeight;
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            UIkit.notification({
                message: 'Speech recognition error: ' + event.error,
                status: 'danger'
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
            if (this.transcriptionArea) {
                this.transcriptionArea.style.display = 'block';
            }
            if (this.recordBtn) {
                this.recordBtn.textContent = 'Stop Recording';
                this.recordBtn.classList.remove('uk-button-danger');
                this.recordBtn.classList.add('uk-button-secondary');
            }

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

    async stopRecording() {
        return new Promise(async (resolve) => {
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.onstop = async () => {
                    clearInterval(this.timer);
                    if (this.timerDisplay) {
                        this.timerDisplay.textContent = '00:00';
                    }
                    
                    try {
                        await backend.finalizeTranscription(this.currentTranscriptionId);
                        const finalTranscription = await backend.getLatestTranscription(this.currentTranscriptionId);
                        if (finalTranscription) {
                            this.addRecordingToList(this.currentTranscriptionId, finalTranscription);
                        }
                    } catch (error) {
                        console.error('Error finalizing transcription:', error);
                    }
                    
                    if (this.recordBtn) {
                        this.recordBtn.textContent = 'Start Recording';
                        this.recordBtn.classList.remove('uk-button-secondary');
                        this.recordBtn.classList.add('uk-button-danger');
                    }
                    
                    resolve();
                };

                this.recognition.stop();
                this.mediaRecorder.stop();
                this.isRecording = false;
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            } else {
                resolve();
            }
        });
    }

    addRecordingToList(recordingId, transcription) {
        if (!this.recordingsList) return;

        const recordingElement = document.createElement('div');
        recordingElement.innerHTML = `
            <div class="uk-card uk-card-default uk-card-body">
                <h4 class="uk-card-title">Recording ${recordingId}</h4>
                <p class="uk-text-truncate">${transcription.substring(0, 100)}...</p>
                <button class="uk-button uk-button-primary uk-button-small" 
                    onclick="viewTranscription('${recordingId}')">
                    View Transcription
                </button>
            </div>
        `;
        const grid = this.recordingsList.querySelector('.uk-grid');
        if (grid) {
            grid.appendChild(recordingElement);
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
