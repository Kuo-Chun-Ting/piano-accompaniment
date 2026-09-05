import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

const input = process.argv[2]!
if (basename(input).startsWith('fail')) {
  console.error('Fixture model failure')
  process.exitCode = 1
} else if (basename(input).startsWith('cancel')) {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  await writeFile(join(dirname(input), 'pids.json'), JSON.stringify([process.pid, child.pid]))
  console.log('→ separate-piano')
  setInterval(() => {}, 1000)
} else {
  process.stdout.write('→ transcribe-')
  await new Promise(resolve => setTimeout(resolve, 10))
  process.stdout.write('midi\n')
  console.error('Fixture diagnostic')
}
