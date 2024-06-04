import { type ResultPromise, execa as exec } from 'execa'
import type { InstanceStartOptions_internal } from '../instance.js'
import { stripColors } from '../utils.js'

export type Process_internal = ResultPromise<{ cleanup: true; reject: false }>

export type ExecaStartOptions = InstanceStartOptions_internal & {
  resolver(options: {
    process: Process_internal
    reject(error: Error): void
    resolve(): void
  }): void
}

export type ExecaParameters = { name: string }

export type ExecaProcess = {
  _internal: {
    process: Process_internal
  }
  name: string
  start(
    command: (x: typeof exec) => void,
    options: ExecaStartOptions,
  ): Promise<void>
  stop(): Promise<void>
}
export type ExecaReturnType = ExecaProcess

export function execa(parameters: ExecaParameters): ExecaReturnType {
  const { name } = parameters

  let process: Process_internal

  async function stop() {
    const killed = process.kill()
    if (!killed) throw new Error(`Failed to stop process "${name}".`)
    return new Promise((resolve) => process.on('close', resolve))
  }

  return {
    _internal: {
      get process() {
        return process
      },
    },
    name,
    start(command, { emitter, resolver, status }) {
      const { promise, resolve, reject } = Promise.withResolvers<void>()

      process = command(
        exec({
          cleanup: true,
          reject: false,
        }) as any,
      ) as unknown as Process_internal

      resolver({
        process,
        reject,
        resolve() {
          emitter.emit('listening')
          return resolve()
        },
      })

      process.stdout.on('data', (data) => {
        const message = stripColors(data.toString())
        emitter.emit('message', message)
        emitter.emit('stdout', message)
      })
      process.stderr.on('data', async (data) => {
        const message = stripColors(data.toString())
        emitter.emit('message', message)
        emitter.emit('stderr', message)
        await stop()
        reject(
          new Error(`Failed to start process "${name}": ${data.toString()}`),
        )
      })
      process.on('close', () => process.removeAllListeners())
      process.on('exit', (code, signal) => {
        emitter.emit('exit', code, signal)

        if (!code) {
          process.removeAllListeners()
          if (status === 'starting')
            reject(new Error(`Failed to start process "${name}": exited.`))
        }
      })

      return promise
    },
    async stop() {
      process.removeAllListeners()
      await stop()
    },
  }
}
