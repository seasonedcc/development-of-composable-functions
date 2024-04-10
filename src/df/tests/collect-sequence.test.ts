import {
  assertEquals,
  assertIsError,
  describe,
  it,
  z,
} from '../../test-prelude.ts'
import {
  df,
  EnvironmentError,
  failure,
  InputError,
  success,
} from '../../index.ts'
import type { DomainFunction } from '../../index.ts'

describe('collectSequence', () => {
  it('should compose domain functions keeping the given order of keys', async () => {
    const a = df.make(z.object({ id: z.number() }))(({ id }) => ({
      id: id + 2,
    }))
    const b = df.make(z.object({ id: z.number() }))(({ id }) => id - 1)

    const c = df.collectSequence({ a, b })
    type _R = Expect<
      Equal<typeof c, DomainFunction<{ a: { id: number }; b: number }>>
    >

    assertEquals(await c({ id: 1 }), success({ a: { id: 3 }, b: 2 }))
  })

  it('should use the same environment in all composed functions', async () => {
    const a = df.make(
      z.undefined(),
      z.object({ env: z.number() }),
    )((_input, { env }) => ({
      inp: env + 2,
    }))
    const b = df.make(
      z.object({ inp: z.number() }),
      z.object({ env: z.number() }),
    )(({ inp }, { env }) => inp + env)

    const c = df.collectSequence({ a, b })
    type _R = Expect<
      Equal<typeof c, DomainFunction<{ a: { inp: number }; b: number }>>
    >

    assertEquals(
      await c(undefined, { env: 1 }),
      success({ a: { inp: 3 }, b: 4 }),
    )
  })

  it('should fail on the first environment parser failure', async () => {
    const envParser = z.object({ env: z.number() })
    const a = df.make(
      z.undefined(),
      envParser,
    )((_input, { env }) => ({
      inp: env + 2,
    }))
    const b = df.make(
      z.object({ inp: z.number() }),
      envParser,
    )(({ inp }, { env }) => inp + env)

    const c = df.collectSequence({ a, b })
    type _R = Expect<
      Equal<typeof c, DomainFunction<{ a: { inp: number }; b: number }>>
    >

    assertEquals(
      await c(undefined, {}),
      failure([new EnvironmentError('Required', ['env'])]),
    )
  })

  it('should fail on the first input parser failure', async () => {
    const firstInputParser = z.undefined()

    const a = df.make(
      firstInputParser,
      z.object({ env: z.number() }),
    )((_input, { env }) => ({
      inp: env + 2,
    }))
    const b = df.make(
      z.object({ inp: z.number() }),
      z.object({ env: z.number() }),
    )(({ inp }, { env }) => inp + env)

    const c = df.collectSequence({ a, b })
    type _R = Expect<
      Equal<typeof c, DomainFunction<{ a: { inp: number }; b: number }>>
    >

    assertEquals(
      await c({ inp: 'some invalid input' }, { env: 1 }),
      failure([new InputError('Expected undefined, received object')]),
    )
  })

  it('should fail on the second input parser failure', async () => {
    const a = df.make(
      z.undefined(),
      z.object({ env: z.number() }),
    )(() => ({
      inp: 'some invalid input',
    }))
    const b = df.make(
      z.object({ inp: z.number() }),
      z.object({ env: z.number() }),
    )(({ inp }, { env }) => inp + env)

    const c = df.collectSequence({ a, b })
    type _R = Expect<
      Equal<typeof c, DomainFunction<{ a: { inp: string }; b: number }>>
    >

    assertEquals(
      await c(undefined, { env: 1 }),
      failure([new InputError('Expected number, received string', ['inp'])]),
    )
  })

  it('should compose more than 2 functions', async () => {
    const a = df.make(z.object({ aNumber: z.number() }))(({ aNumber }) => ({
      aString: String(aNumber),
    }))
    const b = df.make(z.object({ aString: z.string() }))(({ aString }) => ({
      aBoolean: aString == '1',
    }))
    const c = df.make(z.object({ aBoolean: z.boolean() }))(
      ({ aBoolean }) => !aBoolean,
    )

    const d = df.collectSequence({ a, b, c })
    type _R = Expect<
      Equal<
        typeof d,
        DomainFunction<{
          a: { aString: string }
          b: { aBoolean: boolean }
          c: boolean
        }>
      >
    >

    assertEquals(
      await d({ aNumber: 1 }),
      success({
        a: { aString: '1' },
        b: { aBoolean: true },
        c: false,
      }),
    )
  })
})