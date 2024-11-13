export const idlFactory = ({ IDL }) => {
  return IDL.Service({
    'finalizeTranscription' : IDL.Func([IDL.Nat], [IDL.Bool], []),
    'generateStudyGuide' : IDL.Func([IDL.Text], [IDL.Text], []),
    'getLatestTranscription' : IDL.Func([IDL.Nat], [IDL.Text], ['query']),
    'processTranscription' : IDL.Func([IDL.Nat, IDL.Text], [IDL.Bool], []),
    'startTranscription' : IDL.Func([], [IDL.Nat], []),
  });
};
export const init = ({ IDL }) => { return []; };
