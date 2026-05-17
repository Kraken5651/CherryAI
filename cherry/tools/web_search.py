import requests
import urllib.parse

def web_search(query: str) -> str:
    """Free web search via DuckDuckGo (no API key required)."""
    # Using the DDG 'lite' or 'html' version can be tricky without a full browser
    # but we can use their API-like endpoint for instant answers or a simple proxy
    
    url = f"https://api.duckduckgo.com/?q={urllib.parse.quote(query)}&format=json&no_html=1&skip_disambig=1"
    
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        
        results = []
        
        # 1. Abstract (Instant Answer)
        if data.get("AbstractText"):
            results.append(f"Summary: {data['AbstractText']}")
            if data.get("AbstractSource"):
                results.append(f"Source: {data['AbstractSource']}")
        
        # 2. Related Topics (General snippets)
        topics = data.get("RelatedTopics", [])
        snippets = []
        for t in topics[:5]:
            if "Text" in t:
                snippets.append(t["Text"])
            elif "Topics" in t: # Sub-topics
                for sub in t["Topics"][:2]:
                    snippets.append(sub["Text"])
        
        if snippets:
            results.append("Related Information:\n- " + "\n- ".join(snippets))
            
        if not results:
            return f"No direct answer found for '{query}'. Try rephrasing or searching for something specific."
            
        return "\n\n".join(results)

    except Exception as e:
        return f"Web search failed: {e}"
