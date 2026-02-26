import speech_recognition as sr
import webbrowser
import pyttsx3
import musicLibrary
import threading

# import pocketsphinx

r = sr.Recognizer()
engine = pyttsx3.init()
mic = sr.Microphone()

running = True


def speak(text):
    def run():
        engine.say(text)
        engine.runAndWait()
    threading.Thread(target=run).start()


def speak(text):
    engine.say(text)
    engine.runAndWait()

def ProcessCommand(c):
    global running
    
    if "stop" in c or "exit" in c or "quit" in c or "bye" in c or "go to sleep" in c:
        speak("Alright sir. Cherry going offline.")
        running = False
        return
    
    if "open google" in c.lower():
        webbrowser.open("https://google.com")
    elif "open facebook" in c.lower():
        webbrowser.open("https://facebook.com")
    elif "open youtube" in c.lower():
        webbrowser.open("https://youtube.com")
    elif "open instagram" in c.lower():
        webbrowser.open("https://instagram.com")
    elif "open linkedin" in c.lower():
        webbrowser.open("https://linkedin.com")
    elif "open chat" in c.lower():
        webbrowser.open("https://chat.openai.com/")
    elif c.lower().startswith("play"):
        song = c.lower().replace("play", "").strip()
        link = musicLibrary.music.get(song)
        if link:
            webbrowser.open(link)
        else:
            speak("I couldn't find that song sir")
 
    else:
        speak("I didn't understand that yet sir")
  
if __name__ == "__main__":
    speak("How may i help you sir")
    
    with mic as source:
        r.adjust_for_ambient_noise(source, duration=0.8)
        print("Microphone calibrated")
        
    while running:
        #Listen for the wake word "Cherry"
        # obtain audio from the microphone

        # recognize speech using Google
        print("Recognizing.....")
        
        try:
            print("Listening Sir.......")
            with mic as source:
                    audio = r.listen(source, timeout= 4, phrase_time_limit= 4)
                    
            word = r.recognize_google(audio).lower()
            print("Heard:", word)

            if "cherry" in word:
                speak("Waiting for command sir")
                
                #Listen to Command
                with mic as source:
                    print("Cherry is Listening Sir.......")
                    audio = r.listen(source, phrase_time_limit=5)
                    
                command = r.recognize_google(audio)
                print("Command:", command)
                    
                ProcessCommand(command)
                
        except sr.WaitTimeoutError:
            pass
        except sr.UnknownValueError:
            print("Could not understand audio")
        except Exception as e:
            print("Google error; {0}".format(e))