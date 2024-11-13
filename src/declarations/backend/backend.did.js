export const idlFactory = ({ IDL }) => {
  return IDL.Service({
    'finalizeTranscription' : IDL.Func([IDL.Nat], [IDL.Bool], []),
    'generateStudyGuide' : IDL.Func([IDL.Text], [IDL.Text], []),
    'getLatestTranscription' : IDL.Func(
        [IDL.Nat],
        [IDL.Opt(IDL.Text)],
        ['query'],
      ),
    'processAudioChunk' : IDL.Func(
        [IDL.Nat, IDL.Vec(IDL.Nat8)],
        [IDL.Bool],
        [],
      ),
    'startTranscription' : IDL.Func([], [IDL.Nat], []),
  });
};
export const init = ({ IDL }) => { return []; };
