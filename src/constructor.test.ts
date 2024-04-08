import { assertIsError } from 'https://deno.land/std@0.206.0/assert/assert_is_error.ts'
import {
  assertEquals,
  assertObjectMatch,
  describe,
  it,
} from './test-prelude.ts'
import { z } from './test-prelude.ts'

import { makeSuccessResult, mdf, toComposable } from './constructor.ts'
import {
  EnvironmentError,
  InputError,
  InputErrors,
  ResultError,
  makeErrorResult,
} from './errors.ts'
import type { DomainFunction, SuccessResult } from './types.ts'
import type { Equal, Expect } from './types.test.ts'
import { Composable } from './composable/index.ts'

describe('toComposable', () => {
  it('returns a Composable with the same computation and all input errors in errors field', async () => {
    const handler = mdf(z.string())(() => 'no input!')
    const c = toComposable(handler)
    type _R = Expect<
      Equal<
        typeof c,
        Composable<(input?: unknown, environment?: unknown) => string>
      >
    >

    const {
      errors: [err],
    } = await c(1)
    assertIsError(err, Error, 'Expected string, received number')
  })

  it('returns a Composable with the same computation and same success result (we just care about the structural typing match)', async () => {
    const handler = mdf()(() => 'no input!')
    const c = toComposable(handler)
    type _R = Expect<
      Equal<
        typeof c,
        Composable<(input?: unknown, environment?: unknown) => string>
      >
    >

    assertObjectMatch(await c(), {
      success: true,
      data: 'no input!',
      errors: [],
    })
  })
})

