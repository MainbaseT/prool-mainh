import getPort from 'get-port'
import { Instance } from 'prool/testcontainers'
import { afterEach, expect, test } from 'vitest'

const instances: Instance.Instance[] = []
const slowTestTimeout = 30_000

const port = await getPort()

const defineInstance = (parameters: Instance.tempo.Parameters = {}) => {
  const instance = Instance.tempo({ port, ...parameters })
  instances.push(instance)
  return instance
}

afterEach(async () => {
  for (const instance of instances) await instance.stop().catch(() => {})
})

test('default', { timeout: slowTestTimeout }, async () => {
  const messages: string[] = []
  const stdouts: string[] = []

  const instance = defineInstance()

  instance.on('message', (m) => messages.push(m))
  instance.on('stdout', (m) => stdouts.push(m))

  expect(instance.messages.get()).toMatchInlineSnapshot('[]')

  await instance.start()
  expect(instance.status).toEqual('started')

  expect(messages.join('')).toBeDefined()
  expect(stdouts.join('')).toBeDefined()
  expect(instance.messages.get().join('')).toBeDefined()

  await instance.stop()
  expect(instance.status).toEqual('stopped')

  expect(messages.join('')).toBeDefined()
  expect(stdouts.join('')).toBeDefined()
  expect(instance.messages.get()).toMatchInlineSnapshot('[]')
})

test('behavior: instance errored (duplicate container names)', async () => {
  const containerName = `tempo.duplicate.${crypto.randomUUID()}`
  const instance_1 = defineInstance({ containerName, port: 8546 })
  const instance_2 = defineInstance({ containerName, port: 8547 })

  await instance_1.start()
  await expect(() => instance_2.start()).rejects.toThrowError()
})

test(
  'behavior: start and stop multiple times',
  { timeout: slowTestTimeout },
  async () => {
    const instance = defineInstance()

    await instance.start()
    await instance.stop()
    await instance.start()
    await instance.stop()
    await instance.start()
    await instance.stop()
    await instance.start()
    await instance.stop()
  },
)

test('behavior: can subscribe to stdout', async () => {
  const messages: string[] = []
  const instance = defineInstance()
  instance.on('stdout', (message) => messages.push(message))

  await instance.start()
  expect(messages.length).toBeGreaterThanOrEqual(1)
})

test.skip('behavior: can subscribe to stderr', () => {})
