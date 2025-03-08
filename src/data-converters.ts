/**
 * Encodes a File object to a Base64-encoded string (Data URL)
 * @param file The File object to encode
 * @returns A Promise that resolves to the Base64-encoded string
 */
export function encodeFile(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (reader.result) {
        resolve(reader.result as string);
      } else {
        reject(new Error("Could not read file."));
      }
    };

    reader.onerror = (error) => {
      reject(error);
    };

    // This will encode the file as a Base64-encoded string (Data URL)
    reader.readAsDataURL(file);
  });
}

/**
 * Convert a Base64-encoded string (with Data URL prefix) to a File object
 * @param base64String The Base64 string (Data URL format: data:<mime>;base64,<encoded>)
 * @param fileName     The name to be given to the resulting File
 */
export function decodeFile(base64String: string, fileName: string): File {
  // Split the base64 string into two parts: "data:mime/type;base64," and the raw base64 data
  const [prefix, base64Data] = base64String.split(",");

  // If the string is not in a valid data URL format, throw an error or handle it accordingly
  if (!prefix || !base64Data) {
    throw new Error("Invalid Base64 string format.");
  }

  // Extract the mime type from the prefix (e.g. "data:image/png;base64")
  const mimeMatch = prefix.match(/:(.*?);/);
  if (!mimeMatch || mimeMatch.length < 2) {
    throw new Error("Could not extract MIME type.");
  }
  const mimeType = mimeMatch[1];

  // Decode the Base64 string
  const byteString = atob(base64Data);

  // Create an array buffer of the decoded string
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  // Create a File from the ArrayBuffer
  return new File([ab], fileName, { type: mimeType });
}

export type EncodedFormDataItem =
  | {
      dataType: "file";
      fileName: string;
      fileType: string;
      fileSize: number;
      content: string;
    }
  | {
      dataType: "text";
      content: string;
    };

export type EncodedFormData = {
  dataType: "formData";
  items: Record<string, EncodedFormDataItem>;
};

export const isEncodedFormDataItem = (
  item: unknown
): item is EncodedFormDataItem => {
  return (
    typeof item === "object" &&
    item !== null &&
    "dataType" in item &&
    (item.dataType === "file" || item.dataType === "text")
  );
};

export const isEncodedFormData = (data: unknown): data is EncodedFormData => {
  return (
    typeof data === "object" &&
    data !== null &&
    "dataType" in data &&
    data.dataType === "formData" &&
    "items" in data &&
    typeof data.items === "object" &&
    data.items !== null &&
    Object.values(data.items).every(isEncodedFormDataItem)
  );
};

/**
 * Encodes a FormData object to an EncodedFormData object
 * @param {FormData} formData The FormData object to encode
 * @returns {Promise<EncodedFormData>} The EncodedFormData object
 */
export const encodeFormData = async (
  formData: FormData
): Promise<EncodedFormData> => {
  const encodedFormData: EncodedFormData = {
    dataType: "formData",
    items: {},
  };
  const fileContentPromises: Array<Promise<string>> = [];

  formData.forEach(async (value, key) => {
    if (value instanceof File) {
      const fileContentPromise = encodeFile(value);
      fileContentPromises.push(fileContentPromise);

      encodedFormData.items[key] = {
        dataType: "file",
        fileName: value.name,
        fileType: value.type,
        fileSize: value.size,
        content: await fileContentPromise,
      };
    } else {
      encodedFormData.items[key] = {
        dataType: "text",
        content: value,
      };
    }
  });

  await Promise.all(fileContentPromises);

  return encodedFormData;
};

/**
 * Decodes a plain object back into a FormData object.
 * @param {EncodedFormData} encodedData - The plain object representation of the FormData.
 * @returns {FormData} A reconstructed FormData object.
 */
export const decodeFormData = (encodedData: EncodedFormData): FormData => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(encodedData.items)) {
    if (value.dataType === "file") {
      const file = decodeFile(value.content, value.fileName);
      formData.append(key, file, file.name);
    } else {
      formData.append(key, value.content);
    }
  }
  return formData;
};

/**
 * Recursively encodes all FormData objects found in the input data
 * @param data Any object that might contain FormData values
 * @returns A Promise that resolves to a new object with all FormData encoded
 */
export const encodeNestedFormData = async (data: any): Promise<any> => {
  if (data instanceof File) {
    return encodeFile(data);
  }

  if (data instanceof FormData) {
    return encodeFormData(data);
  }

  if (Array.isArray(data)) {
    const encodedArray = await Promise.all(
      data.map((item) => encodeNestedFormData(item))
    );
    return encodedArray;
  }

  if (data && typeof data === "object") {
    const encodedObject: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      encodedObject[key] = await encodeNestedFormData(value);
    }
    return encodedObject;
  }

  return data;
};

/**
 * Recursively decodes all EncodedFormData objects found in the input data
 * @param data Any object that might contain EncodedFormData values
 * @returns A new object with all EncodedFormData decoded back to FormData
 */
export const decodeNestedFormData = (data: any): any => {
  if (typeof data === "string") {
    try {
      return decodeFile(data, "unknown-filename");
    } catch (e) {
      return data;
    }
  }

  if (isEncodedFormData(data)) {
    return decodeFormData(data);
  }

  if (Array.isArray(data)) {
    return data.map((item) => decodeNestedFormData(item));
  }

  if (data && typeof data === "object") {
    const decodedObject: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      decodedObject[key] = decodeNestedFormData(value);
    }
    return decodedObject;
  }

  return data;
};
