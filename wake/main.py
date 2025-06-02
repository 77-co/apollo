# wake_detector.py
import sys
import json
import queue
import sounddevice as sd
from vosk import Model, KaldiRecognizer

wake_words = ["apollo"]  # change to your preferred wake words
model = Model(lang="pl")
rec = KaldiRecognizer(model, 16000)
rec.SetWords(True)

q = queue.Queue()

def callback(indata, frames, time, status):
    if status:
        print(status, file=sys.stderr)
    q.put(bytes(indata))

print("READY")

with sd.RawInputStream(samplerate=16000, blocksize=4096, dtype='int16',
                       channels=1, callback=callback):
    while True:
        data = q.get()
        if rec.AcceptWaveform(data):
            result = json.loads(rec.Result())
            text = result.get("text", "")
            if any(word in text for word in wake_words):
                print("WAKE")
                sys.stdout.flush()
