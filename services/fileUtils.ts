
/**
 * Convert a File to Base64 safely.
 * Returns an object containing:
 *   base64: string
 *   mimeType: string
 *   fileName: string
 *   size: number (bytes)
 */
export const fileToBase64 = (file: File): Promise<{
  base64: string;
  mimeType: string;
  fileName: string;
  size: number;
}> => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result as string;

        if (!result.includes(',')) {
          reject(new Error('Invalid Base64 format returned.'));
          return;
        }

        const base64String = result.split(',')[1];

        resolve({
          base64: base64String,
          mimeType: file.type || 'application/octet-stream',
          fileName: file.name,
          size: file.size
        });
      };

      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);

    } catch (error) {
      reject(error);
    }
  });
};


/**
 * Create a lightweight preview URL for images.
 * Use this for showing a thumbnail before uploading.
 */
export const fileToPreviewURL = (file: File): string | null => {
  if (!file.type.startsWith('image/')) return null;
  return URL.createObjectURL(file);
};


/**
 * Returns human-readable file size
 * Example: 153600 → "150 KB"
 */
export const formatFileSize = (sizeInBytes: number): string => {
  if (sizeInBytes < 1024) return `${sizeInBytes} bytes`;
  if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
};


/**
 * Sanitizes file name for safe display/storage.
 */
export const sanitizeFileName = (name: string): string => {
  return name.replace(/[^\w.\-() ]+/g, '_');
};