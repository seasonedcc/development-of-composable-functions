import { Internal } from './internal/types.ts'

type Failure = {
  success: false
  errors: Array<Error>
}

type Success<T = void> = {
  success: true
  data: T
  errors: []
}

type Result<T = void> = Success<T> | Failure

/**
 * Merges the data types of a list of objects.
 * @example
 * type MyObjs = [
 *   { a: string },
 *   { b: number },
 * ]
 * type MyData = MergeObjs<MyObjs>
 * //   ^? { a: string, b: number }
 */
type MergeObjs<Objs extends unknown[], output = {}> = Objs extends [
  infer first,
  ...infer rest,
] ? MergeObjs<rest, Internal.Prettify<Omit<output, keyof first> & first>>
  : output

type Composable<T extends (...args: any[]) => any = (...args: any[]) => any> = (
  ...args: Parameters<T>
) => Promise<Result<Awaited<ReturnType<T>>>>

type UnpackData<T extends Composable> = Extract<
  Awaited<ReturnType<T>>,
  { success: true }
>['data']

type UnpackAll<List extends Composable[]> = {
  [K in keyof List]: UnpackData<List[K]>
}

type SequenceReturn<Fns extends Composable[]> = Fns extends [
  Composable<(...args: infer P) => any>,
  ...any,
] ? Composable<(...args: P) => UnpackAll<Fns>>
  : Fns

type PipeReturn<Fns extends Composable[]> = Fns extends [
  Composable<(...args: infer P) => any>,
  ...any,
] ? Composable<(...args: P) => UnpackData<Extract<Last<Fns>, Composable>>>
  : Fns

type CanComposeInSequence<
  Fns extends any[],
  Arguments extends any[] = [],
> = Fns extends [Composable<(...a: infer PA) => infer OA>, ...infer restA]
  ? restA extends [
    Composable<
      (firstParameter: infer FirstBParameter, ...b: infer PB) => any
    >,
    ...unknown[],
  ]
    ? Internal.IsNever<Awaited<OA>> extends true
      ? Internal.FailToCompose<never, FirstBParameter>
    : Awaited<OA> extends FirstBParameter
      ? Internal.EveryElementTakes<PB, undefined> extends true
        ? CanComposeInSequence<
          restA,
          [...Arguments, Composable<(...a: PA) => OA>]
        >
      : Internal.EveryElementTakes<PB, undefined>
    : Internal.FailToCompose<Awaited<OA>, FirstBParameter>
  : [...Arguments, Composable<(...a: PA) => OA>]
  : never

type CanComposeInParallel<
  Fns extends any[],
  OriginalFns extends any[] = Fns,
> = Fns extends [Composable<(...a: infer PA) => any>, ...infer restA]
  ? restA extends [Composable<(...b: infer PB) => infer OB>, ...infer restB]
    ? Internal.SubtypesTuple<PA, PB> extends [...infer MergedP]
      ? CanComposeInParallel<
        [Composable<(...args: MergedP) => OB>, ...restB],
        OriginalFns
      >
    : Internal.FailToCompose<PA, PB>
  : Internal.ApplyArgumentsToFns<OriginalFns, PA>
  : never

type RecordToTuple<T extends Record<string, Composable>> =
  Internal.RecordValuesFromKeysTuple<T, Internal.Keys<T>>

type SerializableError<T extends Error = Error> = {
  exception: T
  message: string
  name: string
  path: string[]
}

type SerializedResult<T> =
  | Success<T>
  | { success: false; errors: SerializableError[] }

/**
 * The object used to validate either input or environment when creating domain functions.
 */
type ParserSchema<T extends unknown = unknown> = {
  safeParseAsync: (a: unknown) => Promise<
    | {
      success: true
      data: T
    }
    | {
      success: false
      error: { issues: { path: PropertyKey[]; message: string }[] }
    }
  >
}

type Last<T extends readonly unknown[]> = T extends [...infer _I, infer L] ? L
  : never

type BranchReturn<
  SourceComposable extends Composable,
  Resolver extends (
    ...args: any[]
  ) => Composable | null | Promise<Composable | null>,
> = CanComposeInSequence<
  [SourceComposable, Composable<Resolver>]
> extends Composable[]
  ? Awaited<ReturnType<Resolver>> extends null ? SourceComposable
  : CanComposeInSequence<
    [SourceComposable, Awaited<ReturnType<Resolver>>]
  > extends [Composable, ...any] ? Composable<
      (
        ...args: Parameters<
          CanComposeInSequence<
            [SourceComposable, Awaited<ReturnType<Resolver>>]
          >[0]
        >
      ) => null extends Awaited<ReturnType<Resolver>> ?
          | UnpackData<SourceComposable>
          | UnpackData<Extract<Awaited<ReturnType<Resolver>>, Composable>>
        : UnpackData<Extract<Awaited<ReturnType<Resolver>>, Composable>>
    >
  : CanComposeInSequence<[SourceComposable, Awaited<ReturnType<Resolver>>]>
  : CanComposeInSequence<[SourceComposable, Composable<Resolver>]>

export type {
  BranchReturn,
  CanComposeInParallel,
  CanComposeInSequence,
  Composable,
  Failure,
  Last,
  MergeObjs,
  ParserSchema,
  PipeReturn,
  RecordToTuple,
  Result,
  SequenceReturn,
  SerializableError,
  SerializedResult,
  Success,
  UnpackAll,
  UnpackData,
}
