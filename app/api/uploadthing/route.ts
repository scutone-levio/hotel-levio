import { createRouteHandler } from "uploadthing/next"

import { ourFileRouter } from "./core"

// Serves the UploadThing endpoints (GET + POST) for the file router above.
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
})
