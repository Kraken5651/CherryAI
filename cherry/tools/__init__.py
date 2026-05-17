from . import browser, files, images, shell, system_win, web_search

TOOL_HANDLERS = {
    "open_website": browser.open_website,
    "play_music": browser.play_music,
    "open_application": system_win.open_application,
    "open_path": system_win.open_path,
    "generate_image": images.generate_image,
    "read_file": files.read_file,
    "write_file": files.write_file,
    "list_dir": files.list_dir,
    "run_command": shell.run_command,
    "web_search": web_search.web_search,
}

TOOL_DECLARATIONS = [
    {
        "name": "open_website",
        "description": "Open a website in the default browser. Use site names like google, youtube, github, or full URLs.",
        "parameters": {
            "type": "object",
            "properties": {
                "target": {
                    "type": "string",
                    "description": "Site name (google, youtube, facebook, instagram, linkedin, chatgpt) or a full URL.",
                }
            },
            "required": ["target"],
        },
    },
    {
        "name": "play_music",
        "description": "Play a song from the music library by name.",
        "parameters": {
            "type": "object",
            "properties": {
                "song": {"type": "string", "description": "Song name from the library."},
            },
            "required": ["song"],
        },
    },
    {
        "name": "open_application",
        "description": "Launch a Windows application by name (chrome, vscode, notepad, calculator, explorer, etc.).",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Application name or alias."},
            },
            "required": ["name"],
        },
    },
    {
        "name": "open_path",
        "description": "Open a folder or file in Windows Explorer / default app.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Absolute or relative path under allowed directories."},
            },
            "required": ["path"],
        },
    },
    {
        "name": "generate_image",
        "description": "Generate an image from a text prompt and open it.",
        "parameters": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "Detailed image description."},
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "read_file",
        "description": "Read a text file from an allowed project directory.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path."},
            },
            "required": ["path"],
        },
    },
    {
        "name": "write_file",
        "description": "Write or overwrite a text file in an allowed directory.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path."},
                "content": {"type": "string", "description": "Full file content."},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "list_dir",
        "description": "List files and folders in a directory.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Directory path."},
            },
            "required": ["path"],
        },
    },
    {
        "name": "run_command",
        "description": "Run a safe shell command (git, python, pip, dir, type, etc.) in an allowed directory.",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Command to run."},
                "cwd": {
                    "type": "string",
                    "description": "Working directory (optional).",
                },
            },
            "required": ["command"],
        },
    },
    {
        "name": "web_search",
        "description": "Search the web for current information, facts, weather, or news using DuckDuckGo.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query."},
            },
            "required": ["query"],
        },
    },
]
