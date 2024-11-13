import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Recording {
  'id' : bigint,
  'audio' : Uint8Array | number[],
  'transcription' : [] | [string],
}
export interface _SERVICE {
  'generateStudyGuide' : ActorMethod<[string], string>,
  'getAllRecordings' : ActorMethod<[], Array<[bigint, Recording]>>,
  'storeRecording' : ActorMethod<[Uint8Array | number[]], bigint>,
  'transcribeRecording' : ActorMethod<[bigint], string>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
