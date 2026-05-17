import sys
import os

def check_imports():
    print("Cherry AI - System Dependency Check\n" + "="*40)
    
    dependencies = [
        ("google.genai", "Google Gemini SDK"),
        ("dotenv", "Environment Config"),
        ("speech_recognition", "Speech Recognition"),
        ("sounddevice", "Microphone Access"),
        ("edge_tts", "Voice Generation"),
        ("pygame", "Audio Playback"),
        ("pystray", "System Tray"),
        ("PIL", "Image Processing"),
        ("customtkinter", "UI Framework")
    ]
    
    all_ok = True
    for module, name in dependencies:
        try:
            __import__(module)
            print(f"[OK] {name:20}")
        except ImportError as e:
            print(f"[FAIL] {name:20} : MISSING ({e})")
            all_ok = False
            
    print("="*40)
    if all_ok:
        print("SUCCESS: All dependencies are correctly installed!")
    else:
        print("WARNING: Some dependencies are missing. Run 'pip install -r requirements.txt'")
    
    # Check .env
    if os.path.exists(".env"):
        print("[OK] .env file           : FOUND")
    else:
        print("[FAIL] .env file           : NOT FOUND")

if __name__ == "__main__":
    check_imports()
