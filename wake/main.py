# wake_detector.py - Improved for slower devices
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

# Adjusted parameters for slower devices
MIN_CONFIDENCE = 0.6  # Slightly lower for better detection
WAKE_CONFIRMATION_WINDOW = 3.0  # Longer window for slower processing
WAKE_CONFIRMATION_COUNT = 1  # Single detection is enough if confidence is high
MIN_WORD_DURATION = 0.2  # Slightly shorter minimum duration
HIGH_CONFIDENCE_THRESHOLD = 0.8  # For single-detection bypass

# Track recent detections for confirmation
recent_detections = deque(maxlen=10)
last_wake_time = 0
WAKE_COOLDOWN = 2.0  # Shorter cooldown
MAX_QUEUE_SIZE = 5  # Prevent queue buildup

# Performance optimizations
PROCESS_AUDIO_ENHANCEMENT = True  # Can be disabled for performance
last_audio_process_time = 0
AUDIO_PROCESS_INTERVAL = 0.1  # Minimum time between audio processing

def amplify(audio_data, gain=1.3):  # Slightly reduced gain
    samples = np.frombuffer(audio_data, dtype=np.int16)
    samples = np.clip(samples * gain, -32768, 32767).astype(np.int16)
    return samples.tobytes()

def denoise(audio_data):
    samples = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
    # Lighter noise reduction for performance
    reduced = nr.reduce_noise(y=samples, sr=16000, prop_decrease=0.6, stationary=True)
    return reduced.astype(np.int16).tobytes()

def process_audio_enhancement(audio_data):
    """Apply audio enhancements with performance throttling"""
    global last_audio_process_time
    
    if not PROCESS_AUDIO_ENHANCEMENT:
        return audio_data
    
    current_time = time.time()
    if current_time - last_audio_process_time < AUDIO_PROCESS_INTERVAL:
        return audio_data  # Skip processing to maintain real-time performance
    
    last_audio_process_time = current_time
    processed = amplify(audio_data)
    processed = denoise(processed)
    return processed

def is_wake_word_valid(word_info):
    """Validate wake word detection with adjusted criteria for slower devices"""
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

def check_wake_word_confirmation(latest_confidence):
    """Improved confirmation logic for slower devices"""
    current_time = time.time()
    
    # Remove old detections outside the window
    while recent_detections and current_time - recent_detections[0]['time'] > WAKE_CONFIRMATION_WINDOW:
        recent_detections.popleft()
    
    # High confidence detections can bypass confirmation requirement
    if latest_confidence >= HIGH_CONFIDENCE_THRESHOLD:
        return True
    
    # Check if we have enough detections in the window
    return len(recent_detections) >= WAKE_CONFIRMATION_COUNT

def process_final_result(result):
    """Process final recognition result with improved logic for slower devices"""
    global last_wake_time
    
    current_time = time.time()
    
    # Check cooldown period
    if current_time - last_wake_time < WAKE_COOLDOWN:
        return False
    
    words = result.get('result', [])
    highest_confidence = 0
    valid_wake_detected = False
    
    for word_info in words:
        if is_wake_word_valid(word_info):
            confidence = word_info.get('conf', 0)
            highest_confidence = max(highest_confidence, confidence)
            
            recent_detections.append({
                'time': current_time,
                'confidence': confidence,
                'word': word_info['word']
            })
            valid_wake_detected = True
            # print(f"Valid wake word detected: {word_info['word']} (conf: {confidence:.3f})")
    
    # Check for confirmation
    if valid_wake_detected and check_wake_word_confirmation(highest_confidence):
        last_wake_time = current_time
        recent_detections.clear()  # Clear after successful detection
        # print(f"WAKE CONFIRMED (confidence: {highest_confidence:.3f})")
        return True
    
    return False

def callback(indata, frames, time, status):
    # if status:
    #     print(status, file=sys.stderr)
    
    # Prevent queue buildup on slower devices
    if q.qsize() > MAX_QUEUE_SIZE:
        try:
            q.get_nowait()  # Remove oldest item
        except queue.Empty:
            pass
    
    raw = bytes(indata)
    processed = process_audio_enhancement(raw)
    q.put(processed)

print("READY")

with sd.RawInputStream(samplerate=16000, blocksize=2048, dtype='int16',
                       channels=1, callback=callback):
    while True:
        try:
            # Non-blocking get with timeout to prevent hanging
            data = q.get(timeout=1.0)
        except queue.Empty:
            continue
        
        if rec.AcceptWaveform(data):
            result = json.loads(rec.Result())
            
            # Process final results for wake word detection
            if process_final_result(result):
                print("WAKE")
                sys.stdout.flush()
            
            # Clear processed texts on final result
            processed_texts.clear()
        else:
            # Get partial results but don't use them for wake detection
            partial = json.loads(rec.PartialResult())
            text = partial.get("partial", "")
            # Optionally uncomment for debugging:
            # print(f"Partial: {text}", file=sys.stderr)