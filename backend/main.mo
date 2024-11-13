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
    type StableSession = {
        id: Nat;
        audioChunks: [[Nat8]];
        currentTranscription: Text;
        timestamp: Int;
    };

    type TranscriptionSession = {
        id: Nat;
        audioChunks: Buffer.Buffer<[Nat8]>;
        currentTranscription: Text;
        timestamp: Time.Time;
    };

    private stable var nextId: Nat = 0;
    private stable var stableSessionsEntries: [(Nat, StableSession)] = [];
    private var sessions = HashMap.HashMap<Nat, TranscriptionSession>(0, Nat.equal, Hash.hash);

    private func toStableSession(session: TranscriptionSession) : StableSession {
        {
            id = session.id;
            audioChunks = Buffer.toArray(session.audioChunks);
            currentTranscription = session.currentTranscription;
            timestamp = session.timestamp;
        }
    };

    private func toRuntimeSession(session: StableSession) : TranscriptionSession {
        let buffer = Buffer.Buffer<[Nat8]>(session.audioChunks.size());
        for (chunk in session.audioChunks.vals()) {
            buffer.add(chunk);
        };
        {
            id = session.id;
            audioChunks = buffer;
            currentTranscription = session.currentTranscription;
            timestamp = session.timestamp;
        }
    };

    system func preupgrade() {
        let entries = sessions.entries();
        let entriesArray = Iter.toArray(entries);
        stableSessionsEntries := Array.map<(Nat, TranscriptionSession), (Nat, StableSession)>(
            entriesArray,
            func((k: Nat, v: TranscriptionSession)): (Nat, StableSession) {
                (k, toStableSession(v))
            }
        );
    };

    system func postupgrade() {
        let entries = Array.map<(Nat, StableSession), (Nat, TranscriptionSession)>(
            stableSessionsEntries,
            func((k: Nat, v: StableSession)): (Nat, TranscriptionSession) {
                (k, toRuntimeSession(v))
            }
        );
        sessions := HashMap.fromIter<Nat, TranscriptionSession>(
            entries.vals(),
            0,
            Nat.equal,
            Hash.hash
        );
    };

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
            case (null) {
                return false;
            };
            case (?session) {
                let updatedSession : TranscriptionSession = {
                    id = session.id;
                    audioChunks = session.audioChunks;
                    currentTranscription = session.currentTranscription # " " # transcription;
                    timestamp = Time.now();
                };
                
                sessions.put(sessionId, updatedSession);
                return true;
            };
        };
    };

    public query func getLatestTranscription(sessionId: Nat) : async ?Text {
        switch (sessions.get(sessionId)) {
            case (null) { null };
            case (?session) { ?session.currentTranscription };
        };
    };

    public shared func finalizeTranscription(sessionId: Nat) : async Bool {
        switch (sessions.get(sessionId)) {
            case (null) { false };
            case (?session) {
                true
            };
        };
    };

    public shared func generateStudyGuide(transcription: Text) : async Text {
        // Note: In a production environment, this would integrate with an AI service
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
