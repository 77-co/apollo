# wake_detector.py
import sys
import json
import queue
import sounddevice as sd
from vosk import Model, KaldiRecognizer

wake_words = ["apollo", "apel", "ebola"]
model = Model(lang="pl")
rec = KaldiRecognizer(model, 16000)
rec.SetWords(True)

q = queue.Queue()
processed_texts = set()  # Track what we've already processed

def callback(indata, frames, time, status):
    if status:
        print(status, file=sys.stderr)
    q.put(bytes(indata))

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
            any(word.lower() in text.lower() for word in wake_words)):
            print("WAKE")
            sys.stdout.flush()
            processed_texts.add(text)