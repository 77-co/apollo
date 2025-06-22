# wake_detector.py
import sys
import json
import queue
import time
import sounddevice as sd
import numpy as np
import noisereduce as nr
from vosk import Model, KaldiRecognizer
from collections import deque

wake_words = ["apollo"]
model = Model(lang="pl")
rec = KaldiRecognizer(model, 16000, '["apollo", "[unk]"]')
rec.SetWords(True)

q = queue.Queue()
processed_texts = set()

# New parameters for improved detection
MIN_CONFIDENCE = 0.7  # Minimum confidence threshold
WAKE_CONFIRMATION_WINDOW = 1.5  # seconds
WAKE_CONFIRMATION_COUNT = 2 # minimum detections needed
MIN_WORD_DURATION = 0.3  # minimum duration for wake word

# Track recent detections for confirmation
recent_detections = deque(maxlen=10)
last_wake_time = 0
WAKE_COOLDOWN = 3.0  # seconds between wake detections

def amplify(audio_data, gain=1.5):  # Reduced gain
    samples = np.frombuffer(audio_data, dtype=np.int16)
    samples = np.clip(samples * gain, -32768, 32767).astype(np.int16)
    return samples.tobytes()

def denoise(audio_data):
    samples = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
    # Less aggressive noise reduction
    reduced = nr.reduce_noise(y=samples, sr=16000, prop_decrease=0.8, stationary=False)
    # Clip values before casting to avoid invalid value warnings
    reduced = np.nan_to_num(reduced)  # Replace NaN with zeros
    reduced = np.clip(reduced, -32768, 32767)  # Ensure values are in int16 range
    return reduced.astype(np.int16).tobytes()

def is_wake_word_valid(word_info):
    """Validate wake word detection with multiple criteria"""
    word = word_info.get('word', '').lower()
    confidence = word_info.get('conf', 0)
    start_time = word_info.get('start', 0)
    end_time = word_info.get('end', 0)
    
    # Check if it's actually our wake word
    if word not in [w.lower() for w in wake_words]:
        return False
    
    # Check confidence threshold
    if confidence < MIN_CONFIDENCE:
        return False
    
    # Check minimum duration
    duration = end_time - start_time
    if duration < MIN_WORD_DURATION:
        return False
    
    return True

def check_wake_word_confirmation():
    """Check if we have enough confirmed detections in the time window"""
    current_time = time.time()
    
    # Remove old detections outside the window
    while recent_detections and current_time - recent_detections[0] > WAKE_CONFIRMATION_WINDOW:
        recent_detections.popleft()
    
    # Check if we have enough detections
    return len(recent_detections) >= WAKE_CONFIRMATION_COUNT

def process_final_result(result):
    """Process final recognition result with word-level analysis"""
    global last_wake_time
    
    current_time = time.time()
    
    # Check cooldown period
    if current_time - last_wake_time < WAKE_COOLDOWN:
        return False
    
    words = result.get('result', [])
    wake_detected = False
    
    for word_info in words:
        if is_wake_word_valid(word_info):
            recent_detections.append(current_time)
            wake_detected = True
            print(f"Valid wake word detected: {word_info['word']} (conf: {word_info['conf']:.3f})")
            break
    
    # Check for confirmation
    if wake_detected and check_wake_word_confirmation():
        last_wake_time = current_time
        recent_detections.clear()  # Clear after successful detection
        return True
    
    return False

def callback(indata, frames, time, status):
    if status:
        print(status, file=sys.stderr)
    raw = bytes(indata)
    processed = amplify(raw)
    processed = denoise(processed)
    q.put(processed)

print("READY")

with sd.RawInputStream(samplerate=16000, blocksize=2048, dtype='int16',
                       channels=1, callback=callback):
    while True:
        data = q.get()
        
        if rec.AcceptWaveform(data):
            result = json.loads(rec.Result())
            
            # Only process final results for wake word detection
            if process_final_result(result):
                print("WAKE")
                sys.stdout.flush()
            
            # Clear processed texts on final result
            processed_texts.clear()
        else:
            # Still get partial results but don't use them for wake detection
            partial = json.loads(rec.PartialResult())
            text = partial.get("partial", "")
            # Optionally uncomment for debugging:
            # print(f"Partial: {text}")