describe('makeDomainFunction', () => {
  describe('when it has no input', () => {
    it('uses zod parser to create parse the input and call the domain function', async () => {
      const handler = mdf()(() => 'no input!')
      type _R = Expect<Equal<typeof handler, DomainFunction<string>>>

      assertEquals(await handler(), makeSuccessResult('no input!'))
    })

    it('fails gracefully if gets something other than undefined', async () => {
      const handler = mdf()(() => 'no input!')
      type _R = Expect<Equal<typeof handler, DomainFunction<string>>>

      assertEquals(
        await handler('some input'),
        makeErrorResult({
          errors: [new InputError('Expected undefined', '')],
        }),
      )
    })
  })

  describe('when it has no environment', () => {
    it('uses zod parser to create parse the input and call the domain function', async () => {
      const parser = z.object({ id: z.preprocess(Number, z.number()) })

      const handler = mdf(parser)(({ id }) => id)
      type _R = Expect<Equal<typeof handler, DomainFunction<number>>>

      assertEquals(await handler({ id: '1' }), makeSuccessResult(1))
    })

    it('fails gracefully if gets something other than empty record', async () => {
      const handler = mdf()(() => 'no input!')
      type _R = Expect<Equal<typeof handler, DomainFunction<string>>>

      assertEquals(
        await handler(undefined, ''),
        makeErrorResult({
          errors: [new EnvironmentError('Expected an object', '')],
        }),
      )
    })

    it('returns error when parsing fails', async () => {
      const parser = z.object({ id: z.preprocess(Number, z.number()) })
      const handler = mdf(parser)(({ id }) => id)
      type _R = Expect<Equal<typeof handler, DomainFunction<number>>>

      assertEquals(
        await handler({ missingId: '1' }),
        makeErrorResult({
          errors: [new InputError('Expected number, received nan', 'id')],
        }),
      )
    })
  })

  it('uses zod parsers to parse the input and environment and call the domain function', async () => {
    const parser = z.object({ id: z.preprocess(Number, z.number()) })
    const envParser = z.object({ uid: z.preprocess(Number, z.number()) })

    const handler = mdf(
      parser,
      envParser,
    )(({ id }, { uid }) => [id, uid] as const)
    type _R = Expect<
      Equal<typeof handler, DomainFunction<readonly [number, number]>>
    >

    assertEquals(
      await handler({ id: '1' }, { uid: '2' }),
      makeSuccessResult([1, 2]),
    )
  })

  it('applies async validations', async () => {
    const parser = z.object({
      id: z
        .preprocess(Number, z.number())
        .refine((value) => value !== 1, { message: 'ID already taken' }),
    })

    const envParser = z.object({
      uid: z
        .preprocess(Number, z.number())
        .refine((value) => value !== 2, { message: 'UID already taken' }),
    })

    const handler = mdf(parser, envParser)(({ id }, { uid }) => [id, uid])
    type _R = Expect<Equal<typeof handler, DomainFunction<number[]>>>

    assertEquals(
      await handler({ id: '1' }, { uid: '2' }),
      makeErrorResult({
        errors: [
          new InputError('ID already taken', 'id'),
          new EnvironmentError('UID already taken', 'uid'),
        ],
      }),
    )
  })

  it('accepts literals as input of domain functions', async () => {
    const handler = mdf(z.number(), z.string())((n) => n + 1)
    type _R = Expect<Equal<typeof handler, DomainFunction<number>>>

    const result = await handler(1, 'not going to be used')
    assertEquals((result as SuccessResult<number>).data, 2)
  })

  it('accepts sync functions', async () => {
    const handler = mdf(z.number())((n) => n + 1)
    type _R = Expect<Equal<typeof handler, DomainFunction<number>>>

    const result = await handler(1)
    assertEquals((result as SuccessResult<number>).data, 2)
  })

  it('returns error when environment parsing fails', async () => {
    const parser = z.object({ id: z.preprocess(Number, z.number()) })
    const envParser = z.object({ uid: z.preprocess(Number, z.number()) })

    const handler = mdf(parser, envParser)(({ id }, { uid }) => [id, uid])
    type _R = Expect<Equal<typeof handler, DomainFunction<number[]>>>

    assertEquals(
      await handler({ id: '1' }, {}),
      makeErrorResult({
        errors: [new EnvironmentError('Expected number, received nan', 'uid')],
      }),
    )
  })

  it('returns error when the domain function throws an Error', async () => {
    const handler = mdf(z.object({ id: z.number() }))(() => {
      throw new Error('Error')
    })
    type _R = Expect<Equal<typeof handler, DomainFunction<never>>>

    const {
      errors: [err],
    } = await handler({ id: 1 })
    assertIsError(err, Error, 'Error')
  })

  it('preserves entire original exception when the domain function throws an Error', async () => {
    const handler = mdf(z.object({ id: z.number() }))(() => {
      throw new Error('Some message', { cause: { someUnknownFields: true } })
    })
    type _R = Expect<Equal<typeof handler, DomainFunction<never>>>

    const {
      errors: [err],
    } = await handler({ id: 1 })
    assertIsError(err, Error, 'Some message')
    assertEquals(err.cause, { someUnknownFields: true })
  })

  it('returns error when the domain function throws a string', async () => {
    const handler = mdf(z.object({ id: z.number() }))(() => {
      throw 'Error'
    })
    type _R = Expect<Equal<typeof handler, DomainFunction<never>>>

    assertEquals(
      await handler({ id: 1 }),
      makeErrorResult({
        errors: [new Error('Error')],
      }),
    )
  })

  it('returns error when the domain function throws an object with message', async () => {
    const handler = mdf(z.object({ id: z.number() }))(() => {
      throw { message: 'Error' }
    })
    type _R = Expect<Equal<typeof handler, DomainFunction<never>>>

    assertObjectMatch(
      await handler({ id: 1 }),
      makeErrorResult({ errors: [{ message: 'Error' } as Error] }),
    )
  })

  it('returns inputErrors when the domain function throws an InputError', async () => {
    const handler = mdf(z.object({ id: z.number() }))(() => {
      throw new InputError('Custom input error', 'contact.id')
    })
    type _R = Expect<Equal<typeof handler, DomainFunction<never>>>

    assertEquals(
      await handler({ id: 1 }),
      makeErrorResult({
        errors: [new InputError('Custom input error', 'contact.id')],
      }),
    )
  })

  it('returns multiple inputErrors when the domain function throws an InputErrors', async () => {
    const handler = mdf(z.object({ id: z.number() }))(() => {
      throw new InputErrors([
        { message: 'Custom input error', path: 'contact.id' },
        { message: 'Another input error', path: 'contact.id' },
      ])
    })
    type _R = Expect<Equal<typeof handler, DomainFunction<never>>>

    assertEquals(
      await handler({ id: 1 }),
      makeErrorResult({
        errors: [
          new InputError('Custom input error', 'contact.id'),
          new InputError('Another input error', 'contact.id'),
        ],
      }),
    )
  })

  it('returns environmentErrors when the domain function throws an EnvironmentError', async () => {
    const handler = mdf(z.object({ id: z.number() }))(() => {
      throw new EnvironmentError('Custom env error', 'currentUser.role')
    })
    type _R = Expect<Equal<typeof handler, DomainFunction<never>>>

    assertEquals(
      await handler({ id: 1 }),
      makeErrorResult({
        errors: [new EnvironmentError('Custom env error', 'currentUser.role')],
      }),
    )
  })

  it('returns an error result when the domain function throws an ResultError', async () => {
    const handler = mdf(z.object({ id: z.number() }))(() => {
      throw new ResultError({
        errors: [new InputError('Custom input error', 'contact.id')],
      })
    })
    type _R = Expect<Equal<typeof handler, DomainFunction<never>>>

    assertEquals(
      await handler({ id: 1 }),
      makeErrorResult({
        errors: [new InputError('Custom input error', 'contact.id')],
      }),
    )
  })
})
