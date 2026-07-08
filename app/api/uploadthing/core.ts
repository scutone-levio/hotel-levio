import { createUploadthing, type FileRouter } from "uploadthing/next"

const f = createUploadthing()

// FileRouter for room image management. Each endpoint here is exposed to the
// client via the generated upload components in `lib/uploadthing.ts`.
export const ourFileRouter = {
  // Endpoint for uploading room photos (admin-facing).
  roomImage: f({
    image: { maxFileSize: "4MB", maxFileCount: 5 },
  })
    .middleware(async () => {
      // Add real auth here (e.g. verify the admin session) in production.
      return { uploadedBy: "admin" }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log(
        "Room image uploaded by",
        metadata.uploadedBy,
        "->",
        file.ufsUrl,
      )
      // Return value is sent to the client `onClientUploadComplete`.
      return { url: file.ufsUrl }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
