export type EditorHistory<State> = {
  past: State[]
  present: State
  future: State[]
}

export function createEditorHistory<State>(initial: State): EditorHistory<State> {
  return { past: [], present: initial, future: [] }
}

export function commitEditorHistory<State>(
  history: EditorHistory<State>,
  next: State,
): EditorHistory<State> {
  return {
    past: [...history.past, history.present],
    present: next,
    future: [],
  }
}

export function undoEditorHistory<State>(history: EditorHistory<State>): EditorHistory<State> {
  const previous = history.past.at(-1)
  if (previous === undefined) return history

  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  }
}

export function redoEditorHistory<State>(history: EditorHistory<State>): EditorHistory<State> {
  const next = history.future[0]
  if (next === undefined) return history

  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  }
}
