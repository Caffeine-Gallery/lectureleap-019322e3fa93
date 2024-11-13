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

    // ... [previous methods remain the same until addRecordingToList] ...

    addRecordingToList(recordingId, transcription) {
        if (!this.recordingsList || !transcription) return;

        try {
            const transcriptionText = typeof transcription === 'string' 
                ? transcription 
                : transcription.toString();

            // Store the transcription for later use
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

    // ... [remaining methods stay the same] ...
}

window.addEventListener('load', () => {
    new AudioRecorder();
});
