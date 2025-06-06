import * as z from 'zod'
import { composable, withSchema } from 'composable-functions'
import { makeService } from 'make-service'

const reqRes = makeService('https://reqres.in/api')

const colorSchema = z.object({
  id: z.coerce.number(),
  name: z.string(),
  year: z.coerce.number(),
  color: z.string(),
  pantone_value: z.string(),
})

const listColors = composable(async ({ page = '1' }: { page?: string }) => {
  const response = await reqRes.get('/colors', { query: { page } })
  return response.json(z.object({ data: z.array(colorSchema) }))
})

const getColor = composable(async ({ id }: { id: string }) => {
  const response = await reqRes.get('/colors/:id', { params: { id } })
  return response.json(z.object({ data: colorSchema }))
})

const mutateColor = withSchema(
  z.object({
    id: z.string(),
    color: z.string().min(1, 'Color is required'),
  }),
)(async ({ id, color }) => {
  const response = await reqRes.post('/colors/:id', {
    params: { id },
    body: { color },
  })
  await response.json(colorSchema.pick({ id: true }))
  return { color }
})

export { listColors, getColor, mutateColor }
