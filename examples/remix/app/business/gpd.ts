import { z } from 'zod'
import { withSchema } from 'composable-functions'
import { createCookie } from '@remix-run/node'

const cookie = createCookie('gpd', {
  maxAge: 20, // seconds
})

const getGPDInfo = withSchema(
  z.any(),
  // The "environment" knows there can be cookie information in the Request
  z.object({ agreed: z.boolean().optional() }),
)(async (_input, { agreed }) => {
  return { agreed }
})

const agreeToGPD = withSchema(
  // Agreeing to the GPD is user input
  z.object({ agree: z.preprocess((v) => v === 'true', z.boolean()) }),
)(async ({ agree }) => ({ agreed: agree }))

export { cookie, agreeToGPD, getGPDInfo }
