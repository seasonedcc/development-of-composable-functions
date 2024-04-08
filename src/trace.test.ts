import { assertIsError } from 'https://deno.land/std@0.206.0/assert/assert_is_error.ts'
import { assertEquals, describe, it } from './test-prelude.ts'
import { z } from './test-prelude.ts'

import { mdf } from './constructor.ts'
import { fromSuccess, trace } from './domain-functions.ts'
import type { DomainFunction } from './types.ts'
import type { Equal, Expect } from './types.test.ts'

describe('trace', () => {
  it('converts trace exceptions to df failures', async () => {
    const a = mdf(z.object({ id: z.number() }))(({ id }) => id + 1)

    const c = trace(() => {
      throw new Error('Problem in tracing')
    })(a)
    type _R = Expect<Equal<typeof c, DomainFunction<number>>>

    const result = await c({ id: 1 })

    assertIsError(result.errors[0], Error, 'Problem in tracing')
  })

  it('intercepts inputs and outputs of a given domain function', async () => {
    const a = mdf(z.object({ id: z.number() }))(({ id }) => id + 1)

    let contextFromFunctionA: {
      input: unknown
      environment: unknown
      result: unknown
    } | null = null

    const c = trace((context) => {
      contextFromFunctionA = context
    })(a)
    type _R = Expect<Equal<typeof c, DomainFunction<number>>>

    assertEquals(await fromSuccess(c)({ id: 1 }), 2)
    assertEquals(contextFromFunctionA, {
      input: { id: 1 },
      environment: undefined,
      result: { success: true, errors: [], data: 2 },
    })
  })
})
