import { NativeModules, NativeEventEmitter } from "react-native";

const { CallRecorderModule } = NativeModules;

export const callRecorder = {
  // Check permissions
  async checkPermissions() {
    if (!CallRecorderModule) return { recordAudioGranted: false, phoneStateGranted: false };
    return await CallRecorderModule.checkRecordingPermissions();
  },

  // Start recording a call
  async startRecording(phoneNumber) {
    if (!CallRecorderModule) throw new Error("CallRecorderModule not available");
    return await CallRecorderModule.startRecording(phoneNumber);
  },

  // Stop current recording
  async stopRecording() {
    if (!CallRecorderModule) throw new Error("CallRecorderModule not available");
    return await CallRecorderModule.stopRecording();
  },

  // Get current recording status
  async getStatus() {
    if (!CallRecorderModule) return { isRecording: false };
    return await CallRecorderModule.getRecordingStatus();
  },

  // Get recent recordings
  async getRecent(maxResults = 50) {
    if (!CallRecorderModule) return [];
    return await CallRecorderModule.getRecentRecordings(maxResults);
  },

  // Delete a recording
  async deleteRecording(filepath) {
    if (!CallRecorderModule) throw new Error("CallRecorderModule not available");
    return await CallRecorderModule.deleteRecording(filepath);
  },

  // Listen to recording events
  addListener(callback) {
    if (!CallRecorderModule) return null;
    
    const emitter = new NativeEventEmitter(CallRecorderModule);
    
    const sub1 = emitter.addListener("callRecordingStarted", (event) => {
      console.log("[RECORDING_STARTED]", event);
      callback({ type: "started", ...event });
    });
    
    const sub2 = emitter.addListener("callRecordingStopped", (event) => {
      console.log("[RECORDING_STOPPED]", event);
      callback({ type: "stopped", ...event });
    });
    
    return {
      remove: () => {
        sub1.remove();
        sub2.remove();
      }
    };
  }
};

export default callRecorder;
