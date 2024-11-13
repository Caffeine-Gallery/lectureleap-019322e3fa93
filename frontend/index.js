import { backend } from "declarations/backend";

class AudioRecorder {
    // ... previous code remains the same until stopRecording method ...

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
        if (!this.recordingsList || !transcription) return;

        try {
            const transcriptionText = typeof transcription === 'string' 
                ? transcription 
                : transcription.toString();

            const recordingElement = document.createElement('div');
            recordingElement.innerHTML = `
                <div class="uk-card uk-card-default uk-card-body">
                    <h4 class="uk-card-title">Recording ${recordingId}</h4>
                    <p class="uk-text-truncate">${transcriptionText.substring(0, 100)}...</p>
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
        } catch (error) {
            console.error('Error adding recording to list:', error);
            UIkit.notification({
                message: 'Error displaying recording. Please try again.',
                status: 'warning'
            });
        }
    }

    // ... rest of the code remains the same ...
}

window.addEventListener('load', () => {
    new AudioRecorder();
});
