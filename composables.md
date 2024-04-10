# Composables

## Composing type-safe functions
Let's say we ant to compose two functions: `add : (a: number, b:number) => number` and `toString : (a: number) => string`. We also want the composition to preserve the types, we can continue living in the happy world of type-safe coding, the result would be a function that adds and converts the result to string, something like `addAndReturnString : (a: number, b: number) => string`.

Performing this operation manually is straightforward

```typescript
function addAndReturnString(a: number, b: number) : string {
  return toString(add(a, b))
}
```

It would be neat if typescript could the typing for us and provided a more generic mechanism to compose these functions. Something like what you find in libraries such as [lodash](https://lodash.com/docs/4.17.15#flow)

Using composables the code could be written as:

```typescript
const addAndReturnString = pipe(add, toString)
```

We can also extend the same reasoning to functions that return promises in a transparent way. Imagine we have `add : (a: number, b:number) => Promise<number>` and `toString : (a: number) => Promise<string>`, the composition above would work in the same fashion, returning a function `addAndReturnString(a: number, b: number) : Promise<string>` that will wait for each promise in the chain before applying the next function.

This library also defines several operations besides the `pipe` to compose functions in arbitrary ways, giving a powerful tool for the developer to reason about the data flow without worrying about mistakenly connecting the wrong parameters or forgetting to unwrap some promise or handle some error along the way.

## Creating primitive composables

A `Composable` is a function that returns a `Promise<Result<T>>` where `T` is any type you want to return. Values of the type `Result` will represent either a failure (which carries a list of errors) or a success, where the computation has returned a value within the type `T`.

So we can define the `add` and the `toString` functions as a `Composable`:

```typescript
import { composable } from 'composable-functions'

const add = composable((a: number, b: number) => a + b)
        ^? Composable<(a: number, b: number) => number>

const toString = composable((a: unknown) => `${a}`)
```

## Sequential composition
Now we can compose them using pipe to create `addAndReturnString`:

```typescript
import { cf } from 'composable-functions'

const addAndReturnString = cf.pipe(add, toString)
       ^? Composable<(a: number, b: number) => string>
```

Note that trying to compose pipe flipping the arguments will not type-check:

```typescript
import { cf } from 'composable-functions'

const addAndReturnString = cf.pipe(toString, add)
       ^? ["Fail to compose", string, "does not fit in", number]
```

The error message comes in the form of an inferred type (the type checker error is a bit more cryptic).
Since pipe will compose from left to right, the only `string` output from `toString` will not fit into the first argument of `add` which is a `number`.

### Using non-composables (mapping)

Sometimes we want to use a simple function in this sort of sequential composition. Imagine that `toString` is not a composable, and you just want to apply a plain old function to the result of `add` when it succeeds.
The function `map` can be used for this, since we are mapping over the result of a `Composable`:

```typescript
import { cf } from 'composable-functions'

const addAndReturnString = cf.map(add, String)
```

Note that if your mapper function has to be `async` you should wrap it in `composable` and use `pipe` instead.

## Parallel composition

There are also functions compositions where all its parameters are excuted in parallel, like `Promise.all` will execute several promises and wait for all of them.
The `all` function is one way of composing in this fashion. Assuming we want to apply our `add` and multiply the two numbers returning a success only once both operations succeed:

```typescript
import { composable, cf } from 'composable-functions'

const add = composable((a: number, b: number) => a + b)
const mul = composable((a: number, b: number) => a * b)
const addAndMul = cf.all(add, mul)
       ^? Composable<(args_0: number, args_1: number) => [number, number]>
```

The result of the composition comes in a tuple in the same order as the functions were passed to `all`.
Note that the input functions will also have to type-check and all the functions have to work from the same input.

## Handling errors
Since a `Composable` always return a type `Result<T>` that might be either a failure or a success, there are never exceptions to catch. Any exception inside a `Composable` will return as an object with the shape: `{ success: false, errors: Error[] }`.

Two neat consequences is that we can handle errors using functions (no need for try/catch blocks) and handle multiple errors at once.

### Catching errors
To catch an error you need a second `Composable` capable of receiving `{ errors: Error[] }`. This composable is called when the first function fails:

```typescript
import { composable, cf } from 'composable-functions'

const fetchBody = composable((url: string) => fetch(url).then((r) => r.text()))
const emptyOnError = composable(({errors}: { errors: Error[] }) => {
  console.error("Something went wrong, returning empty string", errors)
  return ""
})
const fetchThatNeverFails = cf.catchError(fetchBody, emptyOnError)
```

### Mapping errors
Sometimes we just need to transform one error into something that would make more sense for the caller. Imagine you have our `fetchBody` defined above, but we want a custom error type for when the input URL is invalid. You can map over the failures using `mapError` and a function with the type `({ errors: Error[] }) => { errors: Error[] }`.

```typescript
import { cf } from 'composable-functions'

class InvalidUrlError extends Error {}
const fetchBodyWithCustomError = cf.mapError(fetchBody, (errors) =>
  errors.map((e) => e.message.includes('Invalid URL') ? new InvalidUrlError() : e)
)
```
