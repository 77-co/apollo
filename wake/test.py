# Improved wake word detection with debugging and fixes

from openwakeword.model import Model
import sounddevice as sd
import numpy as np
import time

# --- Configuration ---
MODEL_ID = "apollo"
MODEL_PATH = rf'wake/model/{MODEL_ID}.onnx'
MODEL_PATHS = [MODEL_PATH]

DETECTION_THRESHOLD = 0.01  # Try lowering this to 0.3 or 0.2 for testing
SAMPLE_RATE = 16000
CHANNELS = 1
AUDIO_DTYPE = 'float32'

# Debugging flags
DEBUG_AUDIO = True  # Set to True to see audio level info
DEBUG_PREDICTIONS = True  # Set to True to see all predictions

# Show input device info
print("=== AUDIO DEVICE INFO ===")
print("Available input devices:")
devices = sd.query_devices()
for i, device in enumerate(devices):
    if device['max_input_channels'] > 0:
        print(f"  [{i}] {device['name']} - {device['max_input_channels']} channels, {device['default_samplerate']} Hz")

default_device = sd.query_devices(kind='input')
print(f"\nUsing default input device:")
print(f"  Name: {default_device['name']}")
print(f"  Index: {default_device['index']}")
print(f"  Channels: {default_device['max_input_channels']}")
print(f"  Sample Rate: {default_device['default_samplerate']}")
print("=" * 50)

# --- Initialize Model ---
try:
    print(f"Loading model from: {MODEL_PATH}")
    model = Model(wakeword_models=MODEL_PATHS)
    print("✓ Model loaded successfully")
except Exception as e:
    print(f"✗ Error loading model: {e}")
    print("Please ensure the .onnx model file exists and onnxruntime is installed.")
    exit()

# Get model info
print(f"Model info: {model.model_inputs}")
print(f"Available models: {list(model.prediction_buffer.keys())}")

# Determine chunk size - fix the attribute access
try:
    # The correct way to get input length from openwakeword
    if hasattr(model, 'models') and MODEL_ID in model.models:
        # Get the input shape from the ONNX model
        input_details = model.models[MODEL_ID].get_inputs()[0]
        CHUNK_SIZE = input_details.shape[1] if len(input_details.shape) > 1 else 1280
    else:
        CHUNK_SIZE = 1280  # Default for most openwakeword models
except:
    CHUNK_SIZE = 1280

print(f"Using chunk size: {CHUNK_SIZE}")

# Audio level monitoring
audio_levels = []
last_print_time = time.time()

# --- SoundDevice Callback ---
def callback(indata: np.ndarray, frames: int, time_info, status):
    """
    Callback for audio processing
    """
    global audio_levels, last_print_time
    
    if status:
        print(f"Audio status: {status}", flush=True)
        return

    # Convert to the right format
    audio_chunk = indata.flatten().astype(np.float32)

    assert len(audio_chunk) == CHUNK_SIZE, f"Expected {CHUNK_SIZE} samples, got {len(audio_chunk)}"
    
    # Debug: Monitor audio levels
    if DEBUG_AUDIO:
        rms = np.sqrt(np.mean(audio_chunk**2))
        max_val = np.max(np.abs(audio_chunk))
        audio_levels.append(rms)
        
        # Print audio level info every second
        current_time = time.time()
        if current_time - last_print_time >= 1.0:
            avg_rms = np.mean(audio_levels) if audio_levels else 0
            print(f"Audio - RMS: {avg_rms:.4f}, Max: {max_val:.4f}, Samples: {len(audio_chunk)}")
            audio_levels = []
            last_print_time = current_time
    
    # Handle chunk size mismatch
    if len(audio_chunk) != CHUNK_SIZE:
        if len(audio_chunk) > CHUNK_SIZE:
            audio_chunk = audio_chunk[:CHUNK_SIZE]
        else:
            # Pad with zeros if too short
            padded = np.zeros(CHUNK_SIZE, dtype=np.float32)
            padded[:len(audio_chunk)] = audio_chunk
            audio_chunk = padded

    try:
        # Perform prediction
        prediction = model.predict(audio_chunk)
        
        # Get the score for our model
        if MODEL_ID in prediction:
            score = prediction[MODEL_ID]
        else:
            # Try to get any available prediction
            score = next(iter(prediction.values())) if prediction else 0.0
        
        if DEBUG_PREDICTIONS:
            print(f"Prediction: {prediction}")
        
        # Print current score (overwrite previous line)
        print(f"Score: {score:.4f} {'█' * int(score * 20):<20}", end='\r', flush=True)
        
        # Detection logic
        if score > DETECTION_THRESHOLD:
            print(f"\n🎉 WAKE WORD DETECTED! Score: {score:.3f}")
            print("-" * 40)
            
            # Optional: brief pause to avoid rapid re-triggering
            time.sleep(0.5)
            
    except Exception as e:
        print(f"\nError in prediction: {e}")

# --- Test Audio Input ---
def test_audio_input():
    """Test if we're getting audio input"""
    print("\n=== TESTING AUDIO INPUT ===")
    print("Testing for 3 seconds... speak now!")
    
    test_data = []
    def test_callback(indata, frames, time, status):
        test_data.append(np.copy(indata.flatten()))
    
    with sd.InputStream(callback=test_callback, channels=CHANNELS, 
                       samplerate=SAMPLE_RATE, dtype=AUDIO_DTYPE, blocksize=CHUNK_SIZE):
        sd.sleep(3000)
    
    if test_data:
        all_audio = np.concatenate(test_data)
        rms = np.sqrt(np.mean(all_audio**2))
        max_val = np.max(np.abs(all_audio))
        print(f"✓ Audio captured - RMS: {rms:.4f}, Max: {max_val:.4f}")
        if rms < 0.001:
            print("⚠️  WARNING: Very low audio levels detected!")
            print("   - Check microphone connection")
            print("   - Adjust microphone volume/gain")
            print("   - Try speaking louder")
        return True
    else:
        print("✗ No audio data captured!")
        return False

# --- Main ---
if __name__ == "__main__":
    # Test audio input first
    if not test_audio_input():
        print("Exiting due to audio input issues.")
        exit()
    
    try:
        print(f"\n=== STARTING WAKE WORD DETECTION ===")
        print(f"Model: {MODEL_ID}")
        print(f"Threshold: {DETECTION_THRESHOLD}")
        print(f"Say 'Alexa' to test detection")
        print(f"Press Ctrl+C to stop")
        print("=" * 50)

        with sd.InputStream(callback=callback,
                           channels=CHANNELS,
                           samplerate=SAMPLE_RATE,
                           dtype=AUDIO_DTYPE,
                           blocksize=CHUNK_SIZE):
            while True:
                sd.sleep(1000)

    except KeyboardInterrupt:
        print("\n\nStopping...")
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("Program terminated.")

# === TROUBLESHOOTING TIPS ===
print("\n" + "="*50)
print("TROUBLESHOOTING TIPS:")
print("1. Try lowering DETECTION_THRESHOLD to 0.2 or 0.3")
print("2. Ensure you're saying 'Alexa' clearly and at normal volume")
print("3. Check that your microphone is working and not muted")
print("4. Try different microphone positions/distances")
print("5. Run with DEBUG_AUDIO=True to monitor audio levels")
print("6. The model expects specific pronunciation - try different accents/speeds")
print("="*50)