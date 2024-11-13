import Bool "mo:base/Bool";
import Nat8 "mo:base/Nat8";

import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import HashMap "mo:base/HashMap";
import Hash "mo:base/Hash";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Int "mo:base/Int";

actor {
    type TranscriptionSession = {
        id: Nat;
        audioChunks: Buffer.Buffer<[Nat8]>;
        currentTranscription: Text;
        timestamp: Time.Time;
    };

    private stable var nextId: Nat = 0;
    private var sessions = HashMap.HashMap<Nat, TranscriptionSession>(0, Nat.equal, Hash.hash);

    public shared func startTranscription() : async Nat {
        let sessionId = nextId;
        nextId += 1;

        let newSession : TranscriptionSession = {
            id = sessionId;
            audioChunks = Buffer.Buffer<[Nat8]>(0);
            currentTranscription = "";
            timestamp = Time.now();
        };

        sessions.put(sessionId, newSession);
        sessionId
    };

    public shared func processTranscription(sessionId: Nat, transcription: Text) : async Bool {
        switch (sessions.get(sessionId)) {
            case (null) { false };
            case (?session) {
                let updatedSession : TranscriptionSession = {
                    id = session.id;
                    audioChunks = session.audioChunks;
                    currentTranscription = session.currentTranscription # " " # transcription;
                    timestamp = Time.now();
                };
                sessions.put(sessionId, updatedSession);
                true
            };
        };
    };

    public query func getLatestTranscription(sessionId: Nat) : async Text {
        switch (sessions.get(sessionId)) {
            case (null) { "" };
            case (?session) { session.currentTranscription };
        };
    };

    public shared func finalizeTranscription(sessionId: Nat) : async Bool {
        switch (sessions.get(sessionId)) {
            case (null) { false };
            case (?session) { true };
        };
    };

    public shared func generateStudyGuide(transcription: Text) : async Text {
        return "Study Guide:\n\n" #
               "1. Key Points:\n" #
               "   - " # transcription # "\n\n" #
               "2. Summary:\n" #
               "   Based on the transcription above.\n\n" #
               "3. Questions for Review:\n" #
               "   - What are the main concepts discussed?\n" #
               "   - How do these ideas connect?\n";
    };
}
