# Wake word detection script for Node.js subprocess communication
# Outputs JSON messages to stdout for Node.js to capture

from openwakeword.model import Model
import sounddevice as sd
import numpy as np
import json
import sys
import time
import threading
from datetime import datetime

# --- Configuration ---
MODEL_ID = "apollo"
MODEL_PATH = rf'./wake/model/{MODEL_ID}.onnx'
MODEL_PATHS = [MODEL_PATH]

DETECTION_THRESHOLD = 0.1  # Adjusted for better detection
SAMPLE_RATE = 16000
CHANNELS = 1
AUDIO_DTYPE = 'float32'

# Subprocess communication settings
HEARTBEAT_INTERVAL = 30  # Send heartbeat every 30 seconds
CONFIDENCE_REPORT_INTERVAL = 1  # Report confidence levels every 5 seconds

class WakeWordDetector:
    def __init__(self):
        self.model = None
        self.chunk_size = 1280
        self.is_running = False
        self.last_detection_time = 0
        self.confidence_scores = []
        self.detection_count = 0
        
        # Cooldown to prevent rapid re-triggering (in seconds)
        self.detection_cooldown = 2.0
        
    def send_message(self, message_type, data=None):
        """Send JSON message to stdout for Node.js to capture"""
        message = {
            "type": message_type,
            "timestamp": datetime.now().isoformat(),
            "data": data or {}
        }
        
        # Print to stdout (Node.js will capture this)
        print(json.dumps(message), flush=True)
    
    def send_error(self, error_msg):
        """Send error message"""
        self.send_message("error", {"message": error_msg})
    
    def send_detection(self, confidence):
        """Send wake word detection message"""
        self.detection_count += 1
        self.send_message("wake_word_detected", {
            "confidence": confidence,
            "model": MODEL_ID,
            "detection_number": self.detection_count
        })
    
    def send_status(self, status, details=None):
        """Send status update"""
        self.send_message("status", {
            "status": status,
            "details": details or {}
        })
    
    def send_heartbeat(self):
        """Send periodic heartbeat to show the process is alive"""
        self.send_message("heartbeat", {
            "uptime_seconds": time.time() - self.start_time,
            "detections_count": self.detection_count,
            "avg_confidence": np.mean(self.confidence_scores) if self.confidence_scores else 0
        })
    
    def initialize_model(self):
        """Initialize the wake word model"""
        try:
            self.send_status("initializing", {"model_path": MODEL_PATH})
            self.model = Model(wakeword_models=MODEL_PATHS)
            
            # Determine chunk size
            try:
                if hasattr(self.model, 'models') and MODEL_ID in self.model.models:
                    input_details = self.model.models[MODEL_ID].get_inputs()[0]
                    self.chunk_size = input_details.shape[1] if len(input_details.shape) > 1 else 1280
                else:
                    self.chunk_size = 1280
            except:
                self.chunk_size = 1280
            
            self.send_status("model_loaded", {
                "model_id": MODEL_ID,
                "chunk_size": self.chunk_size,
                "threshold": DETECTION_THRESHOLD
            })
            
            return True
            
        except Exception as e:
            self.send_error(f"Failed to load model: {str(e)}")
            return False
    
    def audio_callback(self, indata, frames, time_info, status):
        """Audio processing callback"""
        if status:
            self.send_error(f"Audio callback status: {status}")
            return
        
        if not self.is_running:
            return
            
        try:
            # Convert audio data
            audio_chunk = indata.flatten().astype(np.float32)
            
            # Handle chunk size mismatch
            if len(audio_chunk) != self.chunk_size:
                if len(audio_chunk) > self.chunk_size:
                    audio_chunk = audio_chunk[:self.chunk_size]
                else:
                    padded = np.zeros(self.chunk_size, dtype=np.float32)
                    padded[:len(audio_chunk)] = audio_chunk
                    audio_chunk = padded
            
            # Perform prediction
            prediction = self.model.predict(audio_chunk)
            
            # Get confidence score
            if MODEL_ID in prediction:
                confidence = prediction[MODEL_ID]
            else:
                confidence = next(iter(prediction.values())) if prediction else 0.0
            
            # Store confidence for averaging
            self.confidence_scores.append(confidence)
            if len(self.confidence_scores) > 100:  # Keep only last 100 scores
                self.confidence_scores.pop(0)
            
            # Check for detection
            current_time = time.time()
            if (confidence > DETECTION_THRESHOLD and 
                current_time - self.last_detection_time > self.detection_cooldown):
                
                self.last_detection_time = current_time
                self.send_detection(float(confidence))
                
        except Exception as e:
            self.send_error(f"Audio processing error: {str(e)}")
    
    def heartbeat_thread(self):
        """Background thread for sending heartbeats"""
        while self.is_running:
            time.sleep(HEARTBEAT_INTERVAL)
            if self.is_running:
                self.send_heartbeat()
    
    def confidence_report_thread(self):
        """Background thread for reporting confidence levels"""
        while self.is_running:
            time.sleep(CONFIDENCE_REPORT_INTERVAL)
            if self.is_running and self.confidence_scores:
                avg_confidence = np.mean(self.confidence_scores)
                max_confidence = np.max(self.confidence_scores)
                self.send_message("confidence_report", {
                    "average": float(avg_confidence),
                    "maximum": float(max_confidence),
                    "sample_count": len(self.confidence_scores)
                })
    
    def start_detection(self):
        """Start wake word detection"""
        if not self.initialize_model():
            return False
        
        try:
            self.send_status("starting_audio")
            self.is_running = True
            self.start_time = time.time()
            
            # Start background threads
            heartbeat_thread = threading.Thread(target=self.heartbeat_thread, daemon=True)
            confidence_thread = threading.Thread(target=self.confidence_report_thread, daemon=True)
            
            heartbeat_thread.start()
            confidence_thread.start()
            
            self.send_status("listening", {
                "sample_rate": SAMPLE_RATE,
                "channels": CHANNELS,
                "chunk_size": self.chunk_size
            })
            
            # Start audio stream
            with sd.InputStream(
                callback=self.audio_callback,
                channels=CHANNELS,
                samplerate=SAMPLE_RATE,
                dtype=AUDIO_DTYPE,
                blocksize=self.chunk_size
            ):
                # Keep running until stopped
                while self.is_running:
                    time.sleep(0.1)
                    
        except KeyboardInterrupt:
            pass
        except Exception as e:
            self.send_error(f"Audio stream error: {str(e)}")
        finally:
            self.stop_detection()
    
    def stop_detection(self):
        """Stop wake word detection"""
        self.is_running = False
        self.send_status("stopped")

def main():
    """Main function"""
    detector = WakeWordDetector()
    
    try:
        # Send startup message
        detector.send_status("starting")
        
        # Start detection (this will block until stopped)
        detector.start_detection()
        
    except Exception as e:
        detector.send_error(f"Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()