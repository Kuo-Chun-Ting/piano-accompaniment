type PrintableDocument = {
  title: string
}

type PrintableWindow = {
  print: () => void
  addEventListener: (
    event: 'afterprint',
    listener: () => void,
    options: { once: true },
  ) => void
}

type ExportScoreAsPdfInput = {
  document: PrintableDocument
  window: PrintableWindow
  scoreTitle: string
}

export function exportScoreAsPdf(input: ExportScoreAsPdfInput): void {
  const originalTitle = input.document.title
  input.document.title = `${input.scoreTitle} - Piano accompaniment`
  input.window.addEventListener('afterprint', () => {
    input.document.title = originalTitle
  }, { once: true })
  input.window.print()
}
