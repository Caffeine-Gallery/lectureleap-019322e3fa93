export const idlFactory = ({ IDL }) => {
  const Recording = IDL.Record({
    'id' : IDL.Nat,
    'audio' : IDL.Vec(IDL.Nat8),
    'transcription' : IDL.Opt(IDL.Text),
  });
  return IDL.Service({
    'generateStudyGuide' : IDL.Func([IDL.Text], [IDL.Text], []),
    'getAllRecordings' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Nat, Recording))],
        ['query'],
      ),
    'storeRecording' : IDL.Func([IDL.Vec(IDL.Nat8)], [IDL.Nat], []),
    'transcribeRecording' : IDL.Func([IDL.Nat], [IDL.Text], []),
  });
};
export const init = ({ IDL }) => { return []; };
