import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface _SERVICE {
  'finalizeTranscription' : ActorMethod<[bigint], boolean>,
  'generateStudyGuide' : ActorMethod<[string], string>,
  'getLatestTranscription' : ActorMethod<[bigint], [] | [string]>,
  'processTranscription' : ActorMethod<[bigint, string], boolean>,
  'startTranscription' : ActorMethod<[], bigint>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
