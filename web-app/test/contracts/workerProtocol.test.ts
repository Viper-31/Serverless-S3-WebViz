import { describe, expect, it } from 'vitest'
import { createWorkerClient } from '../../src/lib/workerProtocol'

function createFakeWorker() {
  const listeners = new Set<(event: MessageEvent) => void>()
  const postedMessages: unknown[] = []
  return {
    postedMessages,
    postMessage: (message: unknown) => { postedMessages.push(message) },
    addEventListener: (_type: 'message', listener: (event: MessageEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: 'message', listener: (event: MessageEvent) => void) => listeners.delete(listener),
    emit(data: unknown) {
      const event = { data } as MessageEvent
      for (const listener of listeners) listener(event)
    },
  }
}

describe('worker protocol', () => {
  it('correlates requests by id and resolves out of order', async () => {
    const worker = createFakeWorker()
    const client = createWorkerClient(worker)

    const first = client.request('load', { id: 'a' })
    const second = client.request('load', { id: 'b' })

    expect(worker.postedMessages).toEqual([
      { id: 1, type: 'load', payload: { id: 'a' } },
      { id: 2, type: 'load', payload: { id: 'b' } },
    ])

    worker.emit({ id: 2, type: 'success', payload: { ok: 'b' } })
    worker.emit({ id: 1, type: 'success', payload: { ok: 'a' } })

    await expect(second).resolves.toEqual({ ok: 'b' })
    await expect(first).resolves.toEqual({ ok: 'a' })
  })

  it('sends typed payloads and surfaces structured errors', async () => {
    const worker = createFakeWorker()
    const client = createWorkerClient(worker)
    const promise = client.request('decode', { path: 'x' })

    expect(worker.postedMessages[0]).toEqual({ id: 1, type: 'decode', payload: { path: 'x' } })

    worker.emit({ id: 1, type: 'error', payload: { name: 'DecodeError', message: 'bad chunk', stack: 'stack' } })

    await expect(promise).rejects.toMatchObject({ name: 'DecodeError', message: 'bad chunk' })
  })
})
