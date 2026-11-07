/**
 * manualRecordingUpload.js
 * 
 * Allows users to manually upload call recordings from their device storage
 * (e.g. recordings made by phone's native call recorder app)
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { api } from './api';

/**
 * Pick an audio file from device storage
 * @returns {Promise<{success: boolean, file?: object, error?: string}>}
 */
export async function pickRecordingFile() {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/*', 'audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/wav', 'audio/3gp', 'audio/amr'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false, error: 'No file selected' };
    }

    const file = result.assets[0];
    
    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      return { success: false, error: 'File too large. Maximum size is 100MB' };
    }

    console.log('[MANUAL_UPLOAD] File picked:', {
      name: file.name,
      size: file.size,
      uri: file.uri,
      mimeType: file.mimeType,
    });

    return { 
      success: true, 
      file: {
        uri: file.uri,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType || 'audio/mpeg',
      }
    };
  } catch (error) {
    console.error('[MANUAL_UPLOAD] Error picking file:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Upload a manual recording for a specific call
 * @param {string} callId - The call ID (from server)
 * @param {object} file - File object from pickRecordingFile
 * @param {function} onProgress - Callback for upload progress (0-100)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function uploadManualRecording(callId, file, onProgress) {
  try {
    console.log('[MANUAL_UPLOAD] Starting upload for call:', callId);

    // Create form data
    const formData = new FormData();
    
    // Add file
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'audio/mpeg',
    });

    // Get auth token
    const token = await api.getToken();
    
    // Upload to backend
    const response = await fetch(`${api.baseUrl}/api/calls/${callId}/recording`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Upload failed';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.detail || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[MANUAL_UPLOAD] Upload successful:', result);

    return { success: true };
  } catch (error) {
    console.error('[MANUAL_UPLOAD] Upload failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Combined function: pick and upload in one call
 * @param {string} callId - The call ID
 * @param {function} onProgress - Progress callback
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function pickAndUploadRecording(callId, onProgress) {
  const pickResult = await pickRecordingFile();
  
  if (!pickResult.success) {
    return pickResult;
  }

  return await uploadManualRecording(callId, pickResult.file, onProgress);
}
