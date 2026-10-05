function waitForRetry(delay: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted()
    const onAbort = () => {
      clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
      reject(signal?.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, delay)
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

export async function retryRequest<T>(
  request: () => Promise<T>,
  signal?: AbortSignal,
  delays: readonly number[] = [1_000, 2_000, 4_000],
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted()
    try {
      const result = await request()
      signal?.throwIfAborted()
      return result
    } catch (error) {
      signal?.throwIfAborted()
      if (error instanceof Error && error.name === "AbortError") throw error
      if (attempt >= delays.length) throw error
      await waitForRetry(delays[attempt], signal)
    }
  }
}
