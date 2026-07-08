import {
  generateUploadButton,
  generateUploadDropzone,
} from "@uploadthing/react"

import type { OurFileRouter } from "@/app/api/uploadthing/core"

// Typed upload components bound to our FileRouter. Import these in client
// components to render an upload button or dropzone for room images.
export const UploadButton = generateUploadButton<OurFileRouter>()
export const UploadDropzone = generateUploadDropzone<OurFileRouter>()
