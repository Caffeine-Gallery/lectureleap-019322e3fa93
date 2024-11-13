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

    // ... rest of the methods remain the same ...

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

    // ... remaining methods stay the same ...
}

window.addEventListener('load', () => {
    new AudioRecorder();
});
