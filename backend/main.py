from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import uuid
from midi_gen import generate_midi
from fastapi.responses import FileResponse

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class Chord(BaseModel):
    time: float
    chord: str

class Transcription(BaseModel):
    chords: List[Chord]

MIDI_DIR = "temp_midi"
os.makedirs(MIDI_DIR, exist_ok=True)

@app.post("/midi")
async def create_midi(data: Transcription):
    try:
        filename = f"{uuid.uuid4()}.mid"
        filepath = os.path.join(MIDI_DIR, filename)
        
        # Extract data to primitives
        chords_list = [{"time": c.time, "chord": c.chord} for c in data.chords]
        
        generate_midi(chords_list, filepath)
        
        return {"midi_url": f"/download/{filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download/{filename}")
async def download_midi(filename: str):
    filepath = os.path.join(MIDI_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        filepath, 
        media_type='audio/midi', 
        filename="transcription.mid"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
