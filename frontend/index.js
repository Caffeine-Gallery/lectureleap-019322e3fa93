import { backend } from "declarations/backend";

class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.timer = null;
        this.seconds = 0;
        this.currentTranscriptionId = null;

        this.recordBtn = document.getElementById('recordBtn');
        this.timerDisplay = document.getElementById('timer');
        this.recordingsList = document.getElementById('recordingsList');
        this.transcriptionArea = document.getElementById('transcriptionArea');
        this.transcriptionText = document.getElementById('transcriptionText');
        this.studyGuideArea = document.getElementById('studyGuideArea');
        this.studyGuideText = document.getElementById('studyGuideText');
        this.loadingSpinner = document.getElementById('loadingSpinner');
        this.generateStudyGuideBtn = document.getElementById('generateStudyGuide');

        this.initializeEvents();
    }

    initializeEvents() {
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.generateStudyGuideBtn.addEventListener('click', () => this.generateStudyGuide());
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

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 16000
            });
            
            // Start a new transcription session
            this.currentTranscriptionId = await backend.startTranscription();
            this.transcriptionArea.style.display = 'block';
            this.transcriptionText.textContent = '';

            this.mediaRecorder.ondataavailable = async (event) => {
                if (event.data.size > 0) {
                    const arrayBuffer = await event.data.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    
                    try {
                        // Send audio chunk for processing
                        await backend.processAudioChunk(this.currentTranscriptionId, Array.from(uint8Array));
                        
                        // Get latest transcription
                        const transcription = await backend.getLatestTranscription(this.currentTranscriptionId);
                        if (transcription) {
                            this.transcriptionText.textContent = transcription;
                            this.transcriptionText.scrollTop = this.transcriptionText.scrollHeight;
                        }
                    } catch (error) {
                        console.error('Error processing audio chunk:', error);
                    }
                }
            };

            // Request data every 1 second
            this.mediaRecorder.start(1000);
            this.isRecording = true;
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

    async stopRecording() {
        return new Promise(async (resolve) => {
            this.mediaRecorder.onstop = async () => {
                clearInterval(this.timer);
                this.timerDisplay.textContent = '00:00';
                
                try {
                    // Finalize the transcription
                    await backend.finalizeTranscription(this.currentTranscriptionId);
                    
                    // Get final transcription
                    const finalTranscription = await backend.getLatestTranscription(this.currentTranscriptionId);
                    this.addRecordingToList(this.currentTranscriptionId, finalTranscription);
                    
                } catch (error) {
                    console.error('Error finalizing transcription:', error);
                }
                
                this.recordBtn.textContent = 'Start Recording';
                this.recordBtn.classList.remove('uk-button-secondary');
                this.recordBtn.classList.add('uk-button-danger');
                
                resolve();
            };

            this.mediaRecorder.stop();
            this.isRecording = false;
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        });
    }

    addRecordingToList(recordingId, transcription) {
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
        this.recordingsList.querySelector('.uk-grid').appendChild(recordingElement);
    }

    async generateStudyGuide() {
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
