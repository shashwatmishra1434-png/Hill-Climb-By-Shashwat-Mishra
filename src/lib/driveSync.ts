// Google Drive State Sync Helper
// Uses the native Google Drive REST API with bearer token

export interface SaveState {
  bankCoins: number;
  unlockedVehicles: string[];
  upgrades: any;
  selectedVehicleId: string;
  selectedStageId: string;
}

// Search for the existing save file in user's Google Drive
export async function findSaveFile(accessToken: string): Promise<string | null> {
  try {
    const query = encodeURIComponent("name = 'hill_climb_multiverse_save.json' and trashed = false");
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    if (!response.ok) {
      throw new Error(`File search failed: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (error) {
    console.error("Error finding save file in Google Drive:", error);
    return null;
  }
}

// Download save file content by ID
export async function downloadSaveFile(accessToken: string, fileId: string): Promise<SaveState | null> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    if (!response.ok) {
      throw new Error(`File download failed: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error downloading save file:", error);
    return null;
  }
}

// Upload/Save progression state to user's Google Drive
export async function uploadSaveFile(accessToken: string, saveData: SaveState): Promise<boolean> {
  try {
    // 1. Find if file already exists
    let fileId = await findSaveFile(accessToken);

    if (fileId) {
      // 2. File exists - Update it (PATCH payload as media)
      const updateResponse = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(saveData),
        }
      );
      return updateResponse.ok;
    } else {
      // 3. File doesn't exist - Create metadata first
      const createResponse = await fetch(
        "https://www.googleapis.com/drive/v3/files",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "hill_climb_multiverse_save.json",
            mimeType: "application/json",
          }),
        }
      );
      if (!createResponse.ok) {
        throw new Error("Failed to create file metadata in Google Drive");
      }
      const meta = await createResponse.json();
      fileId = meta.id;

      // 4. Update the content
      const mediaResponse = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(saveData),
        }
      );
      return mediaResponse.ok;
    }
  } catch (error) {
    console.error("Error uploading save file to Google Drive:", error);
    return false;
  }
}
