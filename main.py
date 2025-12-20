import speech_recognition as sr
import webbrowser
import pyttsx3
import musicLibrary
# import pocketsphinx

r = sr.Recognizer()
engine = pyttsx3.init()


def speak(text):
    engine.say(text)
    engine.runAndWait()

def ProcessCommand(c):
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
        song = c.lower().split(" ")[1]
        link = musicLibrary.music[song]
        if link:
            webbrowser.open(link)
        else:
            speak("Song not found sir")  
    else:
        #Let Gemini handle the request
        pass
  
if __name__ == "__main__":
    speak("How may i help you sir")
    
    with sr.Microphone() as source:
        r.adjust_for_ambient_noise(source, duration=0.8)
        print("Microphone calibrated")
        
    while True:
        #Listen for the wake word "Cherry"
        # obtain audio from the microphone

        # recognize speech using Google
        print("Recognizing.....")
        
        try:
            print("Listening Sir.......")
            with sr.Microphone() as source:
                    audio = r.listen(source, timeout= 4, phrase_time_limit= 4)
                    
            word = r.recognize_google(audio).lower()
            print("Heard:", word)

            if word == "cherry":
                speak("Waiting for command sir")
                
                #Listen to Command
                with sr.Microphone() as source:
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