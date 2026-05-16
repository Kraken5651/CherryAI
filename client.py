"""Quick Gemini API test — run: python client.py"""

from cherry.brain import Brain


def main() -> None:
    brain = Brain()
    print(brain.chat("Say hello in one sentence."))


if __name__ == "__main__":
    main()
