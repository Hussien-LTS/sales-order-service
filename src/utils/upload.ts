import { v2 as cloudinary } from "cloudinary";
import type { UploadApiResponse } from "cloudinary"; // Built-in types

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export async function uploadImage(
  fileBuffer: Buffer,
  folder: string = "products"
): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: "auto",
          transformation: [{ quality: "auto" }, { fetch_format: "auto" }],
        },
        (error: any, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            console.error("Upload failed", { error: error?.message });
            reject(error || new Error("Upload failed"));
            return;
          }

          console.info("Image uploaded successfully", {
            url: result.secure_url,
            public_id: result.public_id,
          });
          resolve(result.secure_url);
        }
      )
      .end(fileBuffer);
  });
}
