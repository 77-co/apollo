# wake_detector.py
import sys
import json
import queue
import sounddevice as sd
import numpy as np
import noisereduce as nr
from vosk import Model, KaldiRecognizer

wake_words = ["apollo"]
model = Model(lang="pl")
rec = KaldiRecognizer(model, 16000, '["apollo", "[unk]"]')
rec.SetWords(True)

q = queue.Queue()
processed_texts = set()  # Track what we've already processed

def amplify(audio_data, gain=2):
    samples = np.frombuffer(audio_data, dtype=np.int16)
    samples = np.clip(samples * gain, -32768, 32767).astype(np.int16)
    return samples.tobytes()

def denoise(audio_data):
    samples = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
    reduced = nr.reduce_noise(y=samples, sr=16000)
    return reduced.astype(np.int16).tobytes()

def callback(indata, frames, time, status):
    if status:
        print(status, file=sys.stderr)
    raw = bytes(indata)
    processed = amplify(raw)
    processed = denoise(processed)
    q.put(processed)

print("READY")

with sd.RawInputStream(samplerate=16000, blocksize=4096, dtype='int16',
                       channels=1, callback=callback):
    while True:
        data = q.get()
        text = ""
        is_final = False
        
        if rec.AcceptWaveform(data):
            result = json.loads(rec.Result())
            is_final = True
            # print(f"Final: {text}")
            # Clear processed texts on final result
            processed_texts.clear()
        else:
            partial = json.loads(rec.PartialResult())
            text = partial.get("partial", "")
            # print(f"Partial: {text}")
        
        # Check wake words only if we haven't seen this text before
        if (text and 
            text not in processed_texts and
            any(word.lower() == text.lower() for word in wake_words)):
            print("WAKE")
            sys.stdout.flush()
            processed_texts.add(text)