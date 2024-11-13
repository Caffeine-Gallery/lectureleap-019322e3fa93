import { backend } from "declarations/backend";

class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.timer = null;
        this.seconds = 0;

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
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.start();
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
        return new Promise(resolve => {
            this.mediaRecorder.onstop = async () => {
                clearInterval(this.timer);
                this.timerDisplay.textContent = '00:00';
                
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                await this.processRecording(audioBlob);
                
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

    async processRecording(audioBlob) {
        this.loadingSpinner.hidden = false;
        try {
            // Convert blob to array buffer
            const arrayBuffer = await audioBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Store recording in backend
            const recordingId = await backend.storeRecording(Array.from(uint8Array));
            
            // Get transcription
            const transcription = await backend.transcribeRecording(recordingId);
            
            // Display transcription
            this.transcriptionArea.style.display = 'block';
            this.transcriptionText.textContent = transcription;
            
            // Add recording to list
            this.addRecordingToList(recordingId, transcription);
            
        } catch (error) {
            console.error('Error processing recording:', error);
            UIkit.notification({
                message: 'Error processing recording. Please try again.',
                status: 'danger'
            });
        } finally {
            this.loadingSpinner.hidden = true;
        }
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

// Initialize the recorder when the page loads
window.addEventListener('load', () => {
    new AudioRecorder();
});